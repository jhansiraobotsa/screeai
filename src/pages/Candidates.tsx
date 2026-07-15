import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Search, Upload, FileText, Mail, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import AddCandidateDialog from "@/components/candidates/AddCandidateDialog";
import type { Tables } from "@/integrations/supabase/types";
import { format } from "date-fns";

export default function Candidates() {
  const [candidates, setCandidates] = useState<Tables<"candidates">[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const { profile } = useProfile();

  const fetchCandidates = useCallback(async () => {
    if (!profile?.org_id) return;
    setLoading(true);
    let query = supabase
      .from("candidates")
      .select("*")
      .eq("org_id", profile.org_id)
      .order("created_at", { ascending: false });

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data } = await query;
    setCandidates(data || []);
    setLoading(false);
  }, [profile?.org_id, search]);

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  const statusColor = (status: string) => {
    switch (status) {
      case "active": return "default" as const;
      case "interviewing": return "secondary" as const;
      case "hired": return "default" as const;
      case "rejected": return "destructive" as const;
      default: return "outline" as const;
    }
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Candidates</h1>
          <p className="text-muted-foreground mt-1">Manage candidate profiles and resumes</p>
        </div>
        <div className="flex gap-2">
          <AddCandidateDialog onCreated={fetchCandidates} />
        </div>
      </motion.div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search candidates..."
          className="pl-9"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : candidates.length === 0 ? (
        <Card>
          <CardContent className="py-16">
            <div className="flex flex-col items-center justify-center text-center">
              <Users className="h-16 w-16 text-muted-foreground/20 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No candidates yet</h3>
              <p className="text-muted-foreground max-w-sm">
                Add candidates manually or import them in bulk. Upload resumes to enable AI-grounded interviews.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Resume</TableHead>
                <TableHead>Added</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {candidates.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.full_name}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1 text-sm">
                      <Mail className="h-3 w-3 text-muted-foreground" />
                      {c.email}
                    </span>
                  </TableCell>
                  <TableCell>
                    {c.phone ? (
                      <span className="flex items-center gap-1 text-sm">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        {c.phone}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusColor(c.status)} className="capitalize">
                      {c.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {c.resume_url ? (
                      <a href={c.resume_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary text-sm hover:underline">
                        <FileText className="h-3 w-3" /> View
                      </a>
                    ) : (
                      <span className="text-muted-foreground text-sm">None</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(c.created_at), "MMM d, yyyy")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
