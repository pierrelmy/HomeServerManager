import { clsx } from "clsx"
import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react"

export function PageShell({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-6">{children}</div>
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        {eyebrow ? <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-400">{eyebrow}</div> : null}
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">{title}</h1>
        {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  )
}

export function Surface({
  children,
  className = "",
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section className={clsx("rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900", className)}>
      {children}
    </section>
  )
}

export function StatTile({
  label,
  value,
  meta,
  tone = "neutral",
}: {
  label: string
  value: ReactNode
  meta?: ReactNode
  tone?: "neutral" | "primary" | "success" | "warning" | "danger"
}) {
  return (
    <div
      className={clsx(
        "rounded-3xl border bg-white p-5 shadow-sm transition-colors dark:bg-slate-900",
        tone === "primary" && "border-sky-200 dark:border-sky-900",
        tone === "success" && "border-emerald-200 dark:border-emerald-900",
        tone === "warning" && "border-amber-200 dark:border-amber-900",
        tone === "danger" && "border-rose-200 dark:border-rose-900",
        tone === "neutral" && "border-slate-200 dark:border-slate-800",
      )}
    >
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">{value}</div>
      {meta ? <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">{meta}</div> : null}
    </div>
  )
}

export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode
  tone?: "neutral" | "primary" | "success" | "warning" | "danger"
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium",
        tone === "primary" && "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300",
        tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
        tone === "warning" && "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
        tone === "danger" && "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300",
        tone === "neutral" && "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
      )}
    >
      {children}
    </span>
  )
}

export function SectionTitle({
  title,
  subtitle,
  trailing,
}: {
  title: string
  subtitle?: string
  trailing?: ReactNode
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div>
        <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{subtitle}</p> : null}
      </div>
      {trailing ? <div>{trailing}</div> : null}
    </div>
  )
}

export function EmptyState({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-6 text-center dark:border-slate-700 dark:bg-slate-800/40">
      <div className="font-medium text-slate-900 dark:text-slate-100">{title}</div>
      {description ? <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{description}</div> : null}
    </div>
  )
}

export function Button({
  className,
  variant = "primary",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost"
}) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary" && "bg-sky-600 text-white hover:bg-sky-500 dark:bg-sky-500 dark:hover:bg-sky-400",
        variant === "secondary" && "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800",
        variant === "danger" && "bg-rose-600 text-white hover:bg-rose-500 dark:bg-rose-500 dark:hover:bg-rose-400",
        variant === "ghost" && "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function Alert({
  className,
  tone = "warning",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  tone?: "warning" | "danger" | "success" | "neutral"
}) {
  return (
    <div
      className={clsx(
        "rounded-2xl border px-4 py-3 text-sm",
        tone === "warning" && "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200",
        tone === "danger" && "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200",
        tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200",
        tone === "neutral" && "border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={clsx("w-full rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500", props.className)} />
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={clsx("w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500", props.className)} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={clsx("w-full rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100", props.className)} />
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
      {children}
      {hint ? <span className="text-xs text-slate-500 dark:text-slate-400">{hint}</span> : null}
    </label>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">
      <span className="text-sm text-slate-700 dark:text-slate-200">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={clsx(
          "relative h-7 w-12 rounded-full transition",
          checked ? "bg-sky-600 dark:bg-sky-500" : "bg-slate-300 dark:bg-slate-700",
        )}
      >
        <span className={clsx("absolute top-1 h-5 w-5 rounded-full bg-white transition", checked ? "left-6" : "left-1")} />
      </button>
    </label>
  )
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  size = "md",
}: {
  value: T
  onChange: (value: T) => void
  options: Array<{ value: T; label: string; icon?: ReactNode }>
  size?: "sm" | "md"
}) {
  return (
    <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-900">
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={clsx(
              "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition",
              size === "sm" ? "px-2.5 py-2 text-xs" : "px-4 py-2 text-sm",
              active
                ? "bg-white text-slate-950 shadow-sm dark:bg-slate-800 dark:text-slate-50"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-50",
            )}
          >
            {option.icon}
            <span>{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function ProgressBar({ value, tone = "primary" }: { value: number; tone?: "primary" | "success" | "warning" | "danger" }) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
      <div
        className={clsx(
          "h-full rounded-full transition-[width]",
          tone === "primary" && "bg-sky-500",
          tone === "success" && "bg-emerald-500",
          tone === "warning" && "bg-amber-500",
          tone === "danger" && "bg-rose-500",
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}

export function Spinner({ className = "" }: { className?: string }) {
  return <span className={clsx("inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent", className)} />
}
