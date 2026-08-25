import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { TooltipProvider } from "@/components/ui/tooltip";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://nuclearatlas.lucaschatham.com"),
  title: {
    default: "Nuclear Atlas",
    template: "%s | Nuclear Atlas",
  },
  description:
    "A global public evidence atlas for nuclear projects, fuel, operations, spent fuel, waste, and decommissioning.",
  alternates: { canonical: "/" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${plexSans.variable} ${plexMono.variable} min-h-full bg-background font-sans text-foreground antialiased`}
      >
        <TooltipProvider>
          <SiteHeader />
          {children}
        </TooltipProvider>
      </body>
    </html>
  );
}
