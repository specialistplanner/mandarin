import { createRoot } from "react-dom/client";
import { DashboardApp } from "../app/dashboard-app";
import "../app/globals.css";

const root = document.getElementById("root");
if (!root) throw new Error("Specialist Planner root element is missing.");

createRoot(root).render(<DashboardApp />);
