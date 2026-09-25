import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CONSULTATION_STATUS, PROJECT_STATUS, RESPONSE_STATUS } from "@/lib/labels";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  back,
  actions,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-8">
      {back ? (
        <Link href={back.href} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description ? <div className="mt-1.5 text-sm text-muted-foreground">{description}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-16 text-center">
      <p className="font-medium">{title}</p>
      {description ? <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function ProjectStatusBadge({ status }: { status: string }) {
  const s = PROJECT_STATUS[status] ?? { label: status, tone: "neutral" as const };
  return <Badge variant={s.tone}>{s.label}</Badge>;
}

export function ConsultationStatusBadge({ status }: { status: string }) {
  const s = CONSULTATION_STATUS[status] ?? { label: status, tone: "neutral" as const };
  return <Badge variant={s.tone}>{s.label}</Badge>;
}

export function ResponseStatusBadge({ status }: { status: string }) {
  const s = RESPONSE_STATUS[status] ?? { label: status, tone: "neutral" as const };
  return <Badge variant={s.tone}>{s.label}</Badge>;
}

export function Progress({ value, max, className }: { value: number; max: number; className?: string }) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-secondary", className)} role="progressbar" aria-valuenow={value} aria-valuemax={max}>
      <div className="h-full rounded-full bg-success transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function ToVerify({ className }: { className?: string }) {
  return (
    <Badge variant="warning" className={className}>
      À vérifier
    </Badge>
  );
}
