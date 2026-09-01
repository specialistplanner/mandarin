import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const sans = DM_Sans({ variable: "--font-sans", subsets: ["latin"] });
const display = Fraunces({ variable: "--font-display", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const metadataBase = new URL(`${protocol}://${host}`);
  return {
    metadataBase,
    title: "Specialist Planner v0.3 — Teaching Session Engine",
    description: "A local-first specialist planner where confirmed teaching outcomes drive class progress and history.",
    openGraph: {
      title: "Specialist Planner v0.3 — Teaching Session Engine",
      description: "Confirm what happened in each lesson and keep progress and teaching history accurate.",
      images: [{ url: "/og-v03.png", width: 1536, height: 1024 }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Specialist Planner v0.3 — Teaching Session Engine",
      description: "Confirm what happened in each lesson and keep progress and teaching history accurate.",
      images: ["/og-v03.png"],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${display.variable}`}>{children}</body>
    </html>
  );
}
