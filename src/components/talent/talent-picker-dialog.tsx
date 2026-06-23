import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { createApplication } from "@/lib/talent-pool.functions";

export function TalentPickerDialog({
  open, onOpenChange, jobId, onAdded,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  jobId: string;
  onAdded: () => void;
}) {
  const [q, setQ] = useState("");
  const [addingId, setAddingId] = useState<string | null>(null);
  const create = useServerFn(createApplication);

  const { data: talents = [], isLoading } = useQuery({
    queryKey: ["talent-pool-picker", q],
    enabled: open,
    queryFn: async () => {
      let query = supabase
        .from("talent_pool")
        .select("id, full_name, current_position, current_company, skills, status")
        .eq("status", "active")
        .order("full_name")
        .limit(50);
      const term = q.trim();
      if (term) query = query.ilike("full_name", `%${term}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const add = async (talentId: string) => {
    setAddingId(talentId);
    try {
      const res = await create({ data: { job_id: jobId, talent_id: talentId } });
      toast.success(res.existed ? "Candidato já estava na vaga" : "Candidato adicionado");
      onAdded();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
    finally { setAddingId(null); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Adicionar do banco de talentos</DialogTitle></DialogHeader>
        <Input placeholder="Buscar por nome..." value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="max-h-96 space-y-2 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : talents.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum candidato encontrado.</p>
          ) : talents.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{t.full_name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {[t.current_position, t.current_company].filter(Boolean).join(" • ") || "—"}
                </p>
                {Array.isArray(t.skills) && t.skills.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(t.skills as string[]).slice(0, 4).map((s) => (
                      <Badge key={s} variant="secondary" className="text-[10px] font-normal">{s}</Badge>
                    ))}
                  </div>
                )}
              </div>
              <Button size="sm" variant="outline" disabled={addingId === t.id} onClick={() => add(t.id)}>
                {addingId === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><UserPlus className="mr-1 h-4 w-4" />Adicionar</>}
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
