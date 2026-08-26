import { Atom } from "lucide-react";
import { cn } from "@/lib/utils";

export function NuclearMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg border bg-gradient-to-br from-card via-accent to-muted shadow-sm",
        className,
      )}
    >
      <span className="absolute inset-2 translate-x-0.5 translate-y-0.5 rounded-full bg-radioactive-glow/35 blur-sm" />
      <Atom className="relative z-10 size-5 -rotate-6 text-primary drop-shadow-sm" strokeWidth={1.75} />
      <span className="absolute top-1/2 left-1/2 z-20 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary bg-radioactive-glow shadow-sm" />
    </span>
  );
}
