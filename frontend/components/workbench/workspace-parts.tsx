"use client";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { AlertTriangle, ChevronDown, Clock3, Database, FileText, Folder, GitPullRequest, ListTodo, RefreshCw, Search, ShieldCheck, Upload, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { apiGet, apiPost } from "@/lib/api";
import type { Repository } from "@/lib/types";
import { formatDate, getFriendlyError, type Issue, type PullRequest, type WorkflowRun, type WorkspaceItem, type TeamMember, type TeamMemberDraft, type MemoryNote, type MemoryNoteDraft, type KnowledgeItem, type ProjectIndexState, type RecallEvent, type MemoryStatus, type MemoryCandidate, type MemorySearchResult, type WorkspaceTab } from "./shared";
import { knowledgeTypeLabel } from "./memory-graph";

export function MetricCard({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    <div className="rounded-md border border-line bg-white px-3 py-2">
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-500">{label}</div>
        <Icon className="h-3.5 w-3.5 text-accent" />
      </div>
      <div className="mt-1 text-lg font-semibold text-ink">{value}</div>
    </div>
  );
}

export function WorkspaceControls({
  query,
  status,
  owner,
  time,
  owners,
  activeTab,
  onQueryChange,
  onStatusChange,
  onOwnerChange,
  onTimeChange
}: {
  query: string;
  status: string;
  owner: string;
  time: string;
  owners: string[];
  activeTab: WorkspaceTab;
  onQueryChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onOwnerChange: (value: string) => void;
  onTimeChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="关键词搜索标题、正文、标签"
          className="h-10 w-full rounded-md border border-line bg-white pl-9 pr-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <SelectFilter value={status} onChange={onStatusChange} label="状态">
          <option value="all">全部状态</option>
          <option value="open">open</option>
          <option value="closed">closed</option>
          {activeTab === "PR" && <option value="merged">merged</option>}
          {activeTab === "CI" && <option value="failure">failure</option>}
          {activeTab === "CI" && <option value="success">success</option>}
        </SelectFilter>
        <SelectFilter value={owner} onChange={onOwnerChange} label="负责人" disabled={activeTab === "CI"}>
          <option value="all">全部负责人</option>
          <option value="unassigned">未分配</option>
          {owners.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </SelectFilter>
        <SelectFilter value={time} onChange={onTimeChange} label="时间">
          <option value="all">全部时间</option>
          <option value="7d">近 7 天</option>
          <option value="30d">近 30 天</option>
        </SelectFilter>
      </div>
    </div>
  );
}

export function SelectFilter({
  value,
  label,
  disabled,
  children,
  onChange
}: {
  value: string;
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
  onChange: (value: string) => void;
}) {
  return (
    <label className="relative block">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full appearance-none rounded-md border border-line bg-white px-2 pr-7 text-xs text-slate-700 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100 disabled:text-slate-400"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
    </label>
  );
}

export function CategoryGroup({
  label,
  color,
  count,
  items,
  isCollapsed,
  onToggle
}: {
  label: string;
  color: string;
  count: number;
  items: WorkspaceItem[];
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <section>
      <button type="button" onClick={onToggle} className="flex h-7 w-full items-center justify-between">
        <div className={`flex items-center gap-2 text-sm font-semibold ${color}`}>
          <span>{label}</span>
          <span className="rounded-full bg-[#f2eee8] px-2 py-0.5 text-xs font-medium text-slate-500">{count}</span>
        </div>
        <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition ${isCollapsed ? "-rotate-90" : ""}`} />
      </button>
      {!isCollapsed && items.length > 0 && (
        <div className="mt-2 space-y-2">
          {items.map((item) => (
            <WorkspaceItemButton key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}

export function WorkspaceItemButton({ item }: { item: WorkspaceItem }) {
  return (
    <button
      onClick={item.onClick}
      className={`w-full rounded-md border bg-white p-3 text-left transition ${
        item.selected ? "border-teal-400 ring-2 ring-teal-100" : "border-line hover:border-teal-200 hover:bg-teal-50"
      }`}
    >
      <div className="line-clamp-2 text-sm font-medium text-ink">{item.title}</div>
      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
        <span>{item.meta}</span>
        {item.badges?.slice(0, 3).map((badge) => (
          <span key={badge} className="rounded-full bg-panel px-2 py-0.5">
            {badge}
          </span>
        ))}
      </div>
      {item.detail && <div className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{item.detail}</div>}
    </button>
  );
}

export function WorkspaceDetail({
  issue,
  pr,
  run,
  analyzingIssue,
  analyzingPr,
  analyzingRun,
  onAnalyzeIssue,
  onAnalyzePr,
  onAnalyzeRun,
  onClose
}: {
  issue?: Issue;
  pr?: PullRequest;
  run?: WorkflowRun;
  analyzingIssue?: boolean;
  analyzingPr?: boolean;
  analyzingRun?: boolean;
  onAnalyzeIssue?: () => void;
  onAnalyzePr?: () => void;
  onAnalyzeRun?: () => void;
  onClose: () => void;
}) {
  const title = issue ? `#${issue.number} ${issue.title}` : pr ? `#${pr.number} ${pr.title}` : run?.name ?? "";
  const body = issue?.body ?? pr?.body ?? run?.logs_text ?? "暂无详情内容";
  const status = issue?.state ?? (pr?.merged_at ? "merged" : pr?.state) ?? run?.conclusion ?? run?.status ?? "";
  const owner = issue?.assignees?.join(", ") || issue?.author || pr?.author || "未分配";
  const updatedAt = issue?.updated_at ?? issue?.created_at ?? pr?.updated_at ?? pr?.created_at ?? run?.updated_at ?? run?.created_at;

  return (
    <div className="mb-4 rounded-md border border-teal-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">详情</div>
          <h3 className="mt-1 text-sm font-semibold leading-6 text-ink">{title}</h3>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {issue && (
            <button
              onClick={onAnalyzeIssue}
              disabled={!onAnalyzeIssue || analyzingIssue}
              className="inline-flex items-center gap-1 rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-white transition hover:bg-teal-700 disabled:opacity-60"
            >
              <ListTodo className="h-3.5 w-3.5" />
              {analyzingIssue ? "分析中..." : "分析当前 Issue"}
            </button>
          )}
          {pr && (
            <button
              onClick={onAnalyzePr}
              disabled={!onAnalyzePr || analyzingPr}
              className="inline-flex items-center gap-1 rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-white transition hover:bg-teal-700 disabled:opacity-60"
            >
              <GitPullRequest className="h-3.5 w-3.5" />
              {analyzingPr ? "分析中..." : "分析当前 PR"}
            </button>
          )}
          {run && (
            <button
              onClick={onAnalyzeRun}
              disabled={!onAnalyzeRun || analyzingRun}
              className="inline-flex items-center gap-1 rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-white transition hover:bg-teal-700 disabled:opacity-60"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              {analyzingRun ? "排查中..." : "分析当前 CI"}
            </button>
          )}
          <button onClick={onClose} className="rounded-md border border-line px-2 py-1 text-xs text-slate-500 transition hover:bg-panel">
            关闭
          </button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <MetaPill label="状态" value={status} />
        <MetaPill label="负责人" value={owner} />
        <MetaPill label="更新时间" value={formatDate(updatedAt)} />
      </div>
      {(issue?.labels?.length ?? 0) > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {issue?.labels?.map((label) => (
            <span key={label} className="rounded-full bg-teal-50 px-2 py-0.5 text-xs text-teal-700">
              {label}
            </span>
          ))}
        </div>
      )}
      <div className="mt-3 whitespace-pre-wrap rounded-md bg-[#fbf7f2] p-3 text-xs leading-6 text-slate-700">{body}</div>
      {pr?.files && pr.files.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {pr.files.map((file) => (
            <div key={file.id} className="rounded-md border border-line bg-white px-2 py-1.5 text-xs text-slate-600">
              <span className="font-medium text-ink">{file.filename}</span>
              <span className="ml-2 text-emerald-600">+{file.additions}</span>
              <span className="ml-1 text-rose-500">-{file.deletions}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function MetaPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-full bg-panel px-2.5 py-1 text-xs text-slate-600">
      {label}: {value}
    </span>
  );
}

export function EmptyWorkspaceState({ label }: { label: string }) {
  return <div className="rounded-md border border-line bg-white p-4 text-sm text-slate-500">{label}</div>;
}

export function TeamWorkspace({
  members,
  draft,
  onDraftChange,
  onAddMember,
  onRemoveMember
}: {
  members: TeamMember[];
  draft: TeamMemberDraft;
  onDraftChange: (value: TeamMemberDraft) => void;
  onAddMember: () => void;
  onRemoveMember: (memberId: string) => void;
}) {
  return (
    <div className="space-y-4">
      <section className="rounded-md border border-line bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-ink">人员管理</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">配置项目工作者，Agent 会在分配 Issue 时参考职位、擅长方向和技术栈。</p>
          </div>
          <span className="rounded-full bg-panel px-2 py-0.5 text-xs text-slate-500">{members.length} 人</span>
        </div>

        <div className="mt-4 grid gap-2">
          <input
            value={draft.name}
            onChange={(event) => onDraftChange({ ...draft, name: event.target.value })}
            placeholder="姓名，例如 Alice"
            className="h-9 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
          />
          <input
            value={draft.role}
            onChange={(event) => onDraftChange({ ...draft, role: event.target.value })}
            placeholder="职位，例如 后端工程师 / 前端工程师 / Tech Lead"
            className="h-9 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
          />
          <textarea
            value={draft.strengths}
            onChange={(event) => onDraftChange({ ...draft, strengths: event.target.value })}
            placeholder="擅长，例如 鉴权、API 设计、CI 排查"
            className="min-h-16 resize-none rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
          />
          <input
            value={draft.techStack}
            onChange={(event) => onDraftChange({ ...draft, techStack: event.target.value })}
            placeholder="技术栈，例如 Python, FastAPI, PostgreSQL"
            className="h-9 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
          />
          <button
            onClick={onAddMember}
            disabled={!draft.name.trim()}
            className="inline-flex h-9 items-center justify-center rounded-md bg-accent px-3 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-60"
          >
            添加成员
          </button>
        </div>
      </section>

      <section className="rounded-md border border-line bg-white p-4">
        <h3 className="text-sm font-semibold text-ink">团队成员</h3>
        <div className="mt-3 space-y-2">
          {members.length === 0 && <div className="rounded-md bg-panel p-3 text-sm text-slate-500">还没有成员。先添加一个项目工作者。</div>}
          {members.map((member) => (
            <div key={member.id} className="rounded-md border border-line bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-ink">{member.name}</div>
                  <div className="mt-1 text-xs text-slate-500">{member.role || "未配置职位"}</div>
                </div>
                <button onClick={() => onRemoveMember(member.id)} className="rounded-md border border-line px-2 py-1 text-xs text-slate-500 hover:bg-panel">
                  移除
                </button>
              </div>
              <div className="mt-3 space-y-1 text-xs leading-5 text-slate-600">
                <div>擅长：{member.strengths || "未配置"}</div>
                <div>技术栈：{member.techStack || "未配置"}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-md border border-line bg-white p-4 text-sm leading-7 text-slate-600">
        <div className="font-medium text-ink">报告管理</div>
        <p className="mt-2">可在中间对话框输入“生成本周研发周报”，或进入周报页面查看 Markdown 预览。</p>
        <Link href="/reports" className="mt-3 inline-flex rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white">
          打开周报页
        </Link>
      </section>
    </div>
  );
}

export function MemoryIndexPromptCard({
  repo,
  state,
  scanning,
  error,
  onStartScan,
  onSnooze
}: {
  repo: Repository;
  state: ProjectIndexState;
  scanning: boolean;
  error: string | null;
  onStartScan: () => void;
  onSnooze: () => void;
}) {
  const isFailed = state.status === "failed";
  const isStale = state.status === "stale";
  const title = scanning ? "正在建立项目记忆索引..." : isFailed ? "记忆索引构建失败" : isStale ? "记忆索引已过期" : "这个项目还没有记忆索引";
  const description = scanning
    ? "正在扫描项目文档、README 和配置清单，完成后 Agent 就能在当前仓库里检索这些上下文。"
    : isFailed
      ? `项目 ${repo.full_name} 上次扫描没有完成：${state.error_message || error || "未知错误"}`
      : isStale
        ? `项目 ${repo.full_name} 的本地内容已变化，建议更新索引，让回答保持新鲜。`
        : "建立索引后，DevMate AI 可以检索项目说明、架构文档、ADR、计划和经验记录，不必每次从零开始。";
  const actionLabel = scanning ? "扫描中..." : isFailed ? "重试扫描" : isStale ? "更新索引" : "开始扫描";

  return (
    <div className="flex justify-start">
      <div className="w-full rounded-md border border-teal-100 bg-white px-4 py-4 text-sm shadow-sm">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-teal-50 text-accent">
            {isFailed ? <AlertTriangle className="h-5 w-5" /> : scanning ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Database className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-ink">{title}</div>
            <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
            {!isFailed && (
              <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-3">
                <div className="inline-flex items-center gap-1.5">
                  <Folder className="h-3.5 w-3.5 text-accent" />
                  README / docs / manifest
                </div>
                <div className="inline-flex items-center gap-1.5">
                  <Clock3 className="h-3.5 w-3.5 text-accent" />
                  后台扫描，可继续对话
                </div>
                <div className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-accent" />
                  仅写入本地知识库
                </div>
              </div>
            )}
            {error && !isFailed && <div className="mt-3 rounded-md border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                onClick={onSnooze}
                disabled={scanning}
                className="rounded-md border border-line bg-white px-3 py-2 text-xs font-medium text-slate-500 transition hover:bg-panel disabled:opacity-60"
              >
                稍后再说
              </button>
              <button
                onClick={onStartScan}
                disabled={scanning}
                className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-2 text-xs font-medium text-white transition hover:bg-teal-700 disabled:opacity-60"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${scanning ? "animate-spin" : ""}`} />
                {actionLabel}
              </button>
              <span className="text-xs text-slate-400">稍后提醒会冷却 7 天，也可以在知识库页手动管理索引内容。</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MemoryHubWorkspace({
  repoId,
  notes,
  draft,
  knowledgeItems,
  uploading,
  onDraftChange,
  onAddNote,
  onRemoveNote,
  onUploadFile,
  onRemoveKnowledgeItem,
  onRefreshKnowledge
}: {
  repoId?: string;
  notes: MemoryNote[];
  draft: MemoryNoteDraft;
  knowledgeItems: KnowledgeItem[];
  uploading: boolean;
  onDraftChange: (value: MemoryNoteDraft) => void;
  onAddNote: () => void;
  onRemoveNote: (noteId: string) => void;
  onUploadFile: (file: File) => void;
  onRemoveKnowledgeItem: (item: KnowledgeItem) => void;
  onRefreshKnowledge: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"recall" | "search" | "status" | "review">("recall");
  const [recallEvents, setRecallEvents] = useState<RecallEvent[]>([]);
  const [memoryStatus, setMemoryStatus] = useState<MemoryStatus | null>(null);
  const [candidates, setCandidates] = useState<MemoryCandidate[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MemorySearchResult[]>([]);
  const [loadingPanel, setLoadingPanel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const visibleKnowledgeItems = knowledgeItems.filter(
    (item) => item.source_type !== "memory_note" && item.source_type !== "team_member"
  );

  async function loadRecallEvents() {
    if (!repoId) return;
    setLoadingPanel("recall");
    setError(null);
    try {
      setRecallEvents(await apiGet<RecallEvent[]>(`/api/repos/${repoId}/memory/recall-events?limit=30`));
    } catch (err) {
      setError(getFriendlyError(err));
    } finally {
      setLoadingPanel((current) => (current === "recall" ? null : current));
    }
  }

  async function loadMemoryStatus() {
    if (!repoId) return;
    setLoadingPanel("status");
    setError(null);
    try {
      setMemoryStatus(await apiGet<MemoryStatus>(`/api/repos/${repoId}/memory/status`));
    } catch (err) {
      setError(getFriendlyError(err));
    } finally {
      setLoadingPanel((current) => (current === "status" ? null : current));
    }
  }

  async function loadCandidates(status = "pending") {
    if (!repoId) return;
    setLoadingPanel("review");
    setError(null);
    try {
      setCandidates(await apiGet<MemoryCandidate[]>(`/api/repos/${repoId}/memory/candidates?status=${encodeURIComponent(status)}&limit=50`));
    } catch (err) {
      setError(getFriendlyError(err));
    } finally {
      setLoadingPanel((current) => (current === "review" ? null : current));
    }
  }

  async function runMemorySearch() {
    if (!repoId || !searchQuery.trim()) return;
    setLoadingPanel("search");
    setError(null);
    try {
      const response = await apiGet<{ results: MemorySearchResult[] }>(
        `/api/repos/${repoId}/memory/search?q=${encodeURIComponent(searchQuery.trim())}&limit=10`
      );
      setSearchResults(response.results);
      await loadRecallEvents();
    } catch (err) {
      setError(getFriendlyError(err));
    } finally {
      setLoadingPanel((current) => (current === "search" ? null : current));
    }
  }

  async function approveCandidate(candidateId: string) {
    if (!repoId) return;
    setLoadingPanel(candidateId);
    setError(null);
    try {
      await apiPost(`/api/repos/${repoId}/memory/candidates/${candidateId}/approve`, {});
      await Promise.all([loadCandidates(), loadMemoryStatus()]);
      onRefreshKnowledge();
    } catch (err) {
      setError(getFriendlyError(err));
    } finally {
      setLoadingPanel((current) => (current === candidateId ? null : current));
    }
  }

  async function rejectCandidate(candidateId: string) {
    if (!repoId) return;
    setLoadingPanel(candidateId);
    setError(null);
    try {
      await apiPost(`/api/repos/${repoId}/memory/candidates/${candidateId}/reject`, {});
      await Promise.all([loadCandidates(), loadMemoryStatus()]);
    } catch (err) {
      setError(getFriendlyError(err));
    } finally {
      setLoadingPanel((current) => (current === candidateId ? null : current));
    }
  }

  useEffect(() => {
    if (!repoId) return;
    loadRecallEvents();
    loadMemoryStatus();
    loadCandidates();
  }, [repoId]);

  const tabs = [
    { id: "recall", label: "召回记录" },
    { id: "search", label: "搜索" },
    { id: "status", label: "索引状态" },
    { id: "review", label: "待确认知识" }
  ] as const;
  const vectorRuntime = recordFromUnknown(memoryStatus?.vector);
  const vectorEmbedding = recordFromUnknown(vectorRuntime.embedding);
  const vectorBackend = memoryStatus
    ? `${String(vectorRuntime.backend ?? "未配置")} · ${String(vectorRuntime.status ?? "unknown")}`
    : "未加载";

  return (
    <div className="space-y-4">
      <div className="flex gap-1 overflow-x-auto rounded-md border border-line bg-white p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition ${
              activeTab === tab.id ? "bg-accent text-white" : "text-slate-600 hover:bg-panel"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && <div className="rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {activeTab === "recall" && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">召回记录</h3>
            <button type="button" onClick={loadRecallEvents} className="rounded-md border border-line px-2 py-1 text-xs text-slate-600 hover:bg-panel">
              刷新
            </button>
          </div>
          {loadingPanel === "recall" && <div className="rounded-md border border-line bg-white p-4 text-sm text-slate-500">正在读取召回记录...</div>}
          {!loadingPanel && recallEvents.length === 0 && <div className="rounded-md border border-line bg-white p-4 text-sm text-slate-500">还没有召回记录。智能体调用 search_evidence 或 RAG 搜索后会显示在这里。</div>}
          {recallEvents.map((event) => (
            <div key={event.id} className="rounded-md border border-line bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-medium text-accent">{event.tool_name}</div>
                  <div className="mt-1 line-clamp-2 text-sm font-semibold text-ink">{event.query || "空查询"}</div>
                  <div className="mt-1 text-xs text-slate-500">{event.result_count} 个结果 · {event.mode} · {formatDateTime(event.created_at)}</div>
                </div>
                <span className="rounded-md bg-panel px-2 py-1 text-[11px] text-slate-600">{event.scope}</span>
              </div>
              <div className="mt-2 space-y-1">
                {(event.results ?? []).slice(0, 3).map((item, index) => (
                  <div key={`${event.id}-${index}`} className="rounded-md bg-panel px-3 py-2 text-xs text-slate-600">
                    <span className="font-medium text-ink">{String(item.source_type || "source")}</span>
                    <span className="mx-1">·</span>
                    {String(item.title || "")}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {activeTab === "search" && (
        <section className="space-y-4">
          <div className="rounded-md border border-line bg-white p-4">
            <h3 className="text-sm font-semibold text-ink">统一记忆搜索</h3>
            <div className="mt-3 flex gap-2">
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void runMemorySearch();
                }}
                placeholder="搜索 Issue、PR、CI、文档、会话记忆..."
                className="h-9 min-w-0 flex-1 rounded-md border border-line px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              />
              <button
                type="button"
                onClick={runMemorySearch}
                disabled={!searchQuery.trim() || loadingPanel === "search"}
                className="inline-flex h-9 items-center justify-center rounded-md bg-accent px-3 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-60"
              >
                搜索
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {searchResults.map((item) => (
                <div key={`${item.source_type}-${item.source_id}-${item.title}`} className="rounded-md bg-panel p-3">
                  <div className="text-xs font-medium text-accent">{knowledgeTypeLabel(item.source_type)}</div>
                  <div className="mt-1 text-sm font-semibold text-ink">{item.title}</div>
                  <div className="mt-1 line-clamp-3 text-xs leading-5 text-slate-600">{item.snippet}</div>
                </div>
              ))}
            </div>
          </div>

          <section className="rounded-md border border-line bg-white p-4">
            <h3 className="text-sm font-semibold text-ink">项目记忆</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">记录项目约定、架构背景和长期偏好，会写入当前项目的 RAG 文档。</p>
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
                <p className="mt-1 text-xs leading-5 text-slate-500">上传文档后会切片写入向量索引，并参与统一记忆搜索。</p>
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

          <MemoryItemLists notes={notes} knowledgeItems={visibleKnowledgeItems} onRemoveNote={onRemoveNote} onRemoveKnowledgeItem={onRemoveKnowledgeItem} />
        </section>
      )}

      {activeTab === "status" && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">索引与健康状态</h3>
            <button type="button" onClick={loadMemoryStatus} className="rounded-md border border-line px-2 py-1 text-xs text-slate-600 hover:bg-panel">
              刷新
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
            <MemoryStatusTile label="索引状态" value={String(memoryStatus?.index?.status ?? "missing")} />
            <MemoryStatusTile label="项目文档" value={`${numberFromUnknown(memoryStatus?.documents?.total)} 条`} />
            <MemoryStatusTile label="Evidence" value={`${numberFromUnknown(memoryStatus?.evidence?.total)} 条`} />
            <MemoryStatusTile label="召回记录" value={`${numberFromUnknown(memoryStatus?.recall?.total)} 次`} />
            <MemoryStatusTile label="待确认" value={`${numberFromUnknown(memoryStatus?.candidates?.pending)} 条`} />
            <MemoryStatusTile label="向量后端" value={vectorBackend} />
          </div>
          <div className="rounded-md border border-line bg-white p-3 text-xs leading-5 text-slate-600">
            <div>最后扫描：{String(memoryStatus?.index?.last_scan_at ?? "暂无")}</div>
            <div>Embedding Provider：{String(vectorEmbedding.provider ?? "未配置")}</div>
            <div>Embedding：{String(vectorEmbedding.model ?? "未配置")}</div>
            <div>维度：{String(vectorEmbedding.dimensions ?? "未配置")}</div>
            <div>Collection：{String(vectorRuntime.collection ?? "未配置")}</div>
            <div>状态说明：{String(vectorRuntime.error ?? vectorRuntime.status ?? "暂无")}</div>
          </div>
        </section>
      )}

      {activeTab === "review" && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">待确认知识</h3>
            <button type="button" onClick={() => loadCandidates()} className="rounded-md border border-line px-2 py-1 text-xs text-slate-600 hover:bg-panel">
              刷新
            </button>
          </div>
          {candidates.length === 0 && <div className="rounded-md border border-line bg-white p-4 text-sm text-slate-500">还没有待确认知识。新的会话总结会在这里沉淀为候选项。</div>}
          {candidates.map((candidate) => (
            <div key={candidate.id} className="rounded-md border border-line bg-white p-3">
              <div className="text-xs font-medium text-accent">{memoryCandidateKindLabel(candidate.kind)}</div>
              <div className="mt-1 text-sm font-semibold text-ink">{candidate.title}</div>
              <div className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-600">{candidate.content}</div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={loadingPanel === candidate.id}
                  onClick={() => approveCandidate(candidate.id)}
                  className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-700 disabled:opacity-60"
                >
                  确认入库
                </button>
                <button
                  type="button"
                  disabled={loadingPanel === candidate.id}
                  onClick={() => rejectCandidate(candidate.id)}
                  className="rounded-md border border-line px-3 py-1.5 text-xs text-slate-600 hover:bg-panel disabled:opacity-60"
                >
                  拒绝
                </button>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

export function MemoryStatusTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-line bg-white px-3 py-2">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="mt-1 font-semibold text-ink">{value}</div>
    </div>
  );
}

export function MemoryItemLists({
  notes,
  knowledgeItems,
  onRemoveNote,
  onRemoveKnowledgeItem
}: {
  notes: MemoryNote[];
  knowledgeItems: KnowledgeItem[];
  onRemoveNote: (noteId: string) => void;
  onRemoveKnowledgeItem: (item: KnowledgeItem) => void;
}) {
  return (
    <>
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
        {knowledgeItems.length === 0 && <div className="rounded-md border border-line bg-white p-4 text-sm text-slate-500">还没有上传文件或生成周报。</div>}
        {knowledgeItems.map((item) => (
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
    </>
  );
}

export function numberFromUnknown(value: unknown) {
  return typeof value === "number" ? value : Number(value || 0) || 0;
}

export function recordFromUnknown(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function formatDateTime(value?: string | null) {
  if (!value) return "暂无时间";
  const time = new Date(value);
  if (Number.isNaN(time.getTime())) return value;
  return time.toLocaleString();
}

export function memoryCandidateKindLabel(kind: string) {
  const labels: Record<string, string> = {
    decision: "决策",
    fact: "事实",
    task: "任务",
    preference: "偏好",
    repo_context: "项目上下文"
  };
  return labels[kind] ?? kind;
}

