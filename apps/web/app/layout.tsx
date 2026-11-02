import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

import { APP_NAME } from "@repo/env/client";
import { Toaster } from "@repo/ui/components/sonner";
import { ThemeProvider } from "@repo/ui/components/theme-provider";

import { siteUrl } from "@/lib/site-url";

import "./globals.css";

const fontSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const fontMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

const description = `Browse and manage records in ${APP_NAME}.`;

export const metadata: Metadata = {
  // Absolute base for OG/canonical URLs; without it they'd resolve against
  // localhost when self-hosted.
  metadataBase: new URL(siteUrl()),
  title: {
    default: APP_NAME,
    template: `%s · ${APP_NAME}`,
  },
  description,
  // OG image is auto-discovered from app/opengraph-image.tsx; this block
  // sets the surrounding text so previews render correctly on Slack,
  // Discord, LinkedIn, etc.
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    title: APP_NAME,
    description,
  },
  twitter: {
    card: "summary_large_image",
    title: APP_NAME,
    description,
  },
  appleWebApp: {
    capable: true,
    title: APP_NAME,
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fontSans.variable} ${fontMono.variable}`}
    >
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster richColors position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
