import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign, Mic, FileAudio, Brain, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { format } from "date-fns";
import Pagination, { paginate } from "@/components/common/Pagination";

interface CostRow {
  interview_id: string;
  duration_seconds: number;
  voice_cost: number;
  transcription_cost: number;
  claude_cost: number;
  total_cost: number;
  updated_at: string;
  interviews: { candidates: { full_name: string } | null } | null;
}

const PAGE_SIZE = 15;
const usd = (n: number) => `$${Number(n || 0).toFixed(2)}`;
const mins = (s: number) => `${Math.round((s || 0) / 60)}m`;

export default function Costs() {
  const { profile } = useProfile();
  const [rows, setRows] = useState<CostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!profile?.org_id) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("interview_costs")
        .select("interview_id, duration_seconds, voice_cost, transcription_cost, claude_cost, total_cost, updated_at, interviews(candidates(full_name))")
        .eq("org_id", profile.org_id)
        .order("updated_at", { ascending: false });
      setRows((data as unknown as CostRow[]) || []);
      setLoading(false);
    })();
  }, [profile?.org_id]);

  const totals = useMemo(() => rows.reduce(
    (acc, r) => ({
      voice: acc.voice + Number(r.voice_cost || 0),
      transcription: acc.transcription + Number(r.transcription_cost || 0),
      claude: acc.claude + Number(r.claude_cost || 0),
      total: acc.total + Number(r.total_cost || 0),
    }),
    { voice: 0, transcription: 0, claude: 0, total: 0 }
  ), [rows]);

  const pageRows = paginate(rows, page, PAGE_SIZE);

  const tiles = [
    { label: "Total spend", value: usd(totals.total), icon: DollarSign, accent: "text-emerald-600" },
    { label: "Voice", value: usd(totals.voice), icon: Mic, accent: "text-purple-600" },
    { label: "Transcription", value: usd(totals.transcription), icon: FileAudio, accent: "text-blue-600" },
    { label: "Claude (AI)", value: usd(totals.claude), icon: Brain, accent: "text-amber-600" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Costs</h1>
        <p className="text-muted-foreground mt-1">
          Estimated AI/API spend across {rows.length} completed interview{rows.length === 1 ? "" : "s"}.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(t => (
          <Card key={t.label}>
            <CardContent className="flex items-center gap-3 py-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <t.icon className={`h-5 w-5 ${t.accent}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t.label}</p>
                <p className="text-xl font-bold">{t.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Figures are estimates: voice &amp; transcription from interview duration × published rates; Claude from average token usage.
      </p>

      <Card>
        {loading ? (
          <CardContent className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </CardContent>
        ) : rows.length === 0 ? (
          <CardContent className="py-16 text-center text-muted-foreground">
            No interview costs recorded yet.
          </CardContent>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead className="text-right">Voice</TableHead>
                  <TableHead className="text-right">Transcription</TableHead>
                  <TableHead className="text-right">Claude</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map(r => (
                  <TableRow key={r.interview_id}>
                    <TableCell className="font-medium">
                      {r.interviews?.candidates?.full_name || "Unknown"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{mins(r.duration_seconds)}</TableCell>
                    <TableCell className="text-right text-sm">{usd(r.voice_cost)}</TableCell>
                    <TableCell className="text-right text-sm">{usd(r.transcription_cost)}</TableCell>
                    <TableCell className="text-right text-sm">{usd(r.claude_cost)}</TableCell>
                    <TableCell className="text-right text-sm font-semibold">{usd(r.total_cost)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(r.updated_at), "MMM d, yyyy")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="px-4 pb-4">
              <Pagination page={page} pageSize={PAGE_SIZE} total={rows.length} onPageChange={setPage} />
            </div>
          </>
        )}
      </Card>
    </div>
  );
}