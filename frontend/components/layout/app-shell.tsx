"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

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
        </div>
      </header>
      <div className="mx-auto w-full max-w-[1440px] p-5">{children}</div>
    </main>
  );
}
