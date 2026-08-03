"use client";

import Link from "next/link";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-background/92 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between px-4 sm:px-6 lg:px-10">
        <Link href="/" className="group flex items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-4">
          <span className="grid size-7 place-items-center border border-foreground/40 font-mono text-[10px] font-semibold transition-transform group-hover:rotate-6">
            N×D
          </span>
          <span className="hidden leading-none sm:block">
            <span className="block font-mono text-[10px] font-semibold tracking-[0.2em]">NUCLEAR × COMPUTE</span>
            <span className="mt-1 block text-[10px] text-muted-foreground">PUBLIC DEAL LEDGER</span>
          </span>
        </Link>
        <nav aria-label="Primary navigation" className="flex items-center gap-1 sm:gap-2">
          <Button render={<Link href="/changelog" />} nativeButton={false} variant="ghost" size="sm">Changelog</Button>
          <Button render={<Link href="/about" />} nativeButton={false} variant="ghost" size="sm">Methodology</Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Toggle color theme"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          >
            <Sun className="hidden size-4 dark:block" />
            <Moon className="size-4 dark:hidden" />
          </Button>
        </nav>
      </div>
    </header>
  );
}
