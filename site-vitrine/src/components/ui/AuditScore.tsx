"use client";

import { motion } from "framer-motion";

export function AuditScore({
  label,
  score,
  delay = 0,
}: {
  label: string;
  score: number;
  delay?: number;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-muted)]">
          {label}
        </span>
        <span className="font-display text-sm font-medium text-[var(--color-text)]">
          {score}
          <span className="text-[var(--color-muted)]">/100</span>
        </span>
      </div>
      <div className="h-[3px] w-full overflow-hidden rounded-full bg-[var(--color-border)]">
        <motion.div
          className="h-full rounded-full bg-[var(--color-accent)]"
          initial={{ width: 0 }}
          whileInView={{ width: `${score}%` }}
          viewport={{ once: true }}
          transition={{ duration: 1.1, delay, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  );
}
