import { Router } from "express";
import multer from "multer";
import { randomBytes } from "crypto";
import { existsSync, mkdirSync, createReadStream } from "fs";
import { resolve, extname, basename } from "path";
import { supabase } from "../supabase.js";

const router = Router();

// Local storage folder for now (swap to S3/blob later by changing this layer).
const UPLOAD_DIR = resolve(process.cwd(), "server/uploads/resumes");
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_EXT = new Set([".pdf", ".docx"]);
const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    // Random, unguessable name; keep the extension.
    cb(null, `${randomBytes(16).toString("hex")}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    if (ALLOWED_EXT.has(ext) && ALLOWED_MIME.has(file.mimetype)) cb(null, true);
    else cb(new Error("Only PDF or DOCX files are allowed"));
  },
});

// Verify a Supabase auth token from the Authorization header.
async function requireUser(req: any, res: any): Promise<boolean> {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    res.status(401).json({ error: "Invalid token" });
    return false;
  }
  req.userId = user.id;
  return true;
}

// POST /api/uploads/resume — authenticated resume upload. Returns a URL.
router.post("/resume", (req, res) => {
  requireUser(req, res).then(ok => {
    if (!ok) return;
    upload.single("file")(req, res, (err: any) => {
      if (err) return res.status(400).json({ error: err.message });
      const file = (req as any).file;
      if (!file) return res.status(400).json({ error: "No file uploaded" });
      // URL the client stores in resume_url; download route enforces auth.
      const url = `/api/uploads/resumes/${file.filename}`;
      res.json({ url, filename: file.filename });
    });
  });
});

// GET /api/uploads/resumes/:file — authenticated download.
// Token can come from the Authorization header OR a ?token= query param
// (so the file can be opened directly in a browser tab / <a> link).
router.get("/resumes/:file", async (req, res) => {
  const token =
    (req.headers.authorization?.replace("Bearer ", "")) ||
    (typeof req.query.token === "string" ? req.query.token : "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: "Invalid token" });

  // Prevent path traversal — only allow the bare filename.
  const name = basename(req.params.file);
  const filePath = resolve(UPLOAD_DIR, name);
  if (!filePath.startsWith(UPLOAD_DIR) || !existsSync(filePath)) {
    return res.status(404).json({ error: "File not found" });
  }

  const ext = extname(name).toLowerCase();
  res.setHeader(
    "Content-Type",
    ext === ".pdf"
      ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
  createReadStream(filePath).pipe(res);
});

export default router;