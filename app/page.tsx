import type { Metadata } from "next";
import { DashboardApp } from "./dashboard-app";

export const metadata: Metadata = {
  title: "Specialist Progress Dashboard",
  description: "See where every specialist class is up to, at a glance.",
};

export default function Home() {
  return <DashboardApp />;
}
