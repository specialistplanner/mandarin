import type { Metadata } from "next";
import { DashboardApp } from "./dashboard-app";

export const metadata: Metadata = {
  title: "Specialist Planner v0.2.1 — Live Trial Hotfix",
  description: "An editable, local-first planner for real specialist teaching weeks.",
};

export default function Home() {
  return <DashboardApp />;
}
