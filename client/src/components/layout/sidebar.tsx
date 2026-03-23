import { Link, useLocation } from "wouter";
import {
  BarChart3,
  Target,
  Users,
  FileText,
  Bell,
  Building2,
  Home,
  Plus,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Integration } from "@shared/schema";
import { useClient } from "@/lib/clientContext";
import CreateClientModal from "@/components/modals/create-client-modal";

export default function Sidebar() {
  const [location, setLocation] = useLocation();
  const { clients, selectedClientId, setSelectedClientId } = useClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedClientId, setExpandedClientId] = useState<string | null>(selectedClientId);

  const { data: integrations = [] } = useQuery<Integration[]>({
    queryKey: ["/api/integrations"],
  });

  const connectedIntegrations = integrations.filter(integration => integration.connected);

  const clientNavItems = [
    { path: "/dashboard", label: "Dashboard", icon: BarChart3 },
    { path: "/campaigns", label: "Campaigns", icon: Target },
    { path: "/audiences", label: "Audiences", icon: Users },
    { path: "/reports", label: "Reports", icon: FileText },
    { path: "/notifications", label: "Notifications", icon: Bell },
  ];

  const handleClientClick = (clientId: string) => {
    setSelectedClientId(clientId);
    setExpandedClientId(clientId);
    setLocation("/dashboard");
  };

  const handleToggleExpand = (clientId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedClientId(expandedClientId === clientId ? null : clientId);
  };

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
        </nav>

        {/* Clients section */}
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Clients</span>
            <button
              onClick={() => setIsModalOpen(true)}
              className="w-5 h-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Add client"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Client list */}
          <div className="space-y-0.5 max-h-[calc(100vh-380px)] overflow-y-auto">
            {clients.length === 0 ? (
              <button
                onClick={() => setIsModalOpen(true)}
                className="w-full text-left px-3 py-2 rounded-xl text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-200"
              >
                <Plus className="w-4 h-4 inline mr-2" />
                Add your first client
              </button>
            ) : (
              clients.map((client) => {
                const isSelected = selectedClientId === client.id;
                const isExpanded = expandedClientId === client.id;
                return (
                  <div key={client.id}>
                    {/* Client row */}
                    <div
                      className={`w-full flex items-center gap-1 px-2 py-2 rounded-xl text-sm transition-all duration-200 ${
                        isSelected
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      }`}
                    >
                      <button
                        onClick={(e) => handleToggleExpand(client.id, e)}
                        className="p-0.5 rounded hover:bg-black/10/10 transition-colors shrink-0"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => handleClientClick(client.id)}
                        className="flex items-center gap-2 min-w-0 flex-1"
                      >
                        <Building2 className="w-4 h-4 shrink-0" />
                        <span className="truncate">{client.name}</span>
                      </button>
                    </div>

                    {/* Sub-navigation (expanded) */}
                    {isExpanded && (
                      <div className="ml-4 pl-3 border-l border-border/50 space-y-0.5 py-1">
                        {clientNavItems.map((item) => {
                          const Icon = item.icon;
                          const isActive = item.path === "/dashboard"
                            ? location === "/dashboard"
                            : location.startsWith(item.path);
                          return (
                            <Link key={item.path} href={item.path} onClick={() => setSelectedClientId(client.id)}>
                              <div
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm transition-all duration-200 ${
                                  isActive
                                    ? "bg-primary/10 text-primary font-medium"
                                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                }`}
                              >
                                <Icon className="w-4 h-4" />
                                <span>{item.label}</span>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Integration Status */}
      <div className="p-5 mt-auto bg-accent/50 border-t border-border/30 m-4 rounded-2xl">
        <h3 className="text-sm font-semibold text-foreground mb-3">Connected Platforms</h3>
        <div className="space-y-3">
          {connectedIntegrations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No platforms connected</p>
          ) : (
            connectedIntegrations.map((integration) => {
              let icon = "fas fa-plug";
              let iconColor = "text-muted-foreground";

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

      <CreateClientModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </aside>
  );
}
