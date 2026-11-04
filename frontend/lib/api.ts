export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

const ACTIVE_TEAM_STORAGE_KEY = "dm_active_team_id";

/** 当前活动团队（localStorage 持久化；登录/建队/切队时由调用方更新） */
export function getActiveTeamId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_TEAM_STORAGE_KEY);
}

export function setActiveTeamId(teamId: string | null): void {
  if (typeof window === "undefined") return;
  if (teamId) window.localStorage.setItem(ACTIVE_TEAM_STORAGE_KEY, teamId);
  else window.localStorage.removeItem(ACTIVE_TEAM_STORAGE_KEY);
}

function buildHeaders(init: RequestInit): Headers {
  const headers = new Headers(init.headers);
  const teamId = getActiveTeamId();
  if (teamId) headers.set("X-Team-Id", teamId);
  return headers;
}

async function perform(path: string, init: RequestInit): Promise<Response> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: buildHeaders(init)
  });
  // 会话失效 → 统一跳登录页（登录/注册接口自身的 401 除外）
  if (
    response.status === 401 &&
    !path.startsWith("/api/auth/") &&
    typeof window !== "undefined" &&
    !window.location.pathname.startsWith("/login")
  ) {
    window.location.href = "/login";
  }
  return response;
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await perform(path, { cache: "no-store" });
  if (!response.ok) await throwApiError(response);
  return response.json();
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await perform(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) await throwApiError(response);
  return response.json();
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const response = await perform(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) await throwApiError(response);
  return response.json();
}

export async function apiUpload<T>(path: string, body: FormData): Promise<T> {
  const response = await perform(path, {
    method: "POST",
    body
  });
  if (!response.ok) await throwApiError(response);
  return response.json();
}

export async function apiPostStream(
  path: string,
  body: unknown,
  onEvent: (event: string, data: unknown) => void,
  options: { signal?: AbortSignal } = {}
): Promise<void> {
  const response = await perform(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: options.signal
  });
  if (!response.ok) await throwApiError(response);
  if (!response.body) throw new Error("Streaming response body is not available.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const rawEvent of events) {
      const lines = rawEvent.split("\n");
      const event = lines.find((line) => line.startsWith("event: "))?.slice(7) ?? "message";
      const dataText = lines
        .filter((line) => line.startsWith("data: "))
        .map((line) => line.slice(6))
        .join("\n");
      if (dataText) onEvent(event, JSON.parse(dataText));
    }
  }
}

export async function apiDelete<T>(path: string): Promise<T> {
  const response = await perform(path, { method: "DELETE" });
  if (!response.ok) await throwApiError(response);
  return response.json();
}

async function throwApiError(response: Response): Promise<never> {
  const fallback = `${response.status} ${response.statusText}`.trim();
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    let message: string | null = null;
    try {
      const payload = await response.json();
      message = readApiErrorMessage(payload);
    } catch {
      message = null;
    }
    throw new Error(message || fallback);
  }
  const text = (await response.text()).trim();
  throw new Error(text || fallback);
}

function readApiErrorMessage(payload: unknown): string | null {
  if (typeof payload === "string") return payload;
  if (!payload || typeof payload !== "object") return null;
  const detail = (payload as { detail?: unknown }).detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (item && typeof item === "object" && "msg" in item) return String((item as { msg: unknown }).msg);
        return typeof item === "string" ? item : null;
      })
      .filter(Boolean);
    return messages.length ? messages.join("; ") : null;
  }
  const message = (payload as { message?: unknown }).message;
  return typeof message === "string" ? message : null;
}

/** /api/auth/me 的响应结构（前端类型） */
export interface AuthMe {
  id: string;
  username: string | null;
  email: string | null;
  name: string;
  public_code: string | null;
  last_active_team_id: string | null;
  memberships: Array<{ team_id: string; team_name: string; role: string; is_last_active: boolean }>;
}
