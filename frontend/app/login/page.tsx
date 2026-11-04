"use client";

import { useState } from "react";
import Link from "next/link";
import { apiPost, setActiveTeamId, type AuthMe } from "@/lib/api";

export default function LoginPage() {
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const me = await apiPost<AuthMe>("/api/auth/login", { account, password });
      const active = me.memberships.find((m) => m.is_last_active) ?? me.memberships[0] ?? null;
      setActiveTeamId(active?.team_id ?? null);
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="flex items-baseline justify-center gap-1.5">
            <span className="text-2xl font-bold tracking-tight text-neutral-900">DevMate</span>
            <span className="text-sm font-medium uppercase tracking-[0.25em] text-neutral-400">AI</span>
          </div>
          <p className="mt-2 text-[13px] text-neutral-500">登录以继续使用研发协作平台</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm"
        >
          <label className="block text-[13px] font-medium text-neutral-700">
            用户名或邮箱
            <input
              type="text"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              required
              autoFocus
              className="mt-1.5 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-200"
              placeholder="you@example.com"
            />
          </label>

          <label className="mt-4 block text-[13px] font-medium text-neutral-700">
            密码
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1.5 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-200"
              placeholder="••••••••"
            />
          </label>

          {error ? (
            <p className="mt-4 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-[13px] text-neutral-800">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="mt-5 w-full rounded-md bg-neutral-900 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "登录中…" : "登录"}
          </button>

          <p className="mt-4 text-center text-[13px] text-neutral-500">
            还没有账号？
            <Link href="/register" className="ml-1 font-medium text-neutral-900 underline underline-offset-2">
              注册
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
