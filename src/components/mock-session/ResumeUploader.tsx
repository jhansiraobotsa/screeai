import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Upload, FileText, X } from "lucide-react";
import { toast } from "sonner";

interface ResumeUploaderProps {
  resumeText: string;
  onResumeTextChange: (text: string) => void;
  onFileUpload: (file: File) => void;
}

export default function ResumeUploader({ resumeText, onResumeTextChange, onFileUpload }: ResumeUploaderProps) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (file.type === "application/pdf") {
      // Extract text from PDF using FileReader
      try {
        const text = await extractPdfText(file);
        if (text.trim()) {
          onResumeTextChange(text);
          setFileName(file.name);
          onFileUpload(file);
        } else {
          toast.error("Could not extract text from PDF. Please paste your resume text manually.");
        }
      } catch {
        toast.error("Failed to read PDF. Please paste your resume text instead.");
      }
    } else if (file.type === "text/plain") {
      const text = await file.text();
      onResumeTextChange(text);
      setFileName(file.name);
      onFileUpload(file);
    } else {
      toast.error("Please upload a PDF or text file");
    }
  };

  const extractPdfText = async (file: File): Promise<string> => {
    // Simple text extraction — read raw bytes and extract text content
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let text = "";
    // Try to decode as text (works for many PDFs with embedded text)
    const decoder = new TextDecoder("utf-8", { fatal: false });
    const rawText = decoder.decode(bytes);

    // Extract text between BT and ET markers (PDF text blocks)
    const textBlocks = rawText.match(/BT[\s\S]*?ET/g) || [];
    for (const block of textBlocks) {
      const textMatches = block.match(/\(([^)]*)\)/g) || [];
      for (const match of textMatches) {
        text += match.slice(1, -1) + " ";
      }
    }

    // If that didn't work, try the simpler approach of just getting readable text
    if (!text.trim()) {
      text = rawText.replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s+/g, " ");
    }

    return text.trim();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const clearFile = () => {
    setFileName(null);
    onResumeTextChange("");
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium">Resume</label>

      {/* Drop zone */}
      <div
        className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
          dragActive
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/40"
        }`}
        onDragOver={e => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.txt"
          className="hidden"
          onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
        />

        {fileName ? (
          <div className="flex items-center justify-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium">{fileName}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={e => { e.stopPropagation(); clearFile(); }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <>
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Drag & drop your resume (PDF/TXT) or <span className="text-primary font-medium">browse</span>
            </p>
          </>
        )}
      </div>

      {/* Or paste text */}
      <div className="relative">
        <div className="absolute inset-x-0 -top-0.5 flex justify-center">
          <span className="bg-background px-2 text-xs text-muted-foreground">or paste your resume text</span>
        </div>
        <Textarea
          value={resumeText}
          onChange={e => onResumeTextChange(e.target.value)}
          placeholder="Paste your resume content here..."
          className="min-h-[120px] mt-3 resize-none"
        />
      </div>
    </div>
  );
}
