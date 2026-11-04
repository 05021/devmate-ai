"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { apiGet, apiPost, getActiveTeamId, setActiveTeamId, type AuthMe } from "@/lib/api";

const AUTH_PATHS = ["/login", "/register", "/onboarding"];

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/knowledge", label: "项目知识" },
  { href: "/rag", label: "RAG 工作室" },
  { href: "/repos", label: "Repos" },
  { href: "/action-drafts", label: "Drafts" },
  { href: "/workflow-runs", label: "Runs" },
  { href: "/workspaces", label: "团队工作区" },
  { href: "/reports", label: "研发周报" },
  { href: "/code-graph", label: "Code Graph" },
  { href: "/evals", label: "Evals" }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [me, setMe] = useState<AuthMe | null>(null);
  const [teamMenuOpen, setTeamMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isAuthPage = AUTH_PATHS.some((page) => pathname === page || pathname.startsWith(`${page}/`));

  useEffect(() => {
    if (isAuthPage) return;
    let cancelled = false;
    apiGet<AuthMe>("/api/auth/me")
      .then((data) => {
        if (cancelled) return;
        setMe(data);
        // 同步本地团队上下文（登录页之外的入口，如刷新后）
        if (!getActiveTeamId()) {
          const active = data.memberships.find((m) => m.is_last_active) ?? data.memberships[0] ?? null;
          if (active) setActiveTeamId(active.team_id);
        }
      })
      .catch(() => {
        // 401 由 api 层统一跳登录；此处静默
      });
    return () => {
      cancelled = true;
    };
  }, [pathname, isAuthPage]);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setTeamMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  if (isAuthPage) {
    return <>{children}</>;
  }

  const activeTeam =
    me?.memberships.find((m) => m.team_id === me.last_active_team_id) ?? me?.memberships[0] ?? null;

  async function handleSwitchTeam(teamId: string) {
    setTeamMenuOpen(false);
    try {
      await apiPost("/api/auth/switch-team", { team_id: teamId });
    } catch {
      // 切换失败不阻塞，仍更新本地上下文
    }
    setActiveTeamId(teamId);
    window.location.href = "/";
  }

  async function handleLogout() {
    try {
      await apiPost("/api/auth/logout", {});
    } finally {
      setActiveTeamId(null);
      window.location.href = "/login";
    }
  }

  return (
    <main className="min-h-screen bg-white">
      <header className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3">
          <Link href="/" className="flex items-baseline gap-1.5 text-sm tracking-tight">
            <span className="text-base font-bold text-ink">DevMate</span>
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-400">AI</span>
          </Link>
          <nav className="flex flex-1 flex-wrap items-center gap-0.5">
            {navItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "rounded-md px-2.5 py-1.5 text-[13px] leading-none transition",
                    active
                      ? "bg-neutral-900 text-white"
                      : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            {/* 团队切换器（一期常为单团队；多团队时下拉切换） */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setTeamMenuOpen((open) => !open)}
                className="flex items-center gap-1.5 rounded-md border border-neutral-200 px-2.5 py-1.5 text-[13px] text-neutral-700 transition hover:bg-neutral-100"
                title="切换团队"
              >
                <span className="font-medium">{activeTeam ? activeTeam.team_name : "未加入团队"}</span>
                {activeTeam ? (
                  <span className="rounded bg-neutral-100 px-1 py-0.5 text-[10px] uppercase text-neutral-500">
                    {activeTeam.role}
                  </span>
                ) : null}
                {me && me.memberships.length > 1 ? <span className="text-neutral-400">▾</span> : null}
              </button>
              {teamMenuOpen && me && me.memberships.length > 1 ? (
                <div className="absolute right-0 top-full mt-1 w-52 rounded-md border border-neutral-200 bg-white py-1 shadow-lg">
                  {me.memberships.map((membership) => (
                    <button
                      key={membership.team_id}
                      type="button"
                      onClick={() => handleSwitchTeam(membership.team_id)}
                      className={clsx(
                        "flex w-full items-center justify-between px-3 py-2 text-left text-[13px] hover:bg-neutral-100",
                        activeTeam?.team_id === membership.team_id ? "font-medium text-neutral-900" : "text-neutral-600"
                      )}
                    >
                      <span>{membership.team_name}</span>
                      <span className="text-[10px] uppercase text-neutral-400">{membership.role}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <span className="hidden text-[13px] text-neutral-500 sm:inline">
              {me?.name ?? ""}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-md px-2.5 py-1.5 text-[13px] text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
            >
              退出
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-[1440px] p-5">{children}</div>
    </main>
  );
}
