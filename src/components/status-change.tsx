import { AlertTriangle, CheckCircle2, CircleDot, XCircle } from "lucide-react";

function classify(change: string) {
  if (/dead|cancel|lapse|terminate/i.test(change)) return { label: "Dead", className: "text-red-700 dark:text-red-400", Icon: XCircle };
  if (/reject|delay|defer|slip/i.test(change)) return { label: "Delayed", className: "text-amber-700 dark:text-amber-400", Icon: AlertTriangle };
  if (/advance|expand|approve|renew|sign|ground|issue|begin/i.test(change)) return { label: "Upgraded", className: "text-green-700 dark:text-green-400", Icon: CheckCircle2 };
  return { label: "Updated", className: "text-muted-foreground", Icon: CircleDot };
}

export function StatusChange({ change }: { change: string }) {
  const { label, className, Icon } = classify(change);
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${className}`}>
      <Icon className="size-3.5" aria-hidden="true" /> {label}
    </span>
  );
}
