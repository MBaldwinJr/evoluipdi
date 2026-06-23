import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Copy, Download, ExternalLink, QrCode, Share2 } from "lucide-react";

export const Route = createFileRoute("/_app/admin/talent/settings")({
  component: TalentSettings,
});

function TalentSettings() {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const careersUrl = `${origin}/trabalhe-conosco`;
  const [size, setSize] = useState(320);

  const qrUrl = useMemo(
    () =>
      `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(careersUrl)}`,
    [careersUrl, size],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(careersUrl);
      toast.success("Link copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const share = async () => {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title: "Trabalhe Conosco", url: careersUrl });
      } catch {
        /* user cancelled */
      }
    } else {
      copy();
    }
  };

  const download = async () => {
    try {
      const res = await fetch(qrUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `qr-trabalhe-conosco-${size}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Falha ao baixar QR Code");
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Share2 className="h-4 w-4" /> Portal de Carreiras
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label className="text-xs">Link público</Label>
            <div className="flex gap-2">
              <Input readOnly value={careersUrl} className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={copy} title="Copiar">
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" asChild title="Abrir">
                <a href={careersUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Compartilhe este link em redes sociais, e-mail e materiais
              institucionais para divulgar todas as vagas abertas.
            </p>
          </div>
          <Button onClick={share} className="w-full">
            <Share2 className="mr-2 h-4 w-4" /> Compartilhar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <QrCode className="h-4 w-4" /> QR Code
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-center rounded-md border bg-white p-4">
            <img
              src={qrUrl}
              alt="QR Code do portal de carreiras"
              width={size}
              height={size}
              className="h-auto w-full max-w-xs"
            />
          </div>
          <div className="grid gap-2">
            <Label className="text-xs">Tamanho ({size}px)</Label>
            <input
              type="range"
              min={160}
              max={800}
              step={40}
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              className="w-full"
            />
          </div>
          <Button onClick={download} variant="outline" className="w-full">
            <Download className="mr-2 h-4 w-4" /> Baixar PNG
          </Button>
          <p className="text-xs text-muted-foreground">
            Use o QR Code em cartazes, folders, crachás e eventos. Ao escanear,
            o candidato vai direto para o portal de vagas.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
