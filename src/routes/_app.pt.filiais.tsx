import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ptListBranches, ptUpsertBranch } from "@/lib/pt.functions";
import { usePtCompany } from "@/lib/pt-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, MapPin } from "lucide-react";

export const Route = createFileRoute("/_app/pt/filiais")({
  component: BranchesPage,
});

function BranchesPage() {
  const { current } = usePtCompany();
  const qc = useQueryClient();
  const fn = useServerFn(ptListBranches);
  const q = useQuery({
    queryKey: ["pt", "branches", current?.id],
    queryFn: () => fn({ data: { company_id: current!.id } }),
    enabled: !!current,
  });

  if (!current) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Filiais</CardTitle>
        <BranchDialog onSaved={() => qc.invalidateQueries({ queryKey: ["pt", "branches"] })} />
      </CardHeader>
      <CardContent>
        {q.isLoading ? <div>Carregando...</div> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Nome</TableHead><TableHead>Endereço</TableHead><TableHead>Coordenadas</TableHead><TableHead>Raio</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(q.data ?? []).map((b: any) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{b.address}</TableCell>
                  <TableCell className="text-xs font-mono">{b.lat != null ? `${b.lat.toFixed(5)}, ${b.lng?.toFixed(5)}` : "—"}</TableCell>
                  <TableCell>{b.geofence_radius_m}m</TableCell>
                  <TableCell><BranchDialog branch={b} onSaved={() => qc.invalidateQueries({ queryKey: ["pt", "branches"] })} /></TableCell>
                </TableRow>
              ))}
              {(q.data ?? []).length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhuma filial.</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function BranchDialog({ branch, onSaved }: { branch?: any; onSaved: () => void }) {
  const { current } = usePtCompany();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => ({
    name: branch?.name ?? "",
    address: branch?.address ?? "",
    lat: branch?.lat?.toString() ?? "",
    lng: branch?.lng?.toString() ?? "",
    geofence_radius_m: branch?.geofence_radius_m?.toString() ?? "200",
  }));
  const [loading, setLoading] = useState(false);
  const fn = useServerFn(ptUpsertBranch);

  const useGPS = () => {
    navigator.geolocation.getCurrentPosition(
      (p) => setForm((f) => ({ ...f, lat: p.coords.latitude.toFixed(6), lng: p.coords.longitude.toFixed(6) })),
      (e) => toast.error(e.message),
      { enableHighAccuracy: true },
    );
  };

  const submit = async () => {
    setLoading(true);
    try {
      await fn({
        data: {
          id: branch?.id,
          company_id: current!.id,
          name: form.name,
          address: form.address || null,
          lat: form.lat ? Number(form.lat) : null,
          lng: form.lng ? Number(form.lng) : null,
          geofence_radius_m: Number(form.geofence_radius_m),
          active: true,
        },
      });
      toast.success("Salvo");
      setOpen(false); onSaved();
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {branch
          ? <Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button>
          : <Button size="sm"><Plus className="mr-1 h-4 w-4" />Nova filial</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{branch ? "Editar filial" : "Nova filial"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Endereço</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Latitude</Label><Input value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} /></div>
            <div><Label>Longitude</Label><Input value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} /></div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={useGPS}><MapPin className="mr-1 h-4 w-4" />Usar minha localização</Button>
          <div><Label>Raio cerca (metros)</Label><Input type="number" value={form.geofence_radius_m} onChange={(e) => setForm({ ...form, geofence_radius_m: e.target.value })} /></div>
        </div>
        <DialogFooter><Button onClick={submit} disabled={loading || !form.name}>Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
