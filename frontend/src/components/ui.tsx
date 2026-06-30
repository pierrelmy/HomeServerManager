import type { ReactNode } from "react"
import { Badge, Card } from "react-bootstrap"

export function PageShell({ children }: { children: ReactNode }) {
  return <div className="page-shell">{children}</div>
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
    <div className="page-header">
      <div className="page-header__content">
        {eyebrow ? <div className="page-eyebrow">{eyebrow}</div> : null}
        <h1 className="page-title">{title}</h1>
        {description ? <p className="page-description">{description}</p> : null}
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
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
  return <Card className={`surface-card ${className}`.trim()}><Card.Body>{children}</Card.Body></Card>
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
    <div className={`stat-tile stat-tile--${tone}`}>
      <div className="stat-tile__label">{label}</div>
      <div className="stat-tile__value">{value}</div>
      {meta ? <div className="stat-tile__meta">{meta}</div> : null}
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
  return <Badge className={`status-badge status-badge--${tone}`}>{children}</Badge>
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
    <div className="section-title">
      <div>
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
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
    <div className="empty-state">
      <div className="empty-state__title">{title}</div>
      {description ? <div className="empty-state__description">{description}</div> : null}
    </div>
  )
}
