import { Link, useLocation } from "wouter";
import { 
  BarChart3, 
  Target, 
  Users, 
  TrendingUp, 
  Plug,
  Plus
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
    { path: "/analytics", label: "Analytics", icon: TrendingUp },
    { path: "/integrations", label: "Integrations", icon: Plug },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
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
      <div className="p-6 mt-auto border-t border-slate-200">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Connected Platforms</h3>
        <div className="space-y-3">
          {connectedIntegrations.length === 0 ? (
            <p className="text-sm text-slate-500">No platforms connected</p>
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
              }
              
              return (
                <div key={integration.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <i className={`${icon} ${iconColor}`}></i>
                    <span className="text-sm text-slate-700">{integration.name}</span>
                  </div>
                  <div className={`status-indicator ${integration.connected ? 'status-connected' : 'status-disconnected'}`}></div>
                </div>
              );
            })
          )}
          
          <Link href="/integrations">
            <div className="w-full text-left px-3 py-2 text-sm text-primary hover:bg-primary hover:bg-opacity-5 rounded-lg transition-colors flex items-center cursor-pointer">
              <Plus className="w-4 h-4 mr-2" />
              Add Integration
            </div>
          </Link>
        </div>
      </div>
    </aside>
  );
}
