import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Briefcase, MapPin, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { listPublicJobs, type PublicJobListItem } from "@/lib/careers.functions";
import { WORK_MODEL_LABEL, EMPLOYMENT_TYPE_LABEL } from "@/lib/talent.types";

export const Route = createFileRoute("/trabalhe-conosco/")({ component: CareersListPage });

function formatSalary(min: number | null, max: number | null) {
  if (!min && !max) return null;
  const fmt = (n: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  return fmt((min ?? max)!);
}

function CareersListPage() {
  const [search, setSearch] = useState("");
  const [workModel, setWorkModel] = useState<string>("all");
  const [employmentType, setEmploymentType] = useState<string>("all");

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["public-jobs", search, workModel, employmentType],
    queryFn: () =>
      listPublicJobs({
        data: {
          search: search || undefined,
          workModel: workModel === "all" ? undefined : workModel,
          employmentType: employmentType === "all" ? undefined : employmentType,
        },
      }),
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Vagas abertas</h1>
        <p className="mt-2 text-muted-foreground">
          Encontre oportunidades em empresas que usam o Evolui para gestão de pessoas.
        </p>
      </header>

      <div className="mb-6 grid gap-3 md:grid-cols-[1fr_180px_180px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cargo, cidade ou empresa"
            className="pl-9"
          />
        </div>
        <Select value={workModel} onValueChange={setWorkModel}>
          <SelectTrigger><SelectValue placeholder="Modelo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os modelos</SelectItem>
            <SelectItem value="presencial">Presencial</SelectItem>
            <SelectItem value="hibrido">Híbrido</SelectItem>
            <SelectItem value="remoto">Remoto</SelectItem>
          </SelectContent>
        </Select>
        <Select value={employmentType} onValueChange={setEmploymentType}>
          <SelectTrigger><SelectValue placeholder="Contratação" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="clt">CLT</SelectItem>
            <SelectItem value="pj">PJ</SelectItem>
            <SelectItem value="estagio">Estágio</SelectItem>
            <SelectItem value="temporario">Temporário</SelectItem>
            <SelectItem value="aprendiz">Aprendiz</SelectItem>
            <SelectItem value="terceirizado">Terceirizado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      ) : jobs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Briefcase className="mx-auto mb-3 h-8 w-8 opacity-40" />
            Nenhuma vaga encontrada no momento.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {jobs.map((j: PublicJobListItem) => {
            const salary = formatSalary(j.salary_min, j.salary_max);
            return (
              <li key={j.id}>
                <Link
                  to="/trabalhe-conosco/$jobId"
                  params={{ jobId: j.id }}
                  className="block"
                >
                  <Card className="transition-colors hover:border-primary">
                    <CardContent className="flex flex-col gap-3 py-5 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <h2 className="truncate text-lg font-semibold">{j.title}</h2>
                        <p className="text-sm text-muted-foreground">{j.company_name}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {j.location && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {j.location}
                            </span>
                          )}
                          <Badge variant="secondary">
                            {WORK_MODEL_LABEL[j.work_model as keyof typeof WORK_MODEL_LABEL] ?? j.work_model}
                          </Badge>
                          <Badge variant="outline">
                            {EMPLOYMENT_TYPE_LABEL[j.employment_type as keyof typeof EMPLOYMENT_TYPE_LABEL] ?? j.employment_type}
                          </Badge>
                          {j.department_name && <Badge variant="outline">{j.department_name}</Badge>}
                        </div>
                      </div>
                      {salary && (
                        <div className="text-sm font-medium text-foreground md:text-right">{salary}</div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
