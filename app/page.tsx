import type { Metadata } from "next";
import { DashboardApp } from "./dashboard-app";

export const metadata: Metadata = {
  title: "Specialist Planner v0.3 — Teaching Session Engine",
  description: "A local-first specialist planner where confirmed teaching outcomes drive class progress and history.",
};

export default function Home() {
  return <DashboardApp />;
}
