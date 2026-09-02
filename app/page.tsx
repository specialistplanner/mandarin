import type { Metadata } from "next";
import { DashboardApp } from "./dashboard-app";

export const metadata: Metadata = {
  title: "Specialist Planner v0.4 — Progress-Aware Weekly Planner",
  description: "A calm weekly teaching planner that combines timetable structure, class progress and real lesson outcomes.",
};

export default function Home() {
  return <DashboardApp />;
}
