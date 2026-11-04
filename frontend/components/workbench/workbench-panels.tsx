"use client";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { AlertTriangle, BookOpen, Cable, CheckCircle2, ChevronDown, Folder, Gauge, ListTodo, RefreshCw, ShieldCheck, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Repository } from "@/lib/types";
import { contextRecord, contextNumber, contextString, contextStageLabel, contextReasonLabel, parseRepositoryInput, type Issue, type PullRequest, type WorkflowRun, type WorkflowPlan, type IssueAnalysisResult, type PRAnalysisResult, type CIAnalysisResult, type IssueAnalysisTraceItem, type ChatTraceItem, type SkillResponse, type McpRuntime, type AddProjectStatus, type AddProjectSource } from "./shared";

export function WorkflowPlanCard({
  plan,
  status,
  disabled,
  onExecute
}: {
  plan: WorkflowPlan;
  status: "ready" | "executing" | "done" | "error";
  disabled: boolean;
  onExecute: () => void;
}) {
  const statusLabel = status === "executing" ? "执行中" : status === "done" ? "已执行" : status === "error" ? "执行失败" : "等待确认";
  return (
    <div className="rounded-md border border-teal-100 bg-teal-50/60 p-3 text-xs leading-5 text-slate-700">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-semibold text-ink">
            <ListTodo className="h-4 w-4 text-teal-700" />
            <span>计划模式</span>
            <span className="rounded-md bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500">{statusLabel}</span>
          </div>
          <div className="mt-1 line-clamp-2 text-slate-600">{plan.goal}</div>
        </div>
        <button
          type="button"
          onClick={onExecute}
          disabled={disabled || status === "executing" || status === "done"}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-accent px-3 text-xs font-medium text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "executing" ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          <span>{status === "done" ? "已执行" : status === "executing" ? "执行中" : "执行计划"}</span>
        </button>
      </div>
      <div className="mt-3 space-y-2">
        {plan.tasks.map((task, index) => (
          <div key={task.id} className="rounded-md border border-teal-100 bg-white px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-ink">
                {index + 1}. {task.agent_name}
              </span>
              <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">{task.task_type}</span>
            </div>
            <div className="mt-1 text-slate-600">{task.objective}</div>
            <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-500">
              {task.dependencies?.length ? <span>依赖：{task.dependencies.join(", ")}</span> : <span>无依赖</span>}
              <span>范围：{task.claim.target_type}</span>
              {task.critical && <span className="text-rose-600">关键任务</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ContextDiagnostics({
  compressionStats,
  progressiveCompaction,
  modelUsage,
  contextDiagnostics,
  collapsed,
  onToggle
}: {
  compressionStats: Record<string, unknown>;
  progressiveCompaction: Record<string, unknown>;
  modelUsage: Array<Record<string, unknown>>;
  contextDiagnostics: Record<string, unknown>;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pressure = contextRecord(compressionStats.pressure);
  const rawPressure = contextRecord(compressionStats.raw_history_pressure);
  const microcompact = contextRecord(compressionStats.microcompact);
  const boundary = contextRecord(compressionStats.compact_boundary);
  const promptBreakdown = contextRecord(compressionStats.prompt_breakdown);
  const historyCoverage = contextRecord(compressionStats.history_coverage);
  const progressivePressure = contextRecord(progressiveCompaction.pressure);
  const runtimeToolContext = contextRecord(contextDiagnostics.runtime_tool_context);
  const promptCalls = Array.isArray(contextDiagnostics.prompt_calls) ? contextDiagnostics.prompt_calls : [];
  const latestPromptCall = promptCalls.length > 0 ? contextRecord(promptCalls[promptCalls.length - 1]) : {};
  const latestUsage = modelUsage.length > 0 ? contextRecord(modelUsage[modelUsage.length - 1]) : {};
  const stage = contextString(progressivePressure.stage) || contextString(pressure.stage) || "normal";
  const tokenUsage = contextNumber(progressivePressure.token_usage) || contextNumber(pressure.token_usage);
  const windowTokens = contextNumber(progressivePressure.effective_window_tokens) || contextNumber(pressure.effective_window_tokens);
  const remainingTokens = contextNumber(progressivePressure.remaining_tokens) || contextNumber(pressure.remaining_tokens);
  const utilization = windowTokens > 0 ? Math.min(100, Math.round((tokenUsage / windowTokens) * 100)) : 0;
  const attempted = progressiveCompaction.attempted === true;
  const compacted = progressiveCompaction.compacted === true;
  const reason = contextString(progressiveCompaction.reason) || (compacted ? "compacted" : "未触发正式压缩");
  const microMessages = contextNumber(microcompact.compacted_messages);
  const microSaved = contextNumber(microcompact.estimated_tokens_saved);
  const rawTokens = contextNumber(progressivePressure.raw_segment_estimated_tokens) || contextNumber(rawPressure.token_usage);
  const assembledTokens = contextNumber(progressivePressure.assembled_context_estimated_tokens) || contextNumber(compressionStats.assembled_prompt_estimated_tokens) || contextNumber(compressionStats.system_context_estimated_tokens);
  const actualInputTokens = contextNumber(latestUsage.input_tokens);
  const providerUsage = contextString(latestUsage.source) === "provider";
  const toolSchemaTokens = contextNumber(latestPromptCall.tool_schema_tokens) || contextNumber(promptBreakdown.tool_schema_tokens);
  const runtimeSaved = contextNumber(runtimeToolContext.estimated_tokens_saved);
  const exactHistory = historyCoverage.complete_and_exact === true;
  const hasBoundary = historyCoverage.has_compaction_boundary === true;
  const stageStyle =
    stage === "manual_path"
      ? "bg-rose-100 text-rose-700"
      : stage === "aggressive"
        ? "bg-orange-100 text-orange-700"
        : stage === "auto_compact"
          ? "bg-amber-100 text-amber-700"
          : stage === "warning"
            ? "bg-yellow-100 text-yellow-700"
            : "bg-emerald-100 text-emerald-700";

  return (
    <div className="mt-3 border-t border-line pt-3">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 text-left text-xs text-slate-600"
      >
        <span className="flex min-w-0 items-center gap-2">
          <Gauge className="h-4 w-4 shrink-0 text-accent" />
          <span className="font-semibold text-ink">上下文诊断</span>
          <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium ${stageStyle}`}>{contextStageLabel(stage)}</span>
          {compacted && <span className="shrink-0 text-accent">已插入压缩边界</span>}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition ${collapsed ? "-rotate-90" : ""}`} />
      </button>

      {!collapsed && (
        <div className="mt-3 space-y-3 rounded-md bg-slate-50 p-3">
          <div>
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>上下文窗口占用</span>
              <span>{tokenUsage.toLocaleString()} / {windowTokens.toLocaleString()} tokens</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full rounded-full ${stage === "normal" ? "bg-emerald-500" : stage === "warning" ? "bg-yellow-500" : "bg-orange-500"}`}
                style={{ width: `${Math.max(2, utilization)}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-slate-400">
              <span>normal</span>
              <span>warning</span>
              <span>auto compact</span>
              <span>manual</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-md bg-line text-xs">
            <div className="bg-white px-3 py-2">
              <div className="text-slate-400">原始片段</div>
              <div className="mt-1 font-semibold text-ink">{rawTokens.toLocaleString()} tokens</div>
            </div>
            <div className="bg-white px-3 py-2">
              <div className="text-slate-400">组装后上下文</div>
              <div className="mt-1 font-semibold text-ink">{assembledTokens.toLocaleString()} tokens</div>
            </div>
            <div className="bg-white px-3 py-2">
              <div className="text-slate-400">剩余空间</div>
              <div className="mt-1 font-semibold text-ink">{remainingTokens.toLocaleString()} tokens</div>
            </div>
          </div>

          <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-ink">完整 Prompt 计量</span>
              <span className={providerUsage ? "text-emerald-700" : "text-slate-500"}>
                {providerUsage ? "供应商实际 usage" : "请求前估算"}
              </span>
            </div>
            <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-slate-500 sm:grid-cols-4">
              <span>实际输入：{actualInputTokens.toLocaleString()}</span>
              <span>组装估算：{assembledTokens.toLocaleString()}</span>
              <span>近期历史：{contextNumber(promptBreakdown.recent_history).toLocaleString()}</span>
              <span>工具 Schema：{toolSchemaTokens.toLocaleString()}</span>
            </div>
            {runtimeSaved > 0 && (
              <div className="mt-1 text-teal-700">轮内工具投影节省约 {runtimeSaved.toLocaleString()} tokens，完整结果仍保存在封存转录。</div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            <span className={exactHistory ? "text-emerald-700" : "text-amber-700"}>
              近期历史：{exactHistory ? "完整原文" : "已裁剪或省略"}
            </span>
            {hasBoundary && <span>更早原文可通过 transcript 工具跨 Boundary 精确回查</span>}
            {contextDiagnostics.reactive_overflow_retry === true && <span className="text-orange-700">本轮执行过一次溢出恢复</span>}
          </div>

          {(microMessages > 0 || microSaved > 0) && (
            <div className="flex items-start justify-between gap-4 border-l-2 border-teal-300 pl-3 text-xs leading-5">
              <div>
                <div className="font-semibold text-ink">Microcompact 轻量压缩</div>
                <div className="text-slate-500">清理 {microMessages} 条可重新获取的旧工具结果</div>
              </div>
              <div className="shrink-0 font-semibold text-teal-700">节省约 {microSaved.toLocaleString()} tokens</div>
            </div>
          )}

          <div className="border-l-2 border-amber-300 pl-3 text-xs leading-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-ink">正式压缩</span>
              <span className={attempted ? "text-amber-700" : "text-slate-500"}>{attempted ? (compacted ? "已完成" : "已尝试") : "未执行"}</span>
            </div>
            <div className="text-slate-500">原因：{contextReasonLabel(reason)}</div>
            {compacted && (
              <div className="mt-1 text-slate-600">
                摘要 {contextNumber(progressiveCompaction.messages_summarized)} 条，保留最近 {contextNumber(progressiveCompaction.messages_preserved)} 条，压缩后约 {contextNumber(progressiveCompaction.post_compact_estimated_tokens).toLocaleString()} tokens
              </div>
            )}
            {(contextString(progressiveCompaction.boundary_id) || contextString(boundary.id)) && (
              <div className="mt-1 truncate font-mono text-[11px] text-slate-400">
                boundary: {contextString(progressiveCompaction.boundary_id) || contextString(boundary.id)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


export function SkillMcpWorkspace({
  runtime,
  skills,
  selectedSkillName,
  loading,
  error,
  onSelectSkill,
  onRefresh
}: {
  runtime: McpRuntime | null;
  skills: SkillResponse[];
  selectedSkillName: string;
  loading: boolean;
  error: string | null;
  onSelectSkill: (name: string) => void;
  onRefresh: () => void;
}) {
  const selectedSkill = skills.find((item) => item.manifest.name === selectedSkillName) ?? skills[0];

  return (
    <div className="space-y-5">
      <section aria-label="MCP Server 验证">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Cable className="h-4 w-4 text-accent" />
              MCP Server 验证
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-500">页面会真实执行 initialize、initialized 与 tools/list。</p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-line bg-white px-2.5 text-xs font-medium text-slate-700 transition hover:bg-teal-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            重新验证
          </button>
        </div>

        {error && <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div>}
        {!runtime && !error && (
          <div className="mt-3 rounded-md border border-dashed border-line bg-white p-4 text-center text-xs text-slate-500">
            {loading ? "正在启动 stdio 子进程并执行 MCP 握手..." : "等待验证 MCP Server"}
          </div>
        )}
        {runtime && (
          <>
            <div className="mt-3 border-y border-line bg-white py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-ink">{runtime.server_name}</div>
                  <div className="mt-1 text-xs text-slate-500">Server v{runtime.server_version}</div>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  握手成功
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                <div><dt className="text-slate-400">Protocol</dt><dd className="mt-0.5 font-medium text-slate-700">{runtime.protocol_version}</dd></div>
                <div><dt className="text-slate-400">Transport</dt><dd className="mt-0.5 font-medium text-slate-700">{runtime.transport}</dd></div>
              </dl>
            </div>
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-ink">tools/list 返回结果</span>
                <span className="text-slate-500">{runtime.tools.length} 个只读工具</span>
              </div>
              <div className="mt-2 divide-y divide-line border-y border-line bg-white">
                {runtime.tools.map((tool) => (
                  <div key={tool.name} className="py-3">
                    <div className="break-all font-mono text-xs font-semibold text-accent">{tool.name}</div>
                    <p className="mt-1 text-xs leading-5 text-slate-600">{tool.description}</p>
                    <div className="mt-1 text-[11px] text-slate-400">
                      必填参数：{tool.input_schema.required?.join("、") || "无"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </section>

      <section aria-label="Skill Registry 验证" className="border-t border-line pt-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink">
          <BookOpen className="h-4 w-4 text-accent" />
          Skill Registry 验证
        </div>
        <label className="mt-3 block text-xs font-medium text-slate-600" htmlFor="skill-selector">选择已加载 Skill</label>
        <select
          id="skill-selector"
          value={selectedSkill?.manifest.name ?? ""}
          onChange={(event) => onSelectSkill(event.target.value)}
          className="mt-1 h-9 w-full rounded-md border border-line bg-white px-2 text-xs text-slate-700 outline-none focus:border-teal-400"
        >
          {skills.map((item) => <option key={item.manifest.name} value={item.manifest.name}>{item.manifest.title}</option>)}
        </select>

        {selectedSkill && (
          <div className="mt-3 border-y border-line bg-white py-3 text-xs">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-ink">{selectedSkill.manifest.title}</div>
                <div className="mt-1 font-mono text-[11px] text-slate-500">{selectedSkill.manifest.name}</div>
              </div>
              <span className="rounded-full bg-teal-50 px-2 py-1 font-semibold text-teal-700">v{selectedSkill.manifest.version}</span>
            </div>
            <p className="mt-3 leading-5 text-slate-600">{selectedSkill.manifest.description}</p>
            <dl className="mt-3 grid grid-cols-2 gap-3">
              <div><dt className="text-slate-400">Entrypoint</dt><dd className="mt-0.5 break-all font-mono text-[11px] font-medium text-slate-700">{selectedSkill.manifest.entrypoint}</dd></div>
              <div><dt className="text-slate-400">Safety</dt><dd className="mt-0.5 inline-flex items-center gap-1 font-medium text-emerald-700"><ShieldCheck className="h-3.5 w-3.5" />{selectedSkill.manifest.safety_level}</dd></div>
            </dl>
            <div className="mt-4 font-semibold text-ink">自动触发条件</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {selectedSkill.manifest.triggers.map((trigger) => <span key={trigger} className="rounded bg-teal-50 px-2 py-1 text-[10px] text-teal-700">{trigger}</span>)}
            </div>
            <div className="mt-4 font-semibold text-ink">工作流步骤</div>
            <ol className="mt-2 space-y-2">
              {selectedSkill.manifest.workflow_steps.map((step, index) => (
                <li key={step} className="flex items-start gap-2 text-slate-600">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600">{index + 1}</span>
                  <span className="break-all font-mono text-[11px] leading-5">{step}</span>
                </li>
              ))}
            </ol>
            <div className="mt-4 font-semibold text-ink">绑定工具</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {selectedSkill.manifest.tools.map((tool) => <span key={tool} className="rounded bg-slate-100 px-2 py-1 font-mono text-[10px] text-slate-600">{tool}</span>)}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export function ChatTraceInline({
  traceItems,
  collapsed,
  responsePending,
  onToggle
}: {
  traceItems: ChatTraceItem[];
  collapsed: boolean;
  responsePending: boolean;
  onToggle: () => void;
}) {
  if (!traceItems.length) return null;
  const runningCount = traceItems.filter((item) => item.status === "running").length;
  const errorCount = traceItems.filter((item) => item.status === "error").length;
  const toolCount = traceItems.filter((item) => item.kind === "tool" || item.kind === "error").length;
  const ragPrefetch = traceItems.find((item) => item.kind === "rag_prefetch");
  const statusLabel = responsePending ? "回复中" : runningCount > 0 ? "执行中" : errorCount > 0 ? `${errorCount} 个失败` : "已完成";
  return (
    <div className="space-y-2 border-l-2 border-teal-100 pl-3">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 rounded-md border border-line bg-slate-50 px-3 py-2 text-left text-xs text-slate-600 transition hover:border-teal-200 hover:bg-teal-50"
      >
        <span className="flex min-w-0 items-center gap-2">
          <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition ${collapsed ? "-rotate-90" : ""}`} />
          <span className="truncate font-semibold text-ink">工具调用过程</span>
          <span className="shrink-0 text-slate-500">
            {toolCount} 个工具 · {ragPrefetch ? `RAG 预检索 ${ragPrefetch.evidenceCount ?? 0} 条 · ` : ""}{traceItems.length} 条事件
          </span>
        </span>
        <span className={errorCount > 0 ? "shrink-0 text-rose-600" : responsePending || runningCount > 0 ? "shrink-0 text-accent" : "shrink-0 text-slate-500"}>
          {statusLabel}
        </span>
      </button>
      {!collapsed &&
        traceItems.map((item) => (
          <div
            key={item.id}
            className={`rounded-md px-3 py-2 text-xs leading-5 ${
              item.status === "error"
                ? "bg-rose-50 text-rose-700"
                : item.status === "running"
                  ? "bg-teal-50 text-slate-700"
                  : item.kind === "rag_prefetch"
                    ? "border border-cyan-100 bg-cyan-50 text-slate-700"
                  : "bg-slate-50 text-slate-600"
            }`}
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="font-semibold text-ink">{item.title}</span>
              {item.status === "running" && <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-accent" />}
            </div>
            {item.skillTitle && (
              <div className="mb-2 flex flex-wrap items-center gap-1.5 border-y border-teal-100 py-1.5 text-[11px] text-teal-700">
                <BookOpen className="h-3.5 w-3.5" />
                <span className="font-semibold">Skill：{item.skillTitle}</span>
                {item.skillVersion && <span>v{item.skillVersion}</span>}
                {item.skillName && <span className="font-mono text-teal-600">{item.skillName}</span>}
                {item.skillActivationMode && <span>· {item.skillActivationMode}</span>}
              </div>
            )}
            {item.kind === "thinking" ? (
              <MarkdownMessage content={item.content} />
            ) : (
              <div className="max-h-32 overflow-auto whitespace-pre-wrap">{item.content}</div>
            )}
            {item.skillSteps && item.skillSteps.length > 0 && (
              <div className="mt-2 border-t border-slate-200 pt-2">
                <div className="mb-1 font-semibold text-slate-600">Skill 工作流</div>
                <div className="flex flex-wrap gap-1">
                  {item.skillSteps.map((step, index) => (
                    <span key={step} className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-500">{index + 1}. {step}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
    </div>
  );
}

export function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ children, ...props }) => (
            <div className="markdown-table-wrap">
              <table {...props}>{children}</table>
            </div>
          )
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export function IssueAnalysisOverlay({
  issue,
  analysis,
  traceItems,
  loading,
  error,
  onRetry,
  onClose
}: {
  issue: Issue;
  analysis?: IssueAnalysisResult;
  traceItems: IssueAnalysisTraceItem[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onClose: () => void;
}) {
  const checklist = analysis?.checklist?.length ? analysis.checklist : analysis?.action_items ?? [];
  const drafts = analysis?.drafts;
  const hasDrafts = Boolean(drafts?.clarification_comment || drafts?.task_breakdown);
  const traceScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = traceScrollRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
  }, [traceItems]);

  return (
    <div className="absolute inset-0 z-50 grid grid-cols-1 items-center gap-3 bg-slate-950/35 p-4 backdrop-blur-sm xl:grid-cols-[280px_minmax(0,1fr)] xl:p-6">
      <aside className="order-2 flex max-h-[28vh] min-h-0 flex-col overflow-hidden rounded-lg border border-teal-100 bg-white/95 shadow-xl xl:order-1 xl:h-[86vh] xl:max-h-[86vh]">
        <div className="border-b border-line px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">Thinking Trace</div>
          <h3 className="mt-1 text-sm font-semibold text-ink">公开分析过程</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">展示工具调用、证据收集和面向用户的分析摘要。</p>
        </div>
        <div ref={traceScrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          {traceItems.length === 0 && (
            <div className="rounded-md border border-dashed border-line bg-panel p-3 text-xs leading-5 text-slate-500">
              点击“重新分析”后，这里会流式显示分析步骤。
            </div>
          )}
          {traceItems.map((item) => (
            <div
              key={item.id}
              className={`rounded-md border p-3 text-xs leading-5 shadow-sm ${
                item.kind === "error"
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : item.kind === "thinking"
                    ? "border-teal-200 bg-teal-50/80 text-slate-700"
                    : "border-line bg-white text-slate-600"
              }`}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="font-semibold text-ink">{item.title}</span>
                {item.status === "running" && <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-accent" />}
              </div>
              {item.kind === "thinking" ? <MarkdownMessage content={item.content} /> : <div className="whitespace-pre-wrap">{item.content}</div>}
            </div>
          ))}
        </div>
      </aside>

      <div role="dialog" aria-modal="true" className="order-1 flex max-h-[86vh] min-h-0 w-full flex-col overflow-hidden rounded-lg border border-line bg-white shadow-2xl xl:order-2">
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">Issue Agent</div>
            <h3 className="mt-1 line-clamp-2 text-base font-semibold text-ink">
              #{issue.number} {issue.title}
            </h3>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={onRetry}
              disabled={loading}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-line bg-white px-2.5 text-xs text-slate-600 transition hover:bg-teal-50 disabled:opacity-50"
              title="重新分析"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              重新分析
            </button>
            <button onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-white text-slate-500 transition hover:bg-panel" title="关闭">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading && !analysis && (
            <div className="rounded-md border border-line bg-panel p-4 text-sm text-slate-600">Issue Agent 正在检索 Issue、相似历史、代码、文档和会话上下文...</div>
          )}

          {error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-700">
              分析失败：{error}
            </div>
          )}

          {analysis && (
            <div className="space-y-4">
              <section className="rounded-md border border-teal-200 bg-teal-50/60 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-white">{analysis.conclusion}</span>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-600">优先级 {analysis.priority}</span>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-600">复杂度 {analysis.complexity}</span>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-600">分类 {analysis.category}</span>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-600">置信度 {Math.round((analysis.confidence ?? 0) * 100)}%</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-700">{analysis.conclusion_reason || analysis.summary}</p>
              </section>

              <section className="rounded-md border border-line bg-white p-4">
                <h4 className="text-sm font-semibold text-ink">建议负责人</h4>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  <span className="font-semibold text-ink">{analysis.suggested_owner}</span>
                  <span className="ml-2">{analysis.owner_reason}</span>
                </p>
              </section>

              <section className="rounded-md border border-line bg-white p-4">
                <h4 className="text-sm font-semibold text-ink">证据</h4>
                <div className="mt-3 space-y-2">
                  {(analysis.evidence ?? []).length === 0 && <div className="text-sm text-slate-500">暂无可用证据。</div>}
                  {(analysis.evidence ?? []).map((item, index) => (
                    <div key={`${item.source_type}-${item.reference ?? "ref"}-${index}`} className="rounded-md bg-[#fbf7f2] p-3 text-sm leading-6 text-slate-700">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] uppercase tracking-[0.08em] text-slate-500">{item.source_type}</span>
                        <span className="font-medium text-ink">{item.title}</span>
                        {typeof item.confidence === "number" && <span className="text-xs text-slate-400">{Math.round(item.confidence * 100)}%</span>}
                      </div>
                      <p className="mt-1">{item.snippet}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-md border border-line bg-white p-4">
                <h4 className="text-sm font-semibold text-ink">下一步 checklist</h4>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                  {checklist.map((item) => (
                    <li key={item} className="flex gap-2">
                      <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-accent" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>

              {hasDrafts && (
                <section className="rounded-md border border-line bg-white p-4">
                  <h4 className="text-sm font-semibold text-ink">可选草稿</h4>
                  {drafts?.clarification_comment && (
                    <div className="mt-3 rounded-md bg-panel p-3 text-sm leading-6 text-slate-700">
                      <div className="mb-2 text-xs font-semibold text-slate-500">澄清评论</div>
                      <MarkdownMessage content={drafts.clarification_comment} />
                    </div>
                  )}
                  {drafts?.task_breakdown && (
                    <div className="mt-3 rounded-md bg-panel p-3 text-sm leading-6 text-slate-700">
                      <div className="mb-2 text-xs font-semibold text-slate-500">任务拆分说明</div>
                      <MarkdownMessage content={drafts.task_breakdown} />
                    </div>
                  )}
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function AgentTraceAside({
  eyebrow,
  title,
  description,
  emptyLabel,
  traceItems
}: {
  eyebrow: string;
  title: string;
  description: string;
  emptyLabel: string;
  traceItems: IssueAnalysisTraceItem[];
}) {
  const traceScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = traceScrollRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
  }, [traceItems]);

  return (
    <aside className="order-2 flex max-h-[28vh] min-h-0 flex-col overflow-hidden rounded-lg border border-teal-100 bg-white/95 shadow-xl xl:order-1 xl:h-[86vh] xl:max-h-[86vh]">
      <div className="border-b border-line px-4 py-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">{eyebrow}</div>
        <h3 className="mt-1 text-sm font-semibold text-ink">{title}</h3>
        <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
      </div>
      <div ref={traceScrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {traceItems.length === 0 && (
          <div className="rounded-md border border-dashed border-line bg-panel p-3 text-xs leading-5 text-slate-500">{emptyLabel}</div>
        )}
        {traceItems.map((item) => (
          <div
            key={item.id}
            className={`rounded-md border p-3 text-xs leading-5 shadow-sm ${
              item.kind === "error"
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : item.kind === "thinking"
                  ? "border-teal-200 bg-teal-50/80 text-slate-700"
                  : "border-line bg-white text-slate-600"
            }`}
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="font-semibold text-ink">{item.title}</span>
              {item.status === "running" && <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-accent" />}
            </div>
            {item.kind === "thinking" ? <MarkdownMessage content={item.content} /> : <div className="whitespace-pre-wrap">{item.content}</div>}
          </div>
        ))}
      </div>
    </aside>
  );
}

export function PRAnalysisOverlay({
  pr,
  analysis,
  traceItems,
  loading,
  error,
  onRetry,
  onClose
}: {
  pr: PullRequest;
  analysis?: PRAnalysisResult;
  traceItems: IssueAnalysisTraceItem[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-0 z-50 grid grid-cols-1 items-center gap-3 bg-slate-950/35 p-4 backdrop-blur-sm xl:grid-cols-[280px_minmax(0,1fr)] xl:p-6">
      <AgentTraceAside
        eyebrow="Plan & Execute"
        title="PR Review 过程"
        description="展示 Review 计划、执行步骤、证据收集和合入判断。"
        emptyLabel="点击“重新分析”后，这里会流式显示 PR Review 计划和执行过程。"
        traceItems={traceItems}
      />

      <div role="dialog" aria-modal="true" className="order-1 flex max-h-[86vh] min-h-0 w-full flex-col overflow-hidden rounded-lg border border-line bg-white shadow-2xl xl:order-2">
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">PR Merge Readiness Agent</div>
            <h3 className="mt-1 line-clamp-2 text-base font-semibold text-ink">
              #{pr.number} {pr.title}
            </h3>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={onRetry}
              disabled={loading}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-line bg-white px-2.5 text-xs text-slate-600 transition hover:bg-teal-50 disabled:opacity-50"
              title="重新分析"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              重新分析
            </button>
            <button onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-white text-slate-500 transition hover:bg-panel" title="关闭">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading && !analysis && (
            <div className="rounded-md border border-line bg-panel p-4 text-sm text-slate-600">PR Agent 正在制定 Review 计划，并检查 diff、代码、CI、文档和 review comments...</div>
          )}

          {error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-700">
              分析失败：{error}
            </div>
          )}

          {analysis && (
            <div className="space-y-4">
              <section className="rounded-md border border-teal-200 bg-teal-50/60 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-white">{analysis.merge_recommendation}</span>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-600">置信度 {Math.round((analysis.confidence ?? 0) * 100)}%</span>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-600">风险点 {(analysis.risk_points ?? []).length}</span>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-600">阻塞项 {(analysis.blocking_issues ?? []).length}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-700">{analysis.recommendation_reason || analysis.summary}</p>
              </section>

              <section className="rounded-md border border-line bg-white p-4">
                <h4 className="text-sm font-semibold text-ink">Review 计划与执行</h4>
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <AnalysisBulletList title="计划" items={analysis.plan ?? []} emptyLabel="暂无计划。" />
                  <AnalysisBulletList title="已执行" items={analysis.executed_steps ?? []} emptyLabel="暂无执行记录。" />
                </div>
              </section>

              <section className="rounded-md border border-line bg-white p-4">
                <h4 className="text-sm font-semibold text-ink">变更与风险</h4>
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <AnalysisBulletList title="关键变更" items={analysis.key_changes ?? []} emptyLabel="暂无关键变更摘要。" />
                  <AnalysisBulletList title="风险点" items={analysis.risk_points ?? []} emptyLabel="暂无明显风险点。" tone="warn" />
                  <AnalysisBulletList title="阻塞项" items={analysis.blocking_issues ?? []} emptyLabel="暂无阻塞项。" tone="danger" />
                  <AnalysisBulletList title="重点文件" items={analysis.files_need_attention ?? []} emptyLabel="暂无重点文件。" />
                </div>
              </section>

              <section className="rounded-md border border-line bg-white p-4">
                <h4 className="text-sm font-semibold text-ink">合入前动作</h4>
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <AnalysisBulletList title="Review checklist" items={analysis.review_checklist ?? []} emptyLabel="暂无 checklist。" />
                  <AnalysisBulletList title="测试建议" items={analysis.test_suggestions ?? []} emptyLabel="暂无测试建议。" />
                </div>
              </section>

              {(analysis.review_comments ?? []).length > 0 && (
                <section className="rounded-md border border-line bg-white p-4">
                  <h4 className="text-sm font-semibold text-ink">Review comments 摘要</h4>
                  <AnalysisBulletList items={analysis.review_comments ?? []} emptyLabel="暂无 review comments。" />
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function CIAnalysisOverlay({
  run,
  analysis,
  traceItems,
  loading,
  error,
  onRetry,
  onClose
}: {
  run: WorkflowRun;
  analysis?: CIAnalysisResult;
  traceItems: IssueAnalysisTraceItem[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-0 z-50 grid grid-cols-1 items-center gap-3 bg-slate-950/35 p-4 backdrop-blur-sm xl:grid-cols-[280px_minmax(0,1fr)] xl:p-6">
      <AgentTraceAside
        eyebrow="Plan & Execute"
        title="CI 排查过程"
        description="展示排查计划、失败定位、日志证据和阻塞判断。"
        emptyLabel="点击“重新分析”后，这里会流式显示 CI 排查计划和执行过程。"
        traceItems={traceItems}
      />

      <div role="dialog" aria-modal="true" className="order-1 flex max-h-[86vh] min-h-0 w-full flex-col overflow-hidden rounded-lg border border-line bg-white shadow-2xl xl:order-2">
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">CI Root Cause Agent</div>
            <h3 className="mt-1 line-clamp-2 text-base font-semibold text-ink">{run.name}</h3>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={onRetry}
              disabled={loading}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-line bg-white px-2.5 text-xs text-slate-600 transition hover:bg-teal-50 disabled:opacity-50"
              title="重新分析"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              重新分析
            </button>
            <button onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-white text-slate-500 transition hover:bg-panel" title="关闭">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading && !analysis && (
            <div className="rounded-md border border-line bg-panel p-4 text-sm text-slate-600">CI Agent 正在制定排查计划，并检查失败 job、错误日志、相关文件和最近 PR...</div>
          )}

          {error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-700">
              分析失败：{error}
            </div>
          )}

          {analysis && (
            <div className="space-y-4">
              <section className="rounded-md border border-teal-200 bg-teal-50/60 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-white">{analysis.failure_type}</span>
                  <span className={`rounded-full px-2.5 py-1 text-xs ${analysis.is_merge_blocking ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
                    {analysis.is_merge_blocking ? "阻塞合并" : "不阻塞合并"}
                  </span>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-600">置信度 {Math.round((analysis.confidence ?? 0) * 100)}%</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-700">{analysis.root_cause || analysis.failure_summary}</p>
                {analysis.blocking_reason && <p className="mt-2 text-xs leading-5 text-slate-500">{analysis.blocking_reason}</p>}
              </section>

              <section className="rounded-md border border-line bg-white p-4">
                <h4 className="text-sm font-semibold text-ink">排查计划与执行</h4>
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <AnalysisBulletList title="计划" items={analysis.plan ?? []} emptyLabel="暂无计划。" />
                  <AnalysisBulletList title="已执行" items={analysis.executed_steps ?? []} emptyLabel="暂无执行记录。" />
                </div>
              </section>

              {analysis.first_error && (
                <section className="rounded-md border border-line bg-white p-4">
                  <h4 className="text-sm font-semibold text-ink">首个关键错误块</h4>
                  <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap rounded-md border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-900">{analysis.first_error}</pre>
                </section>
              )}

              <section className="rounded-md border border-line bg-white p-4">
                <h4 className="text-sm font-semibold text-ink">根因与修复</h4>
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <AnalysisBulletList title="可能原因" items={analysis.possible_causes ?? []} emptyLabel="暂无可能原因。" tone="warn" />
                  <AnalysisBulletList title="修复步骤" items={analysis.fix_steps ?? []} emptyLabel="暂无修复步骤。" />
                  <AnalysisBulletList title="排查步骤" items={analysis.debug_steps ?? []} emptyLabel="暂无排查步骤。" />
                  <AnalysisBulletList title="相关文件" items={analysis.related_files ?? []} emptyLabel="暂无相关文件。" />
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function AnalysisBulletList({
  title,
  items,
  emptyLabel,
  tone = "default"
}: {
  title?: string;
  items: string[];
  emptyLabel: string;
  tone?: "default" | "warn" | "danger";
}) {
  const iconClass = tone === "danger" ? "text-rose-500" : tone === "warn" ? "text-amber-500" : "text-accent";
  const Icon = tone === "default" ? CheckCircle2 : AlertTriangle;
  return (
    <div className="rounded-md bg-[#fbf7f2] p-3">
      {title && <div className="text-xs font-semibold text-slate-500">{title}</div>}
      {items.length === 0 ? (
        <div className={`${title ? "mt-2" : ""} text-sm text-slate-500`}>{emptyLabel}</div>
      ) : (
        <ul className={`${title ? "mt-2" : ""} space-y-2 text-sm leading-6 text-slate-700`}>
          {items.map((item) => (
            <li key={item} className="flex gap-2">
              <Icon className={`mt-1 h-4 w-4 shrink-0 ${iconClass}`} />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AddProjectOverlay({
  source,
  repoUrl,
  localPath,
  cloneParentDir,
  provider,
  apiBaseUrl,
  token,
  loading,
  status,
  onSourceChange,
  onRepoUrlChange,
  onLocalPathChange,
  onCloneParentDirChange,
  onProviderChange,
  onApiBaseUrlChange,
  onTokenChange,
  onConnect,
  onClose
}: {
  source: AddProjectSource;
  repoUrl: string;
  localPath: string;
  cloneParentDir: string;
  provider: string;
  apiBaseUrl: string;
  token: string;
  loading: boolean;
  status: AddProjectStatus | null;
  onSourceChange: (value: AddProjectSource) => void;
  onRepoUrlChange: (value: string) => void;
  onLocalPathChange: (value: string) => void;
  onCloneParentDirChange: (value: string) => void;
  onProviderChange: (value: string) => void;
  onApiBaseUrlChange: (value: string) => void;
  onTokenChange: (value: string) => void;
  onConnect: () => void;
  onClose: () => void;
}) {
  const parsed = source === "remote" ? parseRepositoryInput(repoUrl) : null;
  const canConnect = source === "local" ? Boolean(localPath.trim()) : Boolean(repoUrl.trim());

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-6 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-project-title"
        className="flex max-h-[calc(100%-24px)] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-line bg-[#eef9fb] shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-teal-100 bg-[#eef9fb] px-5 py-4">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Add Project</div>
            <h2 id="add-project-title" className="mt-1 text-xl font-semibold text-ink">
              添加项目
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line bg-white text-slate-600 transition hover:bg-teal-50 disabled:opacity-60"
            title="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
          <section className="rounded-md border border-line bg-white p-4 shadow-sm">
            <div className="grid gap-4">
              <div className="grid grid-cols-2 overflow-hidden rounded-md border border-line bg-slate-50 p-1">
                <button
                  type="button"
                  onClick={() => onSourceChange("remote")}
                  className={`h-9 rounded px-3 text-sm font-medium transition ${
                    source === "remote" ? "bg-white text-ink shadow-sm" : "text-slate-600 hover:text-ink"
                  }`}
                >
                  GitHub 地址
                </button>
                <button
                  type="button"
                  onClick={() => onSourceChange("local")}
                  className={`h-9 rounded px-3 text-sm font-medium transition ${
                    source === "local" ? "bg-white text-ink shadow-sm" : "text-slate-600 hover:text-ink"
                  }`}
                >
                  本地仓库
                </button>
              </div>

              {source === "remote" ? (
                <div className="grid gap-4">
                  <label className="text-sm font-medium text-slate-700">
                    GitHub 地址
                    <input
                      value={repoUrl}
                      onChange={(event) => onRepoUrlChange(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          onConnect();
                        }
                      }}
                      placeholder="https://github.com/owner/repository 或 owner/repository"
                      className="mt-2 h-11 w-full rounded-md border border-line bg-white px-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                    />
                  </label>

                  <label className="text-sm font-medium text-slate-700">
                    下载父目录
                    <input
                      value={cloneParentDir}
                      onChange={(event) => onCloneParentDirChange(event.target.value)}
                      placeholder="例如 D:\\code\\repos，留空则使用默认缓存目录"
                      className="mt-2 h-10 w-full rounded-md border border-line bg-white px-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                    />
                  </label>
                </div>
              ) : (
                <label className="text-sm font-medium text-slate-700">
                  本地仓库路径
                  <div className="mt-2 flex gap-2">
                    <input
                      value={localPath}
                      onChange={(event) => onLocalPathChange(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          onConnect();
                        }
                      }}
                      placeholder="例如 D:\\code\\my-repo"
                      className="h-11 min-w-0 flex-1 rounded-md border border-line bg-white px-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                    />
                    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-line bg-white text-slate-500">
                      <Folder className="h-4 w-4" />
                    </span>
                  </div>
                </label>
              )}

              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">
                  托管平台
                  <select
                    value={provider}
                    onChange={(event) => onProviderChange(event.target.value)}
                    className="mt-2 h-10 w-full rounded-md border border-line bg-white px-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                  >
                    <option value="github">GitHub</option>
                    <option value="github_compatible">GitHub-compatible API</option>
                  </select>
                </label>

                <label className="text-sm font-medium text-slate-700">
                  API Base URL
                  <input
                    value={apiBaseUrl}
                    disabled={provider === "github"}
                    onChange={(event) => onApiBaseUrlChange(event.target.value)}
                    className="mt-2 h-10 w-full rounded-md border border-line bg-white px-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </label>
              </div>

              <label className="text-sm font-medium text-slate-700">
                Access Token
                <input
                  type="password"
                  value={token}
                  onChange={(event) => onTokenChange(event.target.value)}
                  placeholder="public repo 可留空，私有仓库需要 token"
                  className="mt-2 h-10 w-full rounded-md border border-line bg-white px-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                />
              </label>

              {status && (
                <div
                  className={`rounded-md border px-3 py-2 text-sm leading-6 ${
                    status.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"
                  }`}
                >
                  <div className="font-semibold">{status.title}</div>
                  {status.detail && <div className="mt-1 break-words">{status.detail}</div>}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={onConnect}
                  disabled={loading || !canConnect}
                  className="inline-flex h-10 items-center justify-center rounded-md bg-accent px-4 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-60"
                >
                  {loading ? "连接并同步中..." : "连接并同步"}
                </button>
                <button
                  onClick={onClose}
                  disabled={loading}
                  className="inline-flex h-10 items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-panel disabled:opacity-60"
                >
                  关闭
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-md border border-line bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-ink">识别结果</h3>
            <div className="mt-3 rounded-md bg-[#fbf7f2] p-3 text-sm leading-7 text-slate-600">
              {source === "remote" ? (
                <>
                  <div>
                    Owner: <span className="font-medium text-ink">{parsed?.owner || "待识别"}</span>
                  </div>
                  <div>
                    Repository: <span className="font-medium text-ink">{parsed?.repo || "待识别"}</span>
                  </div>
                  <div>
                    下载到: <span className="break-all font-medium text-ink">{cloneParentDir.trim() || "默认缓存目录"}</span>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    本地路径: <span className="break-all font-medium text-ink">{localPath.trim() || "待选择"}</span>
                  </div>
                  <div>
                    远程仓库: <span className="font-medium text-ink">提交后从 origin 识别</span>
                  </div>
                </>
              )}
            </div>
            <div className="mt-4 space-y-2 text-xs leading-6 text-slate-500">
              {source === "remote" ? (
                <div>支持 `https://github.com/owner/repo`、`git@github.com:owner/repo.git`、`owner/repo`。</div>
              ) : (
                <div>本地仓库需要已配置 `origin` 远程地址。</div>
              )}
              <div>连接成功后会同步 GitHub 数据，并在后台索引代码用于代码 RAG 和风险分析。</div>
              <div>如果连接失败，会直接显示后端返回的原因，不再展开原始 JSON。</div>
            </div>
          </section>
          </div>
        </div>
      </div>
    </div>
  );
}

