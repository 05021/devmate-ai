import { clsx } from "clsx";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <section className={clsx("rounded-lg border border-line bg-white p-5", className)}>{children}</section>
  );
}

export function PageTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-6 flex flex-col gap-2 border-b border-line pb-5">
      <div className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-400">DevMate AI</div>
      <h1 className="text-2xl font-semibold tracking-tight text-ink md:text-3xl">{title}</h1>
      <p className="max-w-3xl text-sm leading-6 text-neutral-500">{description}</p>
    </div>
  );
}

export function PrimaryButton({ children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function GhostButton({ children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={clsx(
        "w-full rounded-md border border-line bg-white px-3 py-2 text-left text-sm text-neutral-600 transition hover:border-neutral-900 hover:text-neutral-900",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
