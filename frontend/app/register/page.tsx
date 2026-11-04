"use client";

import { useState } from "react";
import Link from "next/link";
import { apiPost, setActiveTeamId, type AuthMe } from "@/lib/api";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }
    setSubmitting(true);
    try {
      const me = await apiPost<AuthMe>("/api/auth/register", {
        username,
        email,
        password,
        invite_code: inviteCode.trim() ? inviteCode.trim().toUpperCase() : null
      });
      const active = me.memberships.find((m) => m.is_last_active) ?? me.memberships[0] ?? null;
      setActiveTeamId(active?.team_id ?? null);
      // 有团队直接进入；没有则引导创建/加入团队
      window.location.href = active ? "/" : "/onboarding";
    } catch (err) {
      setError(err instanceof Error ? err.message : "注册失败");
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
          <p className="mt-2 text-[13px] text-neutral-500">创建你的账号，随后创建或加入团队</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm"
        >
          <label className="block text-[13px] font-medium text-neutral-700">
            用户名
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
              pattern="[a-zA-Z0-9_-]{3,80}"
              title="3-80 位字母、数字、下划线或连字符"
              className="mt-1.5 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-200"
              placeholder="字母、数字或下划线"
            />
          </label>

          <label className="mt-4 block text-[13px] font-medium text-neutral-700">
            邮箱
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
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
              minLength={8}
              className="mt-1.5 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-200"
              placeholder="至少 8 位"
            />
          </label>

          <label className="mt-4 block text-[13px] font-medium text-neutral-700">
            确认密码
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="mt-1.5 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-200"
              placeholder="再次输入密码"
            />
          </label>

          <label className="mt-4 block text-[13px] font-medium text-neutral-700">
            团队邀请码<span className="ml-1 font-normal text-neutral-400">（可选，稍后也可以加入）</span>
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm uppercase tracking-widest outline-none transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-200"
              placeholder="如 K3P9QX2M"
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
            {submitting ? "创建账号中…" : "创建账号"}
          </button>

          <p className="mt-4 text-center text-[13px] text-neutral-500">
            已有账号？
            <Link href="/login" className="ml-1 font-medium text-neutral-900 underline underline-offset-2">
              登录
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
