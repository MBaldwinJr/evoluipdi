import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/candidato/$token")({ component: CandidateForm });

function CandidateForm() {
  const { token } = Route.useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/public/candidate/${token}`);
        const json = await res.json();
        if (!res.ok) {
          setError(json.error === "expired" ? "Este link expirou." : "Link inválido ou não encontrado.");
        } else {
          setData(json);
          if (json.status === "respondido" || json.status === "analisado") setDone(true);
        }
      } catch { setError("Erro ao carregar."); } finally { setLoading(false); }
    })();
  }, [token]);

  const submit = async () => {
    if (!data) return;
    const questions: string[] = Array.isArray(data.questions) ? data.questions.map((q: any) => typeof q === "string" ? q : q.text ?? q.question ?? "") : [];
    const unanswered = questions.findIndex((_q, i) => !(answers[i] ?? "").trim());
    if (unanswered >= 0) { toast.error(`Responda todas as perguntas (faltou a #${unanswered + 1})`); return; }
    setSubmitting(true);
    try {
      const payload = { answers: questions.map((q, i) => ({ question: q, answer: answers[i] ?? "" })), notes };
      const res = await fetch(`/api/public/candidate/${token}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Falha ao enviar");
      setDone(true);
      toast.success("Respostas enviadas!");
    } catch (e: any) { toast.error(e.message); } finally { setSubmitting(false); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="max-w-md"><CardContent className="pt-6"><p className="text-destructive">{error}</p></CardContent></Card>
    </div>
  );

  if (done) return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="max-w-md text-center">
        <CardContent className="pt-6 space-y-3">
          <CheckCircle2 className="h-12 w-12 mx-auto text-primary" />
          <h1 className="text-xl font-semibold">Obrigado, {data?.candidate_name}!</h1>
          <p className="text-sm text-muted-foreground">Suas respostas foram registradas. A equipe entrará em contato em breve para os próximos passos.</p>
        </CardContent>
      </Card>
    </div>
  );

  const questions: any[] = Array.isArray(data?.questions) ? data.questions : [];

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary"><Sparkles className="h-5 w-5 text-primary-foreground" /></div>
          <div>
            <h1 className="text-2xl font-bold">Entrevista de seleção</h1>
            <p className="text-sm text-muted-foreground">Cargo: <span className="font-medium">{data?.role_title}</span></p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Olá, {data?.candidate_name}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Responda as perguntas abaixo com calma e o máximo de detalhes possível. Suas respostas serão analisadas e usadas como base para a entrevista presencial. Não é uma prova: queremos entender sua experiência e forma de pensar.
            </p>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {questions.map((q, i) => {
            const text = typeof q === "string" ? q : (q.text ?? q.question ?? "");
            return (
              <Card key={i}>
                <CardHeader className="pb-2"><CardTitle className="text-base">{i + 1}. {text}</CardTitle></CardHeader>
                <CardContent>
                  <Textarea
                    rows={4}
                    placeholder="Sua resposta…"
                    value={answers[i] ?? ""}
                    onChange={(e) => setAnswers((p) => ({ ...p, [i]: e.target.value }))}
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Algo a mais que queira compartilhar? (opcional)</CardTitle></CardHeader>
          <CardContent>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Considerações finais…" />
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button size="lg" onClick={submit} disabled={submitting}>
            {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando…</> : "Enviar respostas"}
          </Button>
        </div>
      </div>
    </div>
  );
}
