import { Link, useLocation } from "wouter";
import {
  BarChart3,
  Target,
  Users,
  FileText,
  Bell,
  Building2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Integration } from "@shared/schema";
import { useClient } from "@/lib/clientContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Sidebar() {
  const [location] = useLocation();
  const { clients, selectedClientId, setSelectedClientId } = useClient();

  const { data: integrations = [] } = useQuery<Integration[]>({
    queryKey: ["/api/integrations"],
  });

  const connectedIntegrations = integrations.filter(integration => integration.connected);
  const hasClient = selectedClientId !== null && clients.length > 0;

  const navItems = [
    { path: "/", label: "Dashboard", icon: BarChart3 },
    { path: "/campaigns", label: "Campaigns", icon: Target },
    { path: "/audiences", label: "Audiences", icon: Users },
    { path: "/reports", label: "Reports", icon: FileText },
    { path: "/notifications", label: "Notifications", icon: Bell },
  ];

  return (
    <aside className="w-64 shrink-0 bg-background border-r border-border flex flex-col min-h-screen">
      <div className="p-6 space-y-4">
        {/* Clients nav item — always active */}
        <nav className="space-y-1">
          <Link href="/clients">
            <div className={`nav-link ${location === "/clients" ? "nav-link-active" : "nav-link-inactive"}`}>
              <Building2 className="w-5 h-5" />
              <span>Clients</span>
            </div>
          </Link>
        </nav>

        {/* Client dropdown — shown when at least one client exists */}
        {clients.length > 0 && (
          <Select
            value={selectedClientId ?? ""}
            onValueChange={(val) => setSelectedClientId(val)}
          >
            <SelectTrigger className="w-full">
              <div className="flex items-center gap-2 min-w-0">
                <Building2 className="w-4 h-4 shrink-0 text-muted-foreground" />
                <SelectValue placeholder="Select client" />
              </div>
            </SelectTrigger>
            <SelectContent>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Main nav — greyed out when no client selected */}
        <nav className="space-y-2">
          {navItems.map((item) => {
            const isActive = location === item.path;
            const Icon = item.icon;

            if (!hasClient) {
              return (
                <div
                  key={item.path}
                  className="nav-link nav-link-inactive opacity-40 pointer-events-none cursor-not-allowed"
                  aria-disabled="true"
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </div>
              );
            }

            return (
              <Link key={item.path} href={item.path}>
                <div className={`nav-link ${isActive ? "nav-link-active" : "nav-link-inactive"}`}>
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Integration Status */}
      <div className="p-6 mt-auto gradient-card border-t border-border m-4 rounded-3xl">
        <h3 className="text-sm font-semibold text-foreground mb-3">Connected Platforms</h3>
        <div className="space-y-3">
          {connectedIntegrations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No platforms connected</p>
          ) : (
            connectedIntegrations.map((integration) => {
              let icon = "fas fa-plug";
              let iconColor = "text-slate-500";

              if (integration.platform === "facebook") {
                icon = "fab fa-facebook";
                iconColor = "text-blue-600";
              } else if (integration.platform === "google-analytics") {
                icon = "fab fa-google";
                iconColor = "text-red-500";
              } else if (integration.platform === "linkedin") {
                icon = "fab fa-linkedin";
                iconColor = "text-blue-700";
              } else if (integration.platform === "twitter") {
                icon = "fab fa-twitter";
                iconColor = "text-blue-400";
              } else if (integration.platform === "tiktok") {
                icon = "fab fa-tiktok";
                iconColor = "text-black";
              }

              return (
                <div key={integration.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <i className={`${icon} ${iconColor}`}></i>
                    <span className="text-sm text-foreground">{integration.name}</span>
                  </div>
                  <div className={`status-indicator ${integration.connected ? "status-connected" : "status-disconnected"}`}></div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </aside>
  );
}
