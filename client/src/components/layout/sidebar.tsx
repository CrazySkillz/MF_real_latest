import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  Home,
} from "lucide-react";
import { useClient } from "@/lib/clientContext";
import type { Campaign } from "@shared/schema";

export default function Sidebar() {
  const [location] = useLocation();
  const { clients, selectedClientId } = useClient();
  const campaignId = location.match(/^\/campaigns\/([^/?#]+)/)?.[1] || null;
  const { data: campaign } = useQuery<Campaign>({
    queryKey: ["/api/campaigns", campaignId],
    enabled: !!campaignId,
  });
  const currentClientId = campaignId ? campaign?.clientId : selectedClientId;
  const currentClient = clients.find((client) => client.id === currentClientId);

  return (
    <aside className="w-64 shrink-0 bg-card border-r border-border/40 flex flex-col min-h-screen">
      <div className="p-6 space-y-4">
        <div className="px-3 py-3 rounded-xl bg-muted/50 border border-border/60" aria-label="Current client">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Client</p>
          {currentClient ? (
            <p className="mt-1 font-semibold text-foreground truncate" title={currentClient.name}>{currentClient.name}</p>
          ) : campaignId ? (
            <div className="mt-2 h-5 w-3/4 rounded bg-muted animate-pulse" aria-hidden="true" />
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">No client selected</p>
          )}
        </div>
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
        </nav>
      </div>
    </aside>
  );
}
