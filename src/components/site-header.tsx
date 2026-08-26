import Link from "next/link";
import { Button } from "@/components/ui/button";
import { NuclearMark } from "@/components/nuclear-mark";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/92 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1920px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="Nuclear Atlas home" className="group flex items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-4">
          <NuclearMark className="transition-transform group-hover:-translate-y-0.5" />
          <span className="hidden leading-none sm:block">
            <span className="block text-xs font-semibold tracking-wide">NUCLEAR ATLAS</span>
            <span className="mt-1 block text-[0.6875rem] text-muted-foreground">PUBLIC EVIDENCE DASHBOARD</span>
          </span>
        </Link>
        <nav aria-label="Primary navigation" className="flex items-center gap-1 sm:gap-2">
          <Button render={<Link href="/changelog" />} nativeButton={false} variant="ghost" size="sm">Changelog</Button>
          <Button render={<Link href="/about" />} nativeButton={false} variant="ghost" size="sm">Methodology</Button>
        </nav>
      </div>
    </header>
  );
}
