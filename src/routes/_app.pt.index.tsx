import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ptGetMyEmployee, ptListMyTodayPunches, ptRegisterPunch } from "@/lib/pt.functions";
import { usePtCompany } from "@/lib/pt-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MapPin, Camera, LogIn, LogOut, Coffee, Play } from "lucide-react";

export const Route = createFileRoute("/_app/pt/")({
  component: PunchPage,
});

type PunchKind = "entrada" | "saida" | "inicio_intervalo" | "fim_intervalo";

function PunchPage() {
  const { current } = usePtCompany();
  const qc = useQueryClient();
  const empFn = useServerFn(ptGetMyEmployee);
  const todayFn = useServerFn(ptListMyTodayPunches);
  const registerFn = useServerFn(ptRegisterPunch);

  const emp = useQuery({
    queryKey: ["pt", "me", current?.id],
    queryFn: () => empFn({ data: { company_id: current!.id } }),
    enabled: !!current,
  });
  const punches = useQuery({
    queryKey: ["pt", "punches-today", current?.id],
    queryFn: () => todayFn({ data: { company_id: current!.id } }),
    enabled: !!current,
  });

  const [pos, setPos] = useState<GeolocationPosition | null>(null);
  const [geoErr, setGeoErr] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<PunchKind | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!("geolocation" in navigator)) { setGeoErr("Geolocalização não disponível"); return; }
    const id = navigator.geolocation.watchPosition(
      (p) => { setPos(p); setGeoErr(null); },
      (e) => setGeoErr(e.message),
      { enableHighAccuracy: true, maximumAge: 10000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      setShowCamera(true);
      setTimeout(() => { if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); } }, 50);
    } catch (e: any) {
      toast.error("Não foi possível acessar a câmera: " + e.message);
    }
  };

  const closeCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setShowCamera(false);
  };

  const capture = () => {
    if (!videoRef.current) return;
    const v = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = 480; canvas.height = (480 * v.videoHeight) / v.videoWidth;
    canvas.getContext("2d")!.drawImage(v, 0, 0, canvas.width, canvas.height);
    setSelfie(canvas.toDataURL("image/jpeg", 0.75));
    closeCamera();
  };

  const submit = async (kind: PunchKind) => {
    if (!current) return;
    setSubmitting(kind);
    try {
      await registerFn({
        data: {
          company_id: current.id,
          kind,
          lat: pos?.coords.latitude ?? null,
          lng: pos?.coords.longitude ?? null,
          accuracy_m: pos?.coords.accuracy ?? null,
          selfie_base64: selfie,
          device_info: { ua: navigator.userAgent },
        },
      });
      toast.success("Batida registrada!");
      setSelfie(null);
      qc.invalidateQueries({ queryKey: ["pt", "punches-today"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally { setSubmitting(null); }
  };

  if (!current) return null;
  if (emp.isLoading) return <div>Carregando...</div>;
  if (!emp.data) {
    return <Card><CardContent className="py-6 text-center text-muted-foreground">Você ainda não está cadastrado como funcionário desta empresa. Peça ao RH para cadastrar seu vínculo.</CardContent></Card>;
  }

  const last = (punches.data ?? []).slice(-4);
  const branch: any = (emp.data as any).branch;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Olá, {(emp.data as any).full_name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            {pos ? (
              <span>GPS: {pos.coords.latitude.toFixed(5)}, {pos.coords.longitude.toFixed(5)} (±{Math.round(pos.coords.accuracy)}m)</span>
            ) : (
              <span className="text-muted-foreground">{geoErr || "Aguardando GPS..."}</span>
            )}
          </div>
          {branch && (
            <div className="text-sm text-muted-foreground">
              Filial: <strong>{branch.name}</strong> (raio {branch.geofence_radius_m}m)
            </div>
          )}

          <div className="flex items-center gap-3">
            {selfie ? (
              <>
                <img src={selfie} alt="selfie" className="h-20 w-20 rounded-md object-cover border" />
                <Button variant="outline" size="sm" onClick={() => setSelfie(null)}>Remover</Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={openCamera}><Camera className="mr-1 h-4 w-4" />Tirar selfie</Button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button onClick={() => submit("entrada")} disabled={!!submitting}><LogIn className="mr-1 h-4 w-4" />Entrada</Button>
            <Button onClick={() => submit("inicio_intervalo")} disabled={!!submitting} variant="secondary"><Coffee className="mr-1 h-4 w-4" />Início intervalo</Button>
            <Button onClick={() => submit("fim_intervalo")} disabled={!!submitting} variant="secondary"><Play className="mr-1 h-4 w-4" />Fim intervalo</Button>
            <Button onClick={() => submit("saida")} disabled={!!submitting} variant="destructive"><LogOut className="mr-1 h-4 w-4" />Saída</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Batidas de hoje</CardTitle></CardHeader>
        <CardContent>
          {last.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma batida ainda.</p>
          ) : (
            <ul className="space-y-2">
              {last.map((p: any) => (
                <li key={p.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-b-0">
                  <span className="font-medium capitalize">{p.kind.replace("_", " ")}</span>
                  <span className="text-muted-foreground">{new Date(p.ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                  {p.inside_geofence === false && <Badge variant="destructive">fora da cerca</Badge>}
                  {p.status === "pendente" && <Badge variant="secondary">pendente</Badge>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {showCamera && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={closeCamera}>
          <div className="bg-card rounded-lg p-4 space-y-3 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <video ref={videoRef} className="w-full rounded-md bg-black" playsInline muted />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeCamera}>Cancelar</Button>
              <Button onClick={capture}>Capturar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
