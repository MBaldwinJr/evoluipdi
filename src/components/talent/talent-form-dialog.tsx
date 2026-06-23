import { useState } from "react";
import { useForm } from "react-hook-form";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { TagListEditor } from "./tag-list-editor";
import {
  talentSchema, type TalentInput, TALENT_STATUS_LABEL, type TalentStatus,
} from "@/lib/talent-pool.types";
import { upsertTalent } from "@/lib/talent-pool.functions";

const emptyTalent: TalentInput = {
  full_name: "", years_experience: 0, skills: [], tags: [],
  source: "manual", status: "active",
};

export function TalentFormDialog({
  open, onOpenChange, initial, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: TalentInput | null;
  onSaved: () => void;
}) {
  const save = useServerFn(upsertTalent);
  const [saving, setSaving] = useState(false);
  const form = useForm<TalentInput>({ values: initial ?? emptyTalent });
  const { register, handleSubmit, watch, setValue } = form;

  const onSubmit = handleSubmit(async (raw) => {
    const parsed = talentSchema.safeParse(raw);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Inválido"); return; }
    setSaving(true);
    try {
      await save({ data: parsed.data });
      toast.success("Candidato salvo");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally { setSaving(false); }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Editar candidato" : "Novo candidato"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2 grid gap-2">
            <Label>Nome completo *</Label>
            <Input {...register("full_name")} />
            {errors.full_name && <p className="text-xs text-destructive">{errors.full_name.message}</p>}
          </div>
          <div className="grid gap-2">
            <Label>E-mail</Label>
            <Input type="email" {...register("email")} />
          </div>
          <div className="grid gap-2">
            <Label>Telefone</Label>
            <Input {...register("phone")} />
          </div>
          <div className="grid gap-2">
            <Label>Cidade / UF</Label>
            <Input {...register("location")} />
          </div>
          <div className="grid gap-2">
            <Label>LinkedIn</Label>
            <Input {...register("linkedin_url")} placeholder="https://linkedin.com/in/..." />
          </div>
          <div className="grid gap-2">
            <Label>Cargo atual</Label>
            <Input {...register("current_position")} />
          </div>
          <div className="grid gap-2">
            <Label>Empresa atual</Label>
            <Input {...register("current_company")} />
          </div>
          <div className="grid gap-2">
            <Label>Anos de experiência</Label>
            <Input type="number" min={0} {...register("years_experience", { valueAsNumber: true })} />
          </div>
          <div className="grid gap-2">
            <Label>Status</Label>
            <Select
              value={watch("status")}
              onValueChange={(v) => setValue("status", v as TalentStatus, { shouldDirty: true })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(TALENT_STATUS_LABEL) as TalentStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{TALENT_STATUS_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 grid gap-2">
            <Label>Competências</Label>
            <TagListEditor
              value={watch("skills") ?? []}
              onChange={(v) => setValue("skills", v, { shouldDirty: true })}
              placeholder="React, SQL, Liderança..."
            />
          </div>
          <div className="md:col-span-2 grid gap-2">
            <Label>Tags</Label>
            <TagListEditor
              value={watch("tags") ?? []}
              onChange={(v) => setValue("tags", v, { shouldDirty: true })}
              placeholder="Banco de talentos, Indicação..."
            />
          </div>
          <div className="md:col-span-2 grid gap-2">
            <Label>Resumo profissional</Label>
            <Textarea rows={5} {...register("summary")} />
          </div>
          <DialogFooter className="md:col-span-2">
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
