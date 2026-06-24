import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { EmptyState } from "@/components/page-header";
import { TagListEditor } from "@/components/talent/tag-list-editor";
import { positionKpiSchema, type PositionKpiInput } from "@/lib/talent.types";
import { upsertPositionKpi, suggestPositionKpi } from "@/lib/talent.functions";

export const Route = createFileRoute("/_app/admin/talent/kpis")({ component: KpisPage });

const empty = (role_id: string): PositionKpiInput => ({
  role_id, experience_years: 0, mandatory_courses: [], mandatory_certifications: [],
  required_skills: [], soft_skills: [], benefits: [], travel_required: false,
});

function KpisPage() {
  const { isRH } = useAuth();
  const qc = useQueryClient();
  const [roleId, setRoleId] = useState<string>("");
  const [form, setForm] = useState<PositionKpiInput | null>(null);
  const [saving, setSaving] = useState(false);
  const save = useServerFn(upsertPositionKpi);

  const { data: roles = [] } = useQuery({
    queryKey: ["talent-roles-all"],
    queryFn: async () => (await supabase.from("roles_catalog").select("id,title").order("title")).data ?? [],
  });

  const { data: kpi } = useQuery({
    queryKey: ["position-kpi", roleId],
    enabled: !!roleId,
    queryFn: async () => (await supabase.from("position_kpis").select("*").eq("role_id", roleId).maybeSingle()).data,
  });

  useEffect(() => {
    if (!roleId) { setForm(null); return; }
    if (kpi) {
      setForm({
        id: kpi.id, role_id: kpi.role_id,
        education_required: kpi.education_required,
        experience_years: kpi.experience_years ?? 0,
        mandatory_courses: (kpi.mandatory_courses as string[]) ?? [],
        mandatory_certifications: (kpi.mandatory_certifications as string[]) ?? [],
        required_skills: (kpi.required_skills as string[]) ?? [],
        soft_skills: (kpi.soft_skills as string[]) ?? [],
        benefits: (kpi.benefits as string[]) ?? [],
        salary_reference: kpi.salary_reference,
        work_schedule: kpi.work_schedule,
        work_location: kpi.work_location,
        travel_required: kpi.travel_required ?? false,
        driver_license: kpi.driver_license,
      });
    } else {
      setForm(empty(roleId));
    }
  }, [roleId, kpi]);

  if (!isRH) return <EmptyState title="Acesso restrito" description="Apenas RH." />;

  const setField = <K extends keyof PositionKpiInput>(k: K, v: PositionKpiInput[K]) =>
    setForm((f) => (f ? { ...f, [k]: v } : f));

  const submit = async () => {
    if (!form) return;
    const parsed = positionKpiSchema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Inválido"); return; }
    setSaving(true);
    try {
      await save({ data: parsed.data });
      toast.success("KPIs salvos");
      qc.invalidateQueries({ queryKey: ["position-kpi", roleId] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Label className="text-sm">Cargo:</Label>
        <Select value={roleId} onValueChange={setRoleId}>
          <SelectTrigger className="w-80"><SelectValue placeholder="Selecione um cargo" /></SelectTrigger>
          <SelectContent>
            {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {!form ? (
        <EmptyState title="Selecione um cargo" description="Os KPIs são definidos por cargo (RCF). Crie cargos em RH > Cargos & RCF." />
      ) : (
        <Card>
          <CardContent className="grid gap-4 p-6 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>Formação exigida</Label>
              <Input value={form.education_required ?? ""} onChange={(e) => setField("education_required", e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Anos de experiência</Label>
              <Input type="number" min={0} value={form.experience_years} onChange={(e) => setField("experience_years", Number(e.target.value))} />
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label>Cursos obrigatórios</Label>
              <TagListEditor value={form.mandatory_courses} onChange={(v) => setField("mandatory_courses", v)} />
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label>Certificações obrigatórias</Label>
              <TagListEditor value={form.mandatory_certifications} onChange={(v) => setField("mandatory_certifications", v)} placeholder="Ex: NR10, NR35" />
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label>Competências técnicas</Label>
              <TagListEditor value={form.required_skills} onChange={(v) => setField("required_skills", v)} />
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label>Soft skills</Label>
              <TagListEditor value={form.soft_skills} onChange={(v) => setField("soft_skills", v)} />
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label>Benefícios</Label>
              <TagListEditor value={form.benefits} onChange={(v) => setField("benefits", v)} />
            </div>
            <div className="grid gap-2">
              <Label>Salário referência (R$)</Label>
              <Input type="number" value={form.salary_reference ?? ""} onChange={(e) => setField("salary_reference", e.target.value ? Number(e.target.value) : null)} />
            </div>
            <div className="grid gap-2">
              <Label>Jornada</Label>
              <Input value={form.work_schedule ?? ""} onChange={(e) => setField("work_schedule", e.target.value)} placeholder="Ex: 44h semanais, segunda a sexta" />
            </div>
            <div className="grid gap-2">
              <Label>Local de trabalho</Label>
              <Input value={form.work_location ?? ""} onChange={(e) => setField("work_location", e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>CNH</Label>
              <Input value={form.driver_license ?? ""} onChange={(e) => setField("driver_license", e.target.value)} placeholder="Ex: B" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.travel_required} onCheckedChange={(v) => setField("travel_required", v)} />
              <Label>Requer viagens</Label>
            </div>

            <div className="md:col-span-2 flex justify-end">
              <Button onClick={submit} disabled={saving}>
                {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                Salvar KPIs
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
