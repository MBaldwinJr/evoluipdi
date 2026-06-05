import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { MarketingLayout } from "@/components/marketing-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitLead } from "@/lib/leads.functions";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/contato")({
  head: () => ({
    meta: [
      { title: "Contato — Evolui" },
      { name: "description", content: "Fale com o time do Evolui. Tire dúvidas sobre planos, integrações ou solicite uma demonstração." },
      { property: "og:title", content: "Contato — Evolui" },
      { property: "og:description", content: "Estamos aqui para ajudar sua empresa a evoluir." },
      { property: "og:url", content: "https://evoluipdi.lovable.app/contato" },
    ],
    links: [{ rel: "canonical", href: "https://evoluipdi.lovable.app/contato" }],
  }),
  component: ContactPage,
});

function ContactPage() {
  const submitFn = useServerFn(submitLead);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "", message: "" });

  const mutation = useMutation({
    mutationFn: () => submitFn({ data: form }),
    onSuccess: () => {
      toast.success("Mensagem enviada! Retornaremos em breve.");
      setDone(true);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro ao enviar"),
  });

  return (
    <MarketingLayout>
      <section className="py-16">
        <div className="mx-auto max-w-2xl px-4">
          <div className="text-center">
            <h1 className="text-4xl font-bold">Fale com a gente</h1>
            <p className="mt-3 text-muted-foreground">Tire dúvidas, peça uma demo ou solicite um plano Enterprise.</p>
          </div>
          <Card className="mt-10 p-6">
            {done ? (
              <p className="text-center text-sm">Obrigado! Sua mensagem foi recebida. Retornaremos em breve.</p>
            ) : (
              <form
                onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
                className="space-y-4"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Nome *</Label>
                    <Input id="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email">E-mail *</Label>
                    <Input id="email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="company">Empresa</Label>
                    <Input id="company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="message">Mensagem</Label>
                  <Textarea id="message" rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Como podemos ajudar?" />
                </div>
                <Button type="submit" className="w-full" disabled={mutation.isPending}>
                  {mutation.isPending ? "Enviando..." : "Enviar mensagem"}
                </Button>
              </form>
            )}
          </Card>
        </div>
      </section>
    </MarketingLayout>
  );
}
