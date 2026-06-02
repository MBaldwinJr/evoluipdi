import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
  Handle,
  Position,
  addEdge,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Play, Square, Diamond, ListChecks, Wand2, Save, Trash2 } from "lucide-react";
import type { FlowDoc, FlowNode, FlowEdge } from "@/lib/flow.functions";

type StepData = { type: FlowNode["type"]; label: string; description: string | null; owner: string | null };

function StepNode({ data, type }: NodeProps<Node<StepData>>) {
  const kind = (type ?? data.type) as FlowNode["type"];
  const styles: Record<FlowNode["type"], string> = {
    start: "bg-emerald-500/10 border-emerald-500/50 text-emerald-700 dark:text-emerald-300",
    task: "bg-card border-border",
    decision: "bg-amber-500/10 border-amber-500/50 text-amber-700 dark:text-amber-300 rotate-45 [&_*]:rotate-[-45deg]",
    end: "bg-rose-500/10 border-rose-500/50 text-rose-700 dark:text-rose-300",
  };
  const Icon = kind === "start" ? Play : kind === "end" ? Square : kind === "decision" ? Diamond : ListChecks;
  return (
    <div className={`relative flex h-[80px] w-[200px] items-center justify-center rounded-md border shadow-sm p-2 ${styles[kind]}`}>
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground/40" />
      <div className="flex items-center gap-2 text-center text-sm font-medium">
        <Icon className="h-4 w-4 shrink-0" />
        <span className="line-clamp-2">{data.label}</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground/40" />
    </div>
  );
}

const nodeTypes = { start: StepNode, task: StepNode, decision: StepNode, end: StepNode };

const NW = 220;
const NH = 100;
function autoLayout(nodes: Node[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", ranksep: 80, nodesep: 40 });
  g.setDefaultEdgeLabel(() => ({}));
  nodes.forEach((n) => g.setNode(n.id, { width: NW, height: NH }));
  edges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);
  return nodes.map((n) => {
    const p = g.node(n.id);
    return { ...n, position: { x: p.x - NW / 2, y: p.y - NH / 2 } };
  });
}

let _id = 0;
const nextId = () => `n_${Date.now().toString(36)}_${_id++}`;

function Inner({
  initial,
  readOnly,
  onSave,
}: {
  initial: FlowDoc;
  readOnly?: boolean;
  onSave?: (doc: FlowDoc) => Promise<void> | void;
}) {
  const initNodes: Node[] = useMemo(
    () =>
      initial.nodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position ?? { x: 0, y: 0 },
        data: { type: n.type, label: n.label, description: n.description ?? null, owner: n.owner ?? null } as StepData,
      })),
    [initial],
  );
  const initEdges: Edge[] = useMemo(
    () =>
      initial.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label ?? undefined,
        type: "smoothstep",
        markerEnd: { type: MarkerType.ArrowClosed },
      })),
    [initial],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initEdges);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setNodes(initNodes); setEdges(initEdges); }, [initNodes, initEdges, setNodes, setEdges]);

  const onConnect = useCallback((c: Connection) => setEdges((es) => addEdge({ ...c, type: "smoothstep", markerEnd: { type: MarkerType.ArrowClosed } }, es)), [setEdges]);

  const addNode = (type: FlowNode["type"]) => {
    const id = nextId();
    const labelMap = { start: "Início", task: "Nova etapa", decision: "Decisão?", end: "Fim" } as const;
    setNodes((ns) => [...ns, { id, type, position: { x: 80, y: 80 }, data: { type, label: labelMap[type], description: null, owner: null } }]);
  };

  const sel = nodes.find((n) => n.id === selected);

  const updateSelected = (patch: Partial<StepData>) => {
    if (!sel) return;
    setNodes((ns) => ns.map((n) => (n.id === sel.id ? { ...n, data: { ...(n.data as StepData), ...patch } } : n)));
  };

  const deleteSelected = () => {
    if (!sel) return;
    setNodes((ns) => ns.filter((n) => n.id !== sel.id));
    setEdges((es) => es.filter((e) => e.source !== sel.id && e.target !== sel.id));
    setSelected(null);
  };

  const handleAutoLayout = () => {
    setNodes((ns) => autoLayout(ns, edges));
  };

  const handleSave = async () => {
    if (!onSave) return;
    const doc: FlowDoc = {
      nodes: nodes.map((n) => ({
        id: n.id,
        type: ((n.type as FlowNode["type"]) ?? (n.data as StepData).type),
        label: (n.data as StepData).label,
        description: (n.data as StepData).description,
        owner: (n.data as StepData).owner,
        position: n.position,
      })),
      edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, label: (e.label as string) ?? null })),
    };
    const starts = doc.nodes.filter((n) => n.type === "start").length;
    const ends = doc.nodes.filter((n) => n.type === "end").length;
    if (starts !== 1) return alert("É necessário exatamente 1 nó de Início.");
    if (ends < 1) return alert("É necessário pelo menos 1 nó de Fim.");
    setSaving(true);
    try { await onSave(doc); } finally { setSaving(false); }
  };

  return (
    <div className="grid h-[78vh] grid-cols-[200px_1fr_280px] rounded-md border bg-card overflow-hidden">
      {/* Palette */}
      <div className="border-r p-3 space-y-2">
        <div className="text-xs font-semibold uppercase text-muted-foreground">Paleta</div>
        {!readOnly && (
          <>
            <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => addNode("start")}><Play className="mr-2 h-4 w-4" />Início</Button>
            <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => addNode("task")}><ListChecks className="mr-2 h-4 w-4" />Tarefa</Button>
            <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => addNode("decision")}><Diamond className="mr-2 h-4 w-4" />Decisão</Button>
            <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => addNode("end")}><Square className="mr-2 h-4 w-4" />Fim</Button>
            <div className="pt-2 border-t" />
            <Button variant="ghost" size="sm" className="w-full justify-start" onClick={handleAutoLayout}><Wand2 className="mr-2 h-4 w-4" />Organizar</Button>
            <Button size="sm" className="w-full" onClick={handleSave} disabled={saving}><Save className="mr-2 h-4 w-4" />{saving ? "Salvando…" : "Salvar"}</Button>
          </>
        )}
        <p className="pt-3 text-[11px] text-muted-foreground leading-snug">
          Conecte nós arrastando das bolinhas. Clique em um nó para editar.
        </p>
      </div>

      {/* Canvas */}
      <div className="relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={readOnly ? undefined : onConnect}
          nodeTypes={nodeTypes}
          onNodeClick={(_, n) => setSelected(n.id)}
          onPaneClick={() => setSelected(null)}
          nodesDraggable={!readOnly}
          nodesConnectable={!readOnly}
          elementsSelectable
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={20} size={1} />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable />
        </ReactFlow>
      </div>

      {/* Inspector */}
      <div className="border-l p-3 space-y-3 overflow-y-auto">
        <div className="text-xs font-semibold uppercase text-muted-foreground">Detalhes</div>
        {!sel ? (
          <p className="text-sm text-muted-foreground">Selecione um nó para editar.</p>
        ) : (
          <Card className="p-3 space-y-3">
            <div>
              <Label className="text-xs">Tipo</Label>
              <p className="text-sm capitalize">{(sel.data as StepData).type}</p>
            </div>
            <div>
              <Label className="text-xs">Título</Label>
              <Input value={(sel.data as StepData).label} disabled={readOnly} onChange={(e) => updateSelected({ label: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Descrição</Label>
              <Textarea rows={3} value={(sel.data as StepData).description ?? ""} disabled={readOnly} onChange={(e) => updateSelected({ description: e.target.value || null })} />
            </div>
            <div>
              <Label className="text-xs">Responsável</Label>
              <Input value={(sel.data as StepData).owner ?? ""} disabled={readOnly} onChange={(e) => updateSelected({ owner: e.target.value || null })} placeholder="Cargo, área ou pessoa" />
            </div>
            {!readOnly && (
              <Button variant="destructive" size="sm" className="w-full" onClick={deleteSelected}>
                <Trash2 className="mr-2 h-4 w-4" />Excluir nó
              </Button>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

export function ProcessFlowEditor(props: { initial: FlowDoc; readOnly?: boolean; onSave?: (doc: FlowDoc) => Promise<void> | void }) {
  return (
    <ReactFlowProvider>
      <Inner {...props} />
    </ReactFlowProvider>
  );
}

export type { FlowDoc, FlowNode, FlowEdge };
