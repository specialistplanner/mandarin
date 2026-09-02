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
    title: "Specialist Planner v0.4 — Progress-Aware Weekly Planner",
    description: "A calm weekly teaching planner that combines timetable structure, class progress and real lesson outcomes.",
    openGraph: {
      title: "Specialist Planner v0.4 — Progress-Aware Weekly Planner",
      description: "See who you teach, what comes next and which classes need attention across one working week.",
      images: [{ url: "/og-v04.png", width: 1536, height: 1024 }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Specialist Planner v0.4 — Progress-Aware Weekly Planner",
      description: "See who you teach, what comes next and which classes need attention across one working week.",
      images: ["/og-v04.png"],
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
