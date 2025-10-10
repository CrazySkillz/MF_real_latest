import { Link, useLocation } from "wouter";
import { 
  BarChart3, 
  Target, 
  Users, 
  TrendingUp, 
  Plug,
  Plus,
  FileText,
  Bell
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Integration } from "@shared/schema";

export default function Sidebar() {
  const [location] = useLocation();
  
  const { data: integrations = [] } = useQuery<Integration[]>({
    queryKey: ["/api/integrations"],
  });

  const connectedIntegrations = integrations.filter(integration => integration.connected);

  const navItems = [
    { path: "/", label: "Dashboard", icon: BarChart3 },
    { path: "/campaigns", label: "Campaigns", icon: Target },
    { path: "/audiences", label: "Audiences", icon: Users },
    { path: "/reports", label: "Reports", icon: FileText },
    { path: "/notifications", label: "Notifications", icon: Bell },
  ];

  return (
    <aside className="w-64 bg-background border-r border-border flex flex-col min-h-screen">
      <div className="p-6">
        <nav className="space-y-2">
          {navItems.map((item) => {
            const isActive = location === item.path;
            const Icon = item.icon;
            
            return (
              <Link key={item.path} href={item.path}>
                <div className={`nav-link ${isActive ? 'nav-link-active' : 'nav-link-inactive'}`}>
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
                  <div className={`status-indicator ${integration.connected ? 'status-connected' : 'status-disconnected'}`}></div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </aside>
  );
}
