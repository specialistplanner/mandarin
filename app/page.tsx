import type { Metadata } from "next";
import { DashboardApp } from "./dashboard-app";

export const metadata: Metadata = {
  title: "Specialist Planner v0.3.1 — Progress Reconciliation Hotfix",
  description: "A local-first specialist planner with safe historical reconciliation and dated progress checkpoints.",
};

export default function Home() {
  return <DashboardApp />;
}
