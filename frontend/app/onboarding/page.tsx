"use client";

import { useState } from "react";
import { apiPost, setActiveTeamId } from "@/lib/api";

interface TeamPayload {
  team_id: string;
  team_name: string;
  role: string;
  invite_code?: string | null;
}

function finish(team: TeamPayload) {
  setActiveTeamId(team.team_id);
  window.location.href = "/";
}

export default function OnboardingPage() {
  const [teamName, setTeamName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"create" | "join" | null>(null);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy("create");
    try {
      const team = await apiPost<TeamPayload>("/api/teams", { name: teamName.trim() });
      finish(team);
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建团队失败");
      setBusy(null);
    }
  }

  async function handleJoin(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy("join");
    try {
      const team = await apiPost<TeamPayload>("/api/teams/join", {
        invite_code: joinCode.trim().toUpperCase()
      });
      finish(team);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加入团队失败");
      setBusy(null);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 p-6">
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center">
          <div className="flex items-baseline justify-center gap-1.5">
            <span className="text-2xl font-bold tracking-tight text-neutral-900">DevMate</span>
            <span className="text-sm font-medium uppercase tracking-[0.25em] text-neutral-400">AI</span>
          </div>
          <p className="mt-2 text-[13px] text-neutral-500">账号已创建。创建一个团队，或用邀请码加入现有团队</p>
        </div>

        {error ? (
          <p className="mx-auto mb-5 max-w-md rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-center text-[13px] text-neutral-800">
            {error}
          </p>
        ) : null}

        <div className="grid gap-5 md:grid-cols-2">
          <form
            onSubmit={handleCreate}
            className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm"
          >
            <h2 className="text-sm font-semibold text-neutral-900">创建团队</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-neutral-500">
              你将成为团队 Owner，负责接入仓库、邀请成员。
            </p>
            <label className="mt-4 block text-[13px] font-medium text-neutral-700">
              团队名称
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                required
                maxLength={200}
                className="mt-1.5 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-200"
                placeholder="如：平台研发组"
              />
            </label>
            <button
              type="submit"
              disabled={busy !== null}
              className="mt-4 w-full rounded-md bg-neutral-900 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === "create" ? "创建中…" : "创建团队"}
            </button>
          </form>

          <form
            onSubmit={handleJoin}
            className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm"
          >
            <h2 className="text-sm font-semibold text-neutral-900">加入团队</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-neutral-500">
              向团队 Owner 索要 8 位邀请码，加入后即可协作。
            </p>
            <label className="mt-4 block text-[13px] font-medium text-neutral-700">
              邀请码
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                required
                className="mt-1.5 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm uppercase tracking-widest outline-none transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-200"
                placeholder="如 K3P9QX2M"
              />
            </label>
            <button
              type="submit"
              disabled={busy !== null}
              className="mt-4 w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-sm font-medium text-neutral-900 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === "join" ? "加入中…" : "加入团队"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
