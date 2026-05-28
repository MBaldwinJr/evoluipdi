import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ptGetMirror } from "@/lib/pt.functions";
import { usePtCompany } from "@/lib/pt-context";
import { fmtMin } from "@/lib/pt-format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

export const Route = createFileRoute("/_app/pt/espelho")({
  component: MirrorPage,
});

function MirrorPage() {
  const { current } = usePtCompany();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const fn = useServerFn(ptGetMirror);
  const q = useQuery({
    queryKey: ["pt", "mirror", current?.id, month],
    queryFn: () => fn({ data: { company_id: current!.id, month } }),
    enabled: !!current,
  });

  if (!current) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-48" />
      </div>

      {q.isLoading && <div>Carregando...</div>}
      {q.data && (
        <>
          <div className="grid gap-3 md:grid-cols-5">
            {[
              { label: "Trabalhado", val: q.data.totals.worked_min },
              { label: "Previsto", val: q.data.totals.expected_min },
              { label: "Atrasos", val: q.data.totals.late_min },
              { label: "Extras 50%", val: q.data.totals.extra_min_50 },
              { label: "Saldo", val: q.data.totals.balance_min },
            ].map((k) => (
              <Card key={k.label}>
                <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">{k.label}</CardTitle></CardHeader>
                <CardContent className="text-xl font-semibold">{fmtMin(k.val)}</CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader><CardTitle>{(q.data.employee as any).full_name}</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Previsto</TableHead>
                    <TableHead>Trabalhado</TableHead>
                    <TableHead>Atraso</TableHead>
                    <TableHead>Extras</TableHead>
                    <TableHead>Saldo</TableHead>
                    <TableHead>Obs.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {q.data.days.map((d) => (
                    <TableRow key={d.date} className={d.is_holiday ? "bg-muted/30" : ""}>
                      <TableCell className="font-mono text-xs">{d.date}</TableCell>
                      <TableCell>{fmtMin(d.expected_min)}</TableCell>
                      <TableCell>{fmtMin(d.worked_min)}</TableCell>
                      <TableCell className={d.late_min > 0 ? "text-destructive" : ""}>{fmtMin(d.late_min)}</TableCell>
                      <TableCell>{fmtMin(d.extra_min_50 + d.extra_min_100)}</TableCell>
                      <TableCell className={d.balance_min < 0 ? "text-destructive" : "text-green-600"}>{fmtMin(d.balance_min)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {d.is_holiday && <Badge variant="secondary" className="mr-1">feriado</Badge>}
                        {d.warnings.map((w, i) => <Badge key={i} variant="outline" className="mr-1">{w}</Badge>)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
