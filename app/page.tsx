import type { Metadata } from "next";
import { DashboardApp } from "./dashboard-app";

export const metadata: Metadata = {
  title: "Specialist Planner v0.4.1 — Class Colour Recognition",
  description: "A calm weekly teaching planner with optional, accessible class colours and independent progress status.",
};

export default function Home() {
  return <DashboardApp />;
}
