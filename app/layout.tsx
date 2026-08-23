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
    title: "Specialist Planner v0.2 — Live Classroom Trial",
    description: "An editable, local-first planner for real specialist teaching weeks.",
    openGraph: {
      title: "Specialist Planner v0.2 — Live Classroom Trial",
      description: "Configure your real teaching week and see where every class is up to.",
      images: [{ url: "/og.png", width: 1732, height: 907 }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Specialist Planner v0.2 — Live Classroom Trial",
      description: "Configure your real teaching week and see where every class is up to.",
      images: ["/og.png"],
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
