"use client";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { Database, FileText, Network, RefreshCw, Search, Upload, X } from "lucide-react";
import { type Issue, type WorkspaceSelection, type MemoryNote, type MemoryNoteDraft, type KnowledgeItem, type KnowledgeGraphNode, type KnowledgeGraphEdge, type KnowledgeGraphResponse, type WorkspaceTab } from "./shared";

export function MemoryWorkspace({
  notes,
  draft,
  knowledgeItems,
  uploading,
  onDraftChange,
  onAddNote,
  onRemoveNote,
  onUploadFile,
  onRemoveKnowledgeItem
}: {
  notes: MemoryNote[];
  draft: MemoryNoteDraft;
  knowledgeItems: KnowledgeItem[];
  uploading: boolean;
  onDraftChange: (value: MemoryNoteDraft) => void;
  onAddNote: () => void;
  onRemoveNote: (noteId: string) => void;
  onUploadFile: (file: File) => void;
  onRemoveKnowledgeItem: (item: KnowledgeItem) => void;
}) {
  const visibleKnowledgeItems = knowledgeItems.filter(
    (item) => item.source_type !== "memory_note" && item.source_type !== "team_member"
  );

  return (
    <div className="space-y-4">
      <section className="rounded-md border border-line bg-white p-4">
        <h3 className="text-sm font-semibold text-ink">项目记忆</h3>
        <p className="mt-1 text-xs leading-5 text-slate-500">记录项目约定、架构背景和长期偏好，会写入当前项目独立的 RAG 文档。</p>
        <div className="mt-4 grid gap-2">
          <input
            value={draft.title}
            onChange={(event) => onDraftChange({ ...draft, title: event.target.value })}
            placeholder="标题，例如 认证模块约定"
            className="h-9 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
          />
          <textarea
            value={draft.content}
            onChange={(event) => onDraftChange({ ...draft, content: event.target.value })}
            placeholder="记忆内容，例如 登录相关 Issue 优先分给熟悉 JWT 和 FastAPI 的成员"
            className="min-h-24 resize-none rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
          />
          <button
            onClick={onAddNote}
            disabled={!draft.title.trim() && !draft.content.trim()}
            className="inline-flex h-9 items-center justify-center rounded-md bg-accent px-3 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-60"
          >
            保存记忆
          </button>
        </div>
      </section>

      <section className="rounded-md border border-line bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-ink">知识库文件</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">上传文档后会切片写入 Milvus，只在当前项目内检索。</p>
          </div>
          <FileText className="h-4 w-4 text-accent" />
        </div>
        <label className="mt-4 flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-teal-200 bg-teal-50/50 px-3 py-4 text-center transition hover:bg-teal-50">
          <Upload className="h-5 w-5 text-accent" />
          <span className="mt-2 text-sm font-medium text-ink">{uploading ? "上传并索引中..." : "上传文件到知识库"}</span>
          <span className="mt-1 text-xs text-slate-500">支持文本、Markdown、JSON、CSV、PDF、DOCX 等可抽取文本的文件</span>
          <input
            type="file"
            className="hidden"
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onUploadFile(file);
              event.currentTarget.value = "";
            }}
          />
        </label>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
          <div className="rounded-md bg-panel px-3 py-2">知识条目：{visibleKnowledgeItems.length}</div>
        </div>
      </section>

      <section className="space-y-2">
        {notes.length === 0 && <div className="rounded-md border border-line bg-white p-4 text-sm text-slate-500">还没有项目记忆。</div>}
        {notes.map((note) => (
          <div key={note.id} className="rounded-md border border-line bg-white p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="font-medium text-ink">{note.title}</div>
              <button onClick={() => onRemoveNote(note.id)} className="rounded-md border border-line px-2 py-1 text-xs text-slate-500 hover:bg-panel">
                移除
              </button>
            </div>
            <div className="mt-2 whitespace-pre-wrap text-xs leading-6 text-slate-600">{note.content || "无内容"}</div>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        {visibleKnowledgeItems.length === 0 && <div className="rounded-md border border-line bg-white p-4 text-sm text-slate-500">还没有上传文件或生成周报。</div>}
        {visibleKnowledgeItems.map((item) => (
          <div key={`${item.source_type}-${item.id}`} className="rounded-md border border-line bg-white p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="line-clamp-1 font-medium text-ink">{item.title}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {knowledgeTypeLabel(item.source_type)} · {item.chunk_count} 个切片
                </div>
              </div>
              <button onClick={() => onRemoveKnowledgeItem(item)} className="rounded-md border border-line px-2 py-1 text-xs text-slate-500 hover:bg-panel">
                移除
              </button>
            </div>
            <div className="mt-2 line-clamp-3 text-xs leading-6 text-slate-600">{item.content_preview || "无内容预览"}</div>
          </div>
        ))}
      </section>
    </div>
  );
}

export function KnowledgeGraphWorkspace({
  graph,
  loading,
  error,
  query,
  selectedNodeKey,
  hiddenNodeTypes,
  hiddenRelations,
  onQueryChange,
  onSelectNode,
  onToggleNodeType,
  onToggleRelation,
  onRefresh,
  onRebuild,
  onFocusNode,
  onOpenNode
}: {
  graph: KnowledgeGraphResponse | null;
  loading: boolean;
  error: string | null;
  query: string;
  selectedNodeKey: string | null;
  hiddenNodeTypes: Record<string, boolean>;
  hiddenRelations: Record<string, boolean>;
  onQueryChange: (value: string) => void;
  onSelectNode: (value: string) => void;
  onToggleNodeType: (type: string) => void;
  onToggleRelation: (relation: string) => void;
  onRefresh: () => void;
  onRebuild: () => void;
  onFocusNode: (node: KnowledgeGraphNode) => void;
  onOpenNode: (node: KnowledgeGraphNode) => void;
}) {
  const allNodes = graph?.nodes ?? [];
  const allEdges = graph?.edges ?? [];
  const nodeByKey = useMemo(() => new Map(allNodes.map((node) => [knowledgeGraphNodeKey(node), node])), [allNodes]);
  const nodeTypes = useMemo(() => [...new Set(allNodes.map((node) => node.type))], [allNodes]);
  const relations = useMemo(() => [...new Set(allEdges.map((edge) => edge.relation))], [allEdges]);
  const filtered = useMemo(
    () => filterKnowledgeGraph(allNodes, allEdges, query, hiddenNodeTypes, hiddenRelations),
    [allNodes, allEdges, query, hiddenNodeTypes, hiddenRelations]
  );
  const centerKey = graph?.center_type && graph.center_id ? `${graph.center_type}:${graph.center_id}` : undefined;
  const positions = useMemo(() => layoutKnowledgeGraph(filtered.nodes, filtered.edges, centerKey), [filtered.nodes, filtered.edges, centerKey]);
  const selectedNode =
    (selectedNodeKey && filtered.nodes.find((node) => knowledgeGraphNodeKey(node) === selectedNodeKey)) ?? filtered.nodes[0] ?? null;
  const selectedEdges = selectedNode
    ? filtered.edges.filter(
        (edge) =>
          (edge.from_type === selectedNode.type && edge.from_id === selectedNode.id) ||
          (edge.to_type === selectedNode.type && edge.to_id === selectedNode.id)
      )
    : [];
  const showEdgeLabels = filtered.edges.length <= 8;
  const visibleNodeCount = graphStatNumber(graph, "visible_nodes", allNodes.length);
  const visibleEdgeCount = graphStatNumber(graph, "visible_edges", allEdges.length);
  const totalEdgeCount = graphStatNumber(graph, "total_edges", allEdges.length);

  return (
    <div className="space-y-3">
      <section className="rounded-md border border-line bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Network className="h-4 w-4 text-accent" />
              <h3 className="text-sm font-semibold text-ink">项目知识图谱</h3>
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-500">把 Issue、PR、CI、成员、文档、记忆和代码文件按可追溯关系串起来。</p>
          </div>
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              title="刷新图谱"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line text-slate-500 transition hover:bg-panel disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              type="button"
              onClick={onRebuild}
              disabled={loading}
              title="重建关系边"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line text-slate-500 transition hover:bg-panel disabled:opacity-50"
            >
              <Database className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-600">
          <div className="rounded-md bg-panel px-3 py-2">节点 {visibleNodeCount}</div>
          <div className="rounded-md bg-panel px-3 py-2">关系 {visibleEdgeCount}</div>
          <div className="rounded-md bg-panel px-3 py-2">总边 {totalEdgeCount}</div>
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-md border border-line bg-white px-3">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="搜索节点或关系..."
            className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
          {query && (
            <button type="button" onClick={() => onQueryChange("")} className="text-slate-400 hover:text-slate-600" title="清空搜索">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {Boolean(nodeTypes.length) && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {nodeTypes.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => onToggleNodeType(type)}
                className={`rounded-md border px-2 py-1 text-[11px] font-medium transition ${
                  hiddenNodeTypes[type] ? "border-line bg-white text-slate-400" : "border-transparent bg-panel text-slate-700"
                }`}
              >
                {graphNodeTypeLabel(type)}
              </button>
            ))}
          </div>
        )}

        {Boolean(relations.length) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {relations.map((relation) => (
              <button
                key={relation}
                type="button"
                onClick={() => onToggleRelation(relation)}
                className={`rounded-md border px-2 py-1 text-[11px] font-medium transition ${
                  hiddenRelations[relation] ? "border-line bg-white text-slate-400" : "border-transparent bg-panel text-slate-700"
                }`}
              >
                {graphRelationLabel(relation)}
              </button>
            ))}
          </div>
        )}
      </section>

      {error && <div className="rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {!error && !loading && (!graph || graph.nodes.length === 0) && (
        <div className="rounded-md border border-line bg-white p-4 text-sm text-slate-500">还没有可展示的项目关系。同步 Issue/PR/CI，或添加项目记忆后再重建图谱。</div>
      )}

      {loading && !graph && <div className="rounded-md border border-line bg-white p-4 text-sm text-slate-500">正在加载项目知识图谱...</div>}

      {graph && filtered.nodes.length === 0 && (
        <div className="rounded-md border border-line bg-white p-4 text-sm text-slate-500">当前搜索或过滤条件下没有匹配节点。</div>
      )}

      {graph && filtered.nodes.length > 0 && (
        <section className="rounded-md border border-line bg-white p-3">
          <div className="overflow-x-auto rounded-md bg-panel">
            <svg viewBox="0 0 720 420" className="h-[360px] min-w-[680px] w-full" role="img" aria-label="项目知识图谱">
              {filtered.edges.map((edge) => {
                const from = positions.get(`${edge.from_type}:${edge.from_id}`);
                const to = positions.get(`${edge.to_type}:${edge.to_id}`);
                if (!from || !to) return null;
                const color = graphRelationColor(edge.relation);
                return (
                  <g key={edge.id}>
                    <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={color} strokeWidth={edge.relation === "used_as_evidence" ? 2.8 : 1.6} strokeOpacity="0.58" />
                    {showEdgeLabels && (
                      <text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 5} textAnchor="middle" fontSize="10" fill={color} fontWeight="700">
                        {graphRelationLabel(edge.relation)}
                      </text>
                    )}
                  </g>
                );
              })}
              {filtered.nodes.map((node) => {
                const pos = positions.get(knowledgeGraphNodeKey(node));
                if (!pos) return null;
                const selected = selectedNode ? knowledgeGraphNodeKey(selectedNode) === knowledgeGraphNodeKey(node) : false;
                const style = graphNodeStyle(node.type);
                return (
                  <g key={knowledgeGraphNodeKey(node)} role="button" tabIndex={0} onClick={() => onSelectNode(knowledgeGraphNodeKey(node))} className="cursor-pointer">
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={selected ? 19 : 15}
                      fill={node.highlighted ? "#fff7ed" : style.fill}
                      stroke={node.highlighted ? "#f97316" : selected ? "#111827" : style.stroke}
                      strokeWidth={node.highlighted || selected ? 2.6 : 1.6}
                    />
                    <text x={pos.x} y={pos.y + 34} textAnchor="middle" fontSize="11" fontWeight={selected ? "700" : "600"} fill="#334155">
                      {clipGraphLabel(node.title, 18)}
                    </text>
                    <text x={pos.x} y={pos.y + 48} textAnchor="middle" fontSize="9" fill="#64748b">
                      {graphNodeTypeLabel(node.type)}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {selectedNode && (
            <div className="mt-3 rounded-md border border-line bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-medium text-accent">{graphNodeTypeLabel(selectedNode.type)}</div>
                  <div className="mt-1 line-clamp-2 text-sm font-semibold text-ink">{selectedNode.title}</div>
                  {selectedNode.subtitle && <div className="mt-1 text-xs text-slate-500">{selectedNode.subtitle}</div>}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => onFocusNode(selectedNode)}
                    className="rounded-md border border-line px-2 py-1 text-xs text-slate-600 transition hover:bg-panel"
                  >
                    聚焦
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenNode(selectedNode)}
                    className="rounded-md bg-accent px-2 py-1 text-xs font-medium text-white transition hover:bg-teal-700"
                  >
                    打开
                  </button>
                </div>
              </div>

              <div className="mt-3 space-y-1.5">
                {selectedEdges.length === 0 && <div className="text-xs text-slate-500">这个节点暂时没有可见关系。</div>}
                {selectedEdges.slice(0, 8).map((edge) => {
                  const isOutgoing = edge.from_type === selectedNode.type && edge.from_id === selectedNode.id;
                  const other = nodeByKey.get(isOutgoing ? `${edge.to_type}:${edge.to_id}` : `${edge.from_type}:${edge.from_id}`);
                  return (
                    <div key={edge.id} className="rounded-md bg-panel px-3 py-2 text-xs text-slate-600">
                      <span className="font-medium text-ink">{isOutgoing ? "→" : "←"} {graphRelationLabel(edge.relation)}</span>
                      <span className="ml-2">{other?.title ?? edge.to_id}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export function knowledgeTypeLabel(sourceType: string) {
  if (sourceType === "knowledge_file") return "上传文件";
  if (sourceType === "weekly_report") return "周报";
  if (sourceType === "project_overview") return "项目概况";
  if (sourceType === "project_doc") return "项目文档";
  if (sourceType === "project_manifest") return "项目清单";
  if (sourceType === "memory_note") return "记忆";
  if (sourceType === "team_member") return "团队成员";
  return sourceType;
}

export function knowledgeGraphNodeKey(node: KnowledgeGraphNode) {
  return `${node.type}:${node.id}`;
}

export function workspaceSelectionToGraphCenter(selection: WorkspaceSelection): { type: string; id: string } | null {
  if (selection.type === "issue") return { type: "issue", id: selection.id };
  if (selection.type === "pr") return { type: "pull_request", id: selection.id };
  if (selection.type === "ci") return { type: "ci_run", id: selection.id };
  return null;
}

export function openGraphNodeInWorkspace(
  node: KnowledgeGraphNode,
  setWorkspaceTab: (tab: WorkspaceTab) => void,
  setSelectedWorkspaceItem: (item: WorkspaceSelection | null) => void,
  preserveSelectionRef: { current: boolean }
) {
  if (node.type === "issue") {
    preserveSelectionRef.current = true;
    setWorkspaceTab("Issue");
    setSelectedWorkspaceItem({ type: "issue", id: node.id });
    return;
  }
  if (node.type === "pull_request") {
    preserveSelectionRef.current = true;
    setWorkspaceTab("PR");
    setSelectedWorkspaceItem({ type: "pr", id: node.id });
    return;
  }
  if (node.type === "ci_run") {
    preserveSelectionRef.current = true;
    setWorkspaceTab("CI");
    setSelectedWorkspaceItem({ type: "ci", id: node.id });
    return;
  }
  setWorkspaceTab(node.type === "team_member" ? "团队" : "记忆&知识库");
  setSelectedWorkspaceItem(null);
}

export function filterKnowledgeGraph(
  nodes: KnowledgeGraphNode[],
  edges: KnowledgeGraphEdge[],
  query: string,
  hiddenNodeTypes: Record<string, boolean>,
  hiddenRelations: Record<string, boolean>
) {
  const normalizedQuery = query.trim().toLowerCase();
  const baseAllowed = new Set(
    nodes.filter((node) => !hiddenNodeTypes[node.type]).map((node) => knowledgeGraphNodeKey(node))
  );
  const matches = new Set(
    nodes
      .filter((node) => baseAllowed.has(knowledgeGraphNodeKey(node)))
      .filter((node) => !normalizedQuery || graphNodeMatches(node, normalizedQuery))
      .map((node) => knowledgeGraphNodeKey(node))
  );
  if (normalizedQuery) {
    for (const edge of edges) {
      if (hiddenRelations[edge.relation]) continue;
      const fromKey = `${edge.from_type}:${edge.from_id}`;
      const toKey = `${edge.to_type}:${edge.to_id}`;
      const relationMatches = graphRelationLabel(edge.relation).toLowerCase().includes(normalizedQuery) || edge.relation.toLowerCase().includes(normalizedQuery);
      if (relationMatches || matches.has(fromKey) || matches.has(toKey)) {
        if (baseAllowed.has(fromKey)) matches.add(fromKey);
        if (baseAllowed.has(toKey)) matches.add(toKey);
      }
    }
  }
  const allowed = normalizedQuery ? matches : baseAllowed;
  const visibleEdges = edges.filter((edge) => {
    if (hiddenRelations[edge.relation]) return false;
    return allowed.has(`${edge.from_type}:${edge.from_id}`) && allowed.has(`${edge.to_type}:${edge.to_id}`);
  });
  return {
    nodes: nodes.filter((node) => allowed.has(knowledgeGraphNodeKey(node))),
    edges: visibleEdges
  };
}

export function graphNodeMatches(node: KnowledgeGraphNode, query: string) {
  const metadataText = Object.values(node.metadata ?? {})
    .slice(0, 6)
    .join(" ")
    .toLowerCase();
  return `${node.title} ${node.subtitle ?? ""} ${node.type} ${metadataText}`.toLowerCase().includes(query);
}

export function layoutKnowledgeGraph(nodes: KnowledgeGraphNode[], edges: KnowledgeGraphEdge[], centerKey?: string) {
  const positions = new Map<string, { x: number; y: number }>();
  if (nodes.length === 0) return positions;
  const degrees = new Map<string, number>();
  for (const node of nodes) degrees.set(knowledgeGraphNodeKey(node), 0);
  for (const edge of edges) {
    const fromKey = `${edge.from_type}:${edge.from_id}`;
    const toKey = `${edge.to_type}:${edge.to_id}`;
    degrees.set(fromKey, (degrees.get(fromKey) ?? 0) + 1);
    degrees.set(toKey, (degrees.get(toKey) ?? 0) + 1);
  }
  const requestedCenter = centerKey ? nodes.find((node) => knowledgeGraphNodeKey(node) === centerKey) : undefined;
  const resolvedCenter =
    requestedCenter ??
    [...nodes].sort((a, b) => (degrees.get(knowledgeGraphNodeKey(b)) ?? 0) - (degrees.get(knowledgeGraphNodeKey(a)) ?? 0))[0];
  const centerNodeKey = knowledgeGraphNodeKey(resolvedCenter);
  positions.set(centerNodeKey, { x: 360, y: 190 });
  const neighborKeys = new Set<string>();
  for (const edge of edges) {
    const fromKey = `${edge.from_type}:${edge.from_id}`;
    const toKey = `${edge.to_type}:${edge.to_id}`;
    if (fromKey === centerNodeKey) neighborKeys.add(toKey);
    if (toKey === centerNodeKey) neighborKeys.add(fromKey);
  }
  const neighbors = nodes.filter((node) => neighborKeys.has(knowledgeGraphNodeKey(node)));
  const remaining = nodes.filter((node) => knowledgeGraphNodeKey(node) !== centerNodeKey && !neighborKeys.has(knowledgeGraphNodeKey(node)));
  placeGraphRing(positions, neighbors, 360, 190, neighbors.length > 10 ? 145 : 122, -Math.PI / 2);
  placeGraphRing(positions, remaining, 360, 190, 184, Math.PI / 9);
  return positions;
}

export function placeGraphRing(
  positions: Map<string, { x: number; y: number }>,
  nodes: KnowledgeGraphNode[],
  cx: number,
  cy: number,
  radius: number,
  start: number
) {
  if (nodes.length === 0) return;
  nodes.forEach((node, index) => {
    const angle = start + (Math.PI * 2 * index) / nodes.length;
    positions.set(knowledgeGraphNodeKey(node), {
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius
    });
  });
}

export function graphNodeTypeLabel(type: string) {
  const labels: Record<string, string> = {
    issue: "Issue",
    pull_request: "PR",
    ci_run: "CI",
    team_member: "成员",
    memory_note: "记忆",
    document: "文档",
    code_file: "代码",
    session_decision: "决策"
  };
  return labels[type] ?? type;
}

export function graphRelationLabel(relation: string) {
  const labels: Record<string, string> = {
    resolves: "修复",
    mentions: "提及",
    assigned_to: "分配",
    blocked_by: "阻塞",
    failed_in_ci: "CI失败",
    touches_file: "改动",
    documents: "说明",
    cites: "引用",
    produced_from_session: "沉淀",
    used_as_evidence: "召回"
  };
  return labels[relation] ?? relation.replace(/_/g, " ");
}

export function graphNodeStyle(type: string) {
  const styles: Record<string, { fill: string; stroke: string }> = {
    issue: { fill: "#fef3c7", stroke: "#d97706" },
    pull_request: { fill: "#ccfbf1", stroke: "#0f766e" },
    ci_run: { fill: "#fee2e2", stroke: "#dc2626" },
    team_member: { fill: "#e0e7ff", stroke: "#4f46e5" },
    memory_note: { fill: "#fce7f3", stroke: "#be185d" },
    document: { fill: "#dbeafe", stroke: "#2563eb" },
    code_file: { fill: "#dcfce7", stroke: "#16a34a" },
    session_decision: { fill: "#f3e8ff", stroke: "#9333ea" }
  };
  return styles[type] ?? { fill: "#f1f5f9", stroke: "#64748b" };
}

export function graphRelationColor(relation: string) {
  const colors: Record<string, string> = {
    resolves: "#16a34a",
    mentions: "#64748b",
    assigned_to: "#4f46e5",
    blocked_by: "#dc2626",
    failed_in_ci: "#ef4444",
    touches_file: "#0f766e",
    documents: "#2563eb",
    cites: "#be185d",
    produced_from_session: "#9333ea",
    used_as_evidence: "#f97316"
  };
  return colors[relation] ?? "#64748b";
}

export function graphStatNumber(graph: KnowledgeGraphResponse | null, key: string, fallback: number) {
  const value = graph?.stats?.[key];
  return typeof value === "number" ? value : fallback;
}

export function clipGraphLabel(text: string, limit: number) {
  return text.length <= limit ? text : `${text.slice(0, limit - 1).trim()}…`;
}

