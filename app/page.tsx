import type { Metadata } from "next";
import { DashboardApp } from "./dashboard-app";

export const metadata: Metadata = {
  title: "Specialist Planner v0.5 — Unit Library Integration Trial",
  description: "A progress-aware weekly planner with stable, read-only links to Unit Library resources.",
};

export default function Home() {
  return <DashboardApp />;
}
