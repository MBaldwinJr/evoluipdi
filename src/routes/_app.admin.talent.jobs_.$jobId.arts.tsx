import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { toPng, toJpeg } from "html-to-image";
import jsPDF from "jspdf";
import {
  ArrowLeft, Copy, Download, Loader2, Sparkles, Wand2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { generateJobCopy, type JobArtCopy } from "@/lib/job-arts.functions";
import {
  JobArt, FORMATS, TEMPLATES, formatCurrency,
  type ArtFormat, type ArtTemplate,
} from "@/components/talent/job-art";

export const Route = createFileRoute("/_app/admin/talent/jobs_/$jobId/arts")({
  component: JobArtsPage,
});

type JobFull = {
  id: string;
  title: string;
  location: string | null;
  work_model: string;
  employment_type: string;
  salary_min: number | null;
  salary_max: number | null;
  benefits: string[];
  department: { name: string | null } | null;
  org: { trade_name: string | null; legal_name: string } | null;
};

const FORMAT_KEYS = Object.keys(FORMATS) as ArtFormat[];
const TEMPLATE_KEYS = Object.keys(TEMPLATES) as ArtTemplate[];

const DEPT_TEMPLATE: Array<{ test: RegExp; tpl: ArtTemplate }> = [
  { test: /tech|ti|desenvolv|software|dados/i, tpl: "tecnologia" },
  { test: /sa[uú]de|enferm|m[eé]dic|hospital|cl[ií]nic/i, tpl: "saude" },
  { test: /log[ií]stic|transport|frota|armaz/i, tpl: "logistica" },
  { test: /constru|obra|engenharia civil|el[eé]tric|hidr[aá]ulic/i, tpl: "construcao" },
  { test: /executiv|diretor|c-?level|premium/i, tpl: "premium" },
];

function pickTemplate(job: JobFull): ArtTemplate {
  const hay = `${job.title} ${job.department?.name ?? ""}`;
  for (const r of DEPT_TEMPLATE) if (r.test.test(hay)) return r.tpl;
  return "corporativo";
}

function JobArtsPage() {
  const { jobId } = Route.useParams();
  const [format, setFormat] = useState<ArtFormat>("feed");
  const [template, setTemplate] = useState<ArtTemplate>("corporativo");
  const [copy, setCopy] = useState<JobArtCopy | null>(null);
  const [loadingCopy, setLoadingCopy] = useState(false);
  const [autoLoading, setAutoLoading] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = useState<string>("");
  const [secondaryColor, setSecondaryColor] = useState<string>("");
  const previewRef = useRef<HTMLDivElement>(null);

  function onLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Selecione uma imagem"); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("Logo deve ter até 2MB"); return; }
    const reader = new FileReader();
    reader.onload = () => setLogoUrl(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
  }

  const { data: job, isLoading } = useQuery({
    queryKey: ["talent-job-arts", jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("id, title, location, work_model, employment_type, salary_min, salary_max, benefits, department:departments(name), org:orgs(trade_name, legal_name)")
        .eq("id", jobId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as JobFull;
    },
  });

  const publicUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/trabalhe-conosco/${jobId}`;
  }, [jobId]);

  async function onGenerateCopy() {
    setLoadingCopy(true);
    try {
      const result = await generateJobCopy({ data: { jobId } });
      setCopy(result);
      toast.success("Textos gerados pela IA");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao gerar textos");
    } finally { setLoadingCopy(false); }
  }

  async function onAutoGenerate() {
    if (!job) return;
    setAutoLoading(true);
    try {
      setTemplate(pickTemplate(job));
      const result = await generateJobCopy({ data: { jobId } });
      setCopy(result);
      toast.success("Arte gerada automaticamente");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao gerar arte");
    } finally { setAutoLoading(false); }
  }

  function getNode(): HTMLElement | null {
    return previewRef.current?.querySelector("[data-art-canvas]") as HTMLElement | null;
  }

  async function download(kind: "png" | "jpg" | "pdf") {
    const node = getNode();
    if (!node) return;
    const { w, h } = FORMATS[format];
    try {
      const opts = { cacheBust: true, pixelRatio: 1, width: w, height: h };
      const dataUrl = kind === "jpg"
        ? await toJpeg(node, { ...opts, quality: 0.95, backgroundColor: "#ffffff" })
        : await toPng(node, opts);
      const baseName = `vaga-${job?.title ?? "arte"}-${format}`;
      if (kind === "pdf") {
        const pdf = new jsPDF({ orientation: w > h ? "l" : "p", unit: "px", format: [w, h] });
        pdf.addImage(dataUrl, "PNG", 0, 0, w, h);
        pdf.save(`${baseName}.pdf`);
      } else {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `${baseName}.${kind}`;
        a.click();
      }
    } catch { toast.error("Falha ao exportar"); }
  }

  function copyText(s: string) {
    navigator.clipboard.writeText(s).then(() => toast.success("Copiado!"));
  }

  if (isLoading || !job) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-6">
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const company = job.org?.trade_name ?? job.org?.legal_name ?? "Sua empresa";
  const salary = formatCurrency(job.salary_min, job.salary_max);

  const headline = copy?.headline ?? job.title;
  const subhead = copy?.subhead ?? `${company} • ${job.location ?? "Brasil"}`;
  const cta = copy?.cta ?? "Candidate-se agora";

  const { w, h } = FORMATS[format];
  const maxPx = 480;
  const scale = Math.min(maxPx / w, (maxPx * 1.5) / h);

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6">
      <Link to="/admin/talent/jobs" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Vagas
      </Link>

      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Marketing da vaga</h1>
          <p className="text-sm text-muted-foreground">{job.title} • {company}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onAutoGenerate} disabled={autoLoading}>
            {autoLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
            Gerar arte automaticamente
          </Button>
          <Button variant="outline" onClick={onGenerateCopy} disabled={loadingCopy}>
            {loadingCopy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Regenerar copy
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary"><Download className="mr-2 h-4 w-4" /> Baixar</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => download("png")}>PNG (alta resolução)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => download("jpg")}>JPG</DropdownMenuItem>
              <DropdownMenuItem onClick={() => download("pdf")}>PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Configurações</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Formato</label>
                <Select value={format} onValueChange={(v) => setFormat(v as ArtFormat)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FORMAT_KEYS.map((k) => <SelectItem key={k} value={k}>{FORMATS[k].label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Template</label>
                <Select value={template} onValueChange={(v) => setTemplate(v as ArtTemplate)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_KEYS.map((k) => <SelectItem key={k} value={k}>{TEMPLATES[k].name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium">Cor principal</label>
                  <Input type="color" value={primaryColor || TEMPLATES[template].accent} onChange={(e) => setPrimaryColor(e.target.value)} className="h-9 p-1" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium">Cor secundária</label>
                  <Input type="color" value={secondaryColor || TEMPLATES[template].muted} onChange={(e) => setSecondaryColor(e.target.value)} className="h-9 p-1" />
                </div>
              </div>
              {(primaryColor || secondaryColor) && (
                <Button size="sm" variant="ghost" onClick={() => { setPrimaryColor(""); setSecondaryColor(""); }}>
                  Restaurar cores do template
                </Button>
              )}
              <div>
                <label className="mb-1.5 block text-sm font-medium">Logo da empresa</label>
                <div className="flex items-center gap-2">
                  <input
                    type="file" accept="image/*" onChange={onLogoUpload}
                    className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-muted/70"
                  />
                  {logoUrl && <Button size="sm" variant="ghost" onClick={() => setLogoUrl(null)}>Remover</Button>}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                QR Code: <span className="break-all text-foreground">{publicUrl}</span>
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <div className="overflow-auto rounded-md border bg-muted/30 p-6">
            <div ref={previewRef} style={{ width: w * scale, height: h * scale, margin: "0 auto" }}>
              <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: w, height: h }}>
                <JobArt
                  format={format} template={template} company={company}
                  headline={headline} subhead={subhead} cta={cta}
                  location={job.location} workModel={job.work_model} salary={salary}
                  benefits={Array.isArray(job.benefits) ? job.benefits : []}
                  publicUrl={publicUrl} logoUrl={logoUrl}
                  primaryColor={primaryColor || null}
                  secondaryColor={secondaryColor || null}
                />
              </div>
            </div>
          </div>

          {copy && (
            <Card>
              <CardHeader><CardTitle className="text-base">Central de marketing</CardTitle></CardHeader>
              <CardContent>
                <Tabs defaultValue="social">
                  <TabsList className="flex flex-wrap">
                    <TabsTrigger value="social">Redes sociais</TabsTrigger>
                    <TabsTrigger value="ad">Anúncio</TabsTrigger>
                    <TabsTrigger value="reels">Reels</TabsTrigger>
                    <TabsTrigger value="meta">Título & hashtags</TabsTrigger>
                  </TabsList>

                  <TabsContent value="social" className="space-y-3">
                    <Tabs defaultValue="instagram">
                      <TabsList className="grid grid-cols-4">
                        <TabsTrigger value="instagram">Instagram</TabsTrigger>
                        <TabsTrigger value="facebook">Facebook</TabsTrigger>
                        <TabsTrigger value="linkedin">LinkedIn</TabsTrigger>
                        <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
                      </TabsList>
                      {(["instagram", "facebook", "linkedin", "whatsapp"] as const).map((k) => (
                        <TabsContent key={k} value={k} className="space-y-2">
                          <Textarea rows={8} value={copy[k]} readOnly />
                          <Button size="sm" variant="outline" onClick={() => copyText(copy[k])}>
                            <Copy className="mr-2 h-3 w-3" /> Copiar
                          </Button>
                        </TabsContent>
                      ))}
                    </Tabs>
                  </TabsContent>

                  <TabsContent value="ad" className="space-y-2">
                    <Textarea rows={5} value={copy.sponsoredAd} readOnly />
                    <Button size="sm" variant="outline" onClick={() => copyText(copy.sponsoredAd)}>
                      <Copy className="mr-2 h-3 w-3" /> Copiar anúncio
                    </Button>
                  </TabsContent>

                  <TabsContent value="reels" className="space-y-3">
                    <div>
                      <p className="mb-1 text-xs font-medium text-muted-foreground">Roteiro (15s)</p>
                      <Textarea rows={4} value={copy.reels.script} readOnly />
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-medium text-muted-foreground">Storyboard</p>
                      <ol className="ml-5 list-decimal space-y-1 text-sm">
                        {copy.reels.storyboard.map((s, i) => <li key={i}>{s}</li>)}
                      </ol>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <p className="mb-1 text-xs font-medium text-muted-foreground">Legenda</p>
                        <Textarea rows={4} value={copy.reels.caption} readOnly />
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-medium text-muted-foreground">CTA</p>
                        <Textarea rows={4} value={copy.reels.cta} readOnly />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="meta" className="space-y-3">
                    <div>
                      <p className="mb-1 text-xs font-medium text-muted-foreground">Título otimizado</p>
                      <Input value={copy.titleOptimized} readOnly />
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-medium text-muted-foreground">Headline</p>
                      <Input value={copy.headline} readOnly />
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-medium text-muted-foreground">CTA</p>
                      <Input value={copy.cta} readOnly />
                    </div>
                    {copy.hashtags.length > 0 && (
                      <div>
                        <p className="mb-1 text-xs font-medium text-muted-foreground">Hashtags</p>
                        <div className="flex flex-wrap gap-1.5 text-xs">
                          {copy.hashtags.map((h) => (
                            <button key={h} onClick={() => copyText(`#${h}`)} className="rounded-full bg-muted px-2 py-0.5 hover:bg-muted/70">
                              #{h}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
