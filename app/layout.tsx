import type React from "react";
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

import ThemeInit from "@/components/theme-init";
import GlobalRefresh from "@/components/global-refresh";
import { PageTransition } from "@/components/page-transition";
import { Preloader } from "@/components/preloader";
import { Suspense } from "react";

import {
  Plus_Jakarta_Sans as V0_Font_Plus_Jakarta_Sans,
  IBM_Plex_Mono as V0_Font_IBM_Plex_Mono,
  Lora as V0_Font_Lora,
} from "next/font/google";

// Initialize fonts
const _plusJakartaSans = V0_Font_Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600", "700", "800"],
});
const _ibmPlexMono = V0_Font_IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700"],
});
const _lora = V0_Font_Lora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "PaperPaste",
  description: "Real-time clipboard sync across your devices.",
  generator: "somritdasgupta",
  icons: {
    icon: [
      {
        url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='12' fill='%237033ff' fill-opacity='0.1'/%3E%3Crect width='32' height='32' rx='12' fill='none' stroke='%237033ff' stroke-width='1' stroke-opacity='0.2'/%3E%3Crect x='8' y='8' width='16' height='16' rx='4' fill='%237033ff'/%3E%3C/svg%3E",
        sizes: "32x32",
        type: "image/svg+xml",
      },
    ],
  },
};

export function generateViewport() {
  return {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="antialiased">
      <body
        className="font-sans __variable_fb8f2c __variable_f910ec"
        suppressHydrationWarning={true}
      >
        <ThemeInit />
        <Preloader />
        {/* Global refresh scheduler for the whole webapp */}
        <GlobalRefresh interval={3000} />
        <Suspense>
          <PageTransition>{children}</PageTransition>
        </Suspense>
        <Analytics />
      </body>
    </html>
  );
}
