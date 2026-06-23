import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, MapPin, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { getPublicJob } from "@/lib/careers.functions";
import { WORK_MODEL_LABEL, EMPLOYMENT_TYPE_LABEL } from "@/lib/talent.types";

export const Route = createFileRoute("/trabalhe-conosco/$jobId")({
  component: JobDetailPage,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-3xl px-4 py-12 text-center">
      <p className="text-sm text-destructive">Erro: {error.message}</p>
      <Button asChild variant="link"><Link to="/trabalhe-conosco">Voltar para vagas</Link></Button>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-12 text-center">
      <p className="text-muted-foreground">Vaga não encontrada ou já encerrada.</p>
      <Button asChild variant="link"><Link to="/trabalhe-conosco">Ver outras vagas</Link></Button>
    </div>
  ),
});

function formatSalary(min: number | null, max: number | null) {
  if (!min && !max) return null;
  const fmt = (n: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  return fmt((min ?? max)!);
}

function JobDetailPage() {
  const { jobId } = Route.useParams();
  const { data: job, isLoading } = useQuery({
    queryKey: ["public-job", jobId],
    queryFn: async () => {
      const j = await getPublicJob({ data: { id: jobId } });
      if (!j) throw notFound();
      return j;
    },
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!job) return null;

  const salary = formatSalary(job.salary_min, job.salary_max);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link
        to="/trabalhe-conosco"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Todas as vagas
      </Link>

      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">{job.title}</h1>
        <p className="mt-1 text-muted-foreground">{job.company_name}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {job.location && (
            <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{job.location}</span>
          )}
          <Badge variant="secondary">
            {WORK_MODEL_LABEL[job.work_model as keyof typeof WORK_MODEL_LABEL] ?? job.work_model}
          </Badge>
          <Badge variant="outline">
            {EMPLOYMENT_TYPE_LABEL[job.employment_type as keyof typeof EMPLOYMENT_TYPE_LABEL] ?? job.employment_type}
          </Badge>
          {job.department_name && <Badge variant="outline">{job.department_name}</Badge>}
          {salary && <span className="font-medium text-foreground">{salary}</span>}
        </div>
      </header>

      {job.description && (
        <section className="prose prose-sm mb-6 max-w-none whitespace-pre-wrap text-foreground">
          {job.description}
        </section>
      )}

      {job.responsibilities && (
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">Responsabilidades</h2>
          <p className="whitespace-pre-wrap text-sm text-foreground">{job.responsibilities}</p>
        </section>
      )}

      {job.requirements && (
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">Requisitos</h2>
          <p className="whitespace-pre-wrap text-sm text-foreground">{job.requirements}</p>
        </section>
      )}

      {Array.isArray(job.benefits) && job.benefits.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-2 text-lg font-semibold">Benefícios</h2>
          <ul className="flex flex-wrap gap-2">
            {job.benefits.map((b: string) => <Badge key={b} variant="secondary">{b}</Badge>)}
          </ul>
        </section>
      )}

      <ApplicationForm jobId={job.id} />
    </div>
  );
}

function ApplicationForm({ jobId }: { jobId: string }) {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [lgpd, setLgpd] = useState(false);

  if (done) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <CheckCircle2 className="h-10 w-10 text-primary" />
          <h3 className="text-lg font-semibold">Candidatura enviada!</h3>
          <p className="text-sm text-muted-foreground">
            Recebemos seu currículo. A empresa entrará em contato se houver match com a vaga.
          </p>
          <Button asChild variant="outline"><Link to="/trabalhe-conosco">Ver outras vagas</Link></Button>
        </CardContent>
      </Card>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!lgpd) {
      toast.error("É necessário aceitar o aviso de privacidade (LGPD).");
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData(e.currentTarget);
      fd.set("job_id", jobId);
      fd.set("lgpd_consent", "true");
      const res = await fetch("/api/public/apply", { method: "POST", body: fd });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      setDone(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao enviar candidatura");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Candidatar-se a esta vaga</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="full_name">Nome completo *</Label>
              <Input id="full_name" name="full_name" required minLength={2} maxLength={200} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail *</Label>
              <Input id="email" name="email" type="email" required maxLength={200} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Telefone</Label>
              <Input id="phone" name="phone" maxLength={40} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="location">Cidade/UF</Label>
              <Input id="location" name="location" maxLength={200} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="linkedin_url">LinkedIn</Label>
              <Input id="linkedin_url" name="linkedin_url" type="url" maxLength={400} placeholder="https://..." />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="current_position">Cargo atual</Label>
              <Input id="current_position" name="current_position" maxLength={200} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="years_experience">Anos de experiência</Label>
              <Input id="years_experience" name="years_experience" type="number" min={0} max={60} defaultValue={0} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cv">Currículo (PDF ou DOCX)</Label>
              <Input id="cv" name="cv" type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="summary">Apresentação (opcional)</Label>
            <Textarea id="summary" name="summary" rows={4} maxLength={2000} placeholder="Conte brevemente sobre você." />
          </div>

          <label className="flex items-start gap-3 rounded-md border bg-muted/40 p-3">
            <Checkbox checked={lgpd} onCheckedChange={(v) => setLgpd(v === true)} className="mt-0.5" />
            <span className="text-sm text-muted-foreground">
              Autorizo o tratamento dos meus dados pessoais para fins de processo seletivo, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018). Os dados poderão ser compartilhados com a empresa contratante e mantidos no banco de talentos.
            </span>
          </label>

          <Button type="submit" disabled={submitting} className="w-full md:w-auto">
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enviar candidatura
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
