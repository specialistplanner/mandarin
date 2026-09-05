import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import { RELEASE_TITLE, SITE_ORIGIN } from "@/lib/release";
import "./globals.css";

const sans = DM_Sans({ variable: "--font-sans", subsets: ["latin"] });
const display = Fraunces({ variable: "--font-display", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: RELEASE_TITLE,
  description: "A reliable, local-first weekly planner for specialist teaching, class progress and lesson history.",
  openGraph: {
    title: RELEASE_TITLE,
    description: "Plan the week, record teaching outcomes and keep every class’s progress aligned.",
    images: [{ url: "/og-v04.png", width: 1536, height: 1024 }],
  },
  twitter: {
    card: "summary_large_image",
    title: RELEASE_TITLE,
    description: "Plan the week, record teaching outcomes and keep every class’s progress aligned.",
    images: ["/og-v04.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${display.variable}`}>{children}</body>
    </html>
  );
}
