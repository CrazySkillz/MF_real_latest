import { Link, useLocation } from "wouter";
import {
  BarChart3,
  Bell,
  Home,
} from "lucide-react";

export default function Sidebar() {
  const [location] = useLocation();

  return (
    <aside className="w-64 shrink-0 bg-card border-r border-border/40 flex flex-col min-h-screen">
      <div className="p-6 space-y-4">
        {/* Home link — always visible */}
        <nav className="space-y-1">
          <Link href="/">
            <div className={`nav-link ${location === "/" ? "nav-link-active" : "nav-link-inactive"}`}>
              <Home className="w-5 h-5" />
              <span>Home</span>
            </div>
          </Link>
          <Link href="/notifications">
            <div className={`nav-link ${location === "/notifications" ? "nav-link-active" : "nav-link-inactive"}`}>
              <Bell className="w-5 h-5" />
              <span>Notifications</span>
            </div>
          </Link>
          <Link href="/dashboard">
            <div className={`nav-link ${location === "/dashboard" ? "nav-link-active" : "nav-link-inactive"}`}>
              <BarChart3 className="w-5 h-5" />
              <span>Dashboard</span>
            </div>
          </Link>
        </nav>
      </div>
    </aside>
  );
}
