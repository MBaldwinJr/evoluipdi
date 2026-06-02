import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeProps,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export type OrgPerson = {
  id: string;
  full_name: string;
  role_title: string | null;
  department: string | null;
  avatar_url: string | null;
  manager_id: string | null;
};

type PersonNodeData = OrgPerson & { onPick: (id: string) => void; isPickTarget: boolean; isPicking: boolean; isPicked: boolean };

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");
}

function PersonNode({ data }: NodeProps<Node<PersonNodeData>>) {
  return (
    <Card
      onClick={() => data.isPicking && data.onPick(data.id)}
      className={`min-w-[220px] cursor-${data.isPicking ? "pointer" : "default"} px-3 py-2 shadow-sm border ${data.isPicked ? "ring-2 ring-primary" : ""} ${data.isPickTarget ? "border-primary/60" : ""}`}
    >
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground/40" />
      <div className="flex items-center gap-2">
        <Avatar className="h-8 w-8"><AvatarFallback>{initials(data.full_name)}</AvatarFallback></Avatar>
        <div className="min-w-0">
          <div className="text-sm font-medium leading-tight truncate">{data.full_name}</div>
          <div className="text-xs text-muted-foreground leading-tight truncate">
            {data.role_title || "—"}{data.department ? ` · ${data.department}` : ""}
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground/40" />
    </Card>
  );
}

const NODE_W = 240;
const NODE_H = 76;

function layout(nodes: Node[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", ranksep: 60, nodesep: 24 });
  g.setDefaultEdgeLabel(() => ({}));
  nodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  edges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);
  return nodes.map((n) => {
    const p = g.node(n.id);
    return { ...n, position: { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 } };
  });
}

function OrgChartInner({
  people,
  onSetManager,
}: {
  people: OrgPerson[];
  onSetManager: (employeeId: string, managerId: string | null) => Promise<void> | void;
}) {
  const [picking, setPicking] = useState<string | null>(null);
  const nodeTypes = useMemo(() => ({ person: PersonNode }), []);

  const { initialNodes, initialEdges } = useMemo(() => {
    const ids = new Set(people.map((p) => p.id));
    const ns: Node[] = people.map((p) => ({
      id: p.id,
      type: "person",
      data: { ...p, onPick: () => {}, isPickTarget: false, isPicking: false, isPicked: false },
      position: { x: 0, y: 0 },
    }));
    const es: Edge[] = people
      .filter((p) => p.manager_id && ids.has(p.manager_id))
      .map((p) => ({ id: `e-${p.manager_id}-${p.id}`, source: p.manager_id!, target: p.id, type: "smoothstep" }));
    return { initialNodes: layout(ns, es), initialEdges: es };
  }, [people]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const pick = useCallback(
    async (targetId: string) => {
      if (!picking) return;
      if (targetId === picking) {
        setPicking(null);
        return;
      }
      try {
        await onSetManager(picking, targetId);
        toast.success("Gestor atualizado");
      } catch (e: any) {
        toast.error(e.message ?? "Falha ao atualizar gestor");
      } finally {
        setPicking(null);
      }
    },
    [picking, onSetManager],
  );

  // Inject pick state into node data
  const decoratedNodes = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        data: {
          ...(n.data as PersonNodeData),
          onPick: pick,
          isPicking: !!picking && picking !== n.id,
          isPicked: picking === n.id,
          isPickTarget: !!picking && picking !== n.id,
        },
      })),
    [nodes, pick, picking],
  );

  return (
    <div className="h-[70vh] w-full rounded-md border bg-card">
      <div className="flex items-center gap-2 border-b p-2">
        {picking ? (
          <>
            <span className="text-sm">Clique sobre o novo gestor para vincular, ou</span>
            <Button size="sm" variant="outline" onClick={() => setPicking(null)}>Cancelar</Button>
            <Button size="sm" variant="ghost" onClick={async () => {
              try { await onSetManager(picking, null); toast.success("Vínculo removido"); } catch (e: any) { toast.error(e.message); }
              setPicking(null);
            }}>Remover gestor</Button>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">Clique com o botão direito sobre um nó para reassociar gestor.</span>
        )}
      </div>
      <ReactFlow
        nodes={decoratedNodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        onNodeContextMenu={(e, n) => {
          e.preventDefault();
          setPicking(n.id);
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} size={1} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  );
}

export function OrgChart(props: { people: OrgPerson[]; onSetManager: (employeeId: string, managerId: string | null) => Promise<void> | void }) {
  return (
    <ReactFlowProvider>
      <OrgChartInner {...props} />
    </ReactFlowProvider>
  );
}
