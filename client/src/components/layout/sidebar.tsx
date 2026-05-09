import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Bell,
  FileSpreadsheet,
  FileText,
  Home,
} from "lucide-react";
import { SiHubspot, SiSalesforce, SiShopify } from "react-icons/si";

export default function Sidebar() {
  const [location] = useLocation();
  const campaignMatch = location.match(/^\/campaigns\/([^/?#]+)/);
  const campaignId = campaignMatch?.[1];
  const { data: dataSources } = useQuery<{ revenueSources?: any[]; spendSources?: any[] }>({
    queryKey: [`/api/campaigns/${campaignId}/all-data-sources`],
    enabled: !!campaignId,
  });
  const sourceItems = (() => {
    const items: { key: string; label: string; Icon: any; className: string }[] = [];
    const add = (key: string, label: string, Icon: any, className: string) => {
      if (!items.some((item) => item.key === key)) items.push({ key, label, Icon, className });
    };
    [...(dataSources?.revenueSources || []), ...(dataSources?.spendSources || [])]
      .filter((source: any) => source?.isActive !== false && source?.sourceType !== "manual")
      .forEach((source: any) => {
        const type = String(source?.sourceType || "");
        if (type === "hubspot") add("hubspot", "HubSpot", SiHubspot, "text-orange-500");
        else if (type === "salesforce") add("salesforce", "Salesforce", SiSalesforce, "text-blue-500");
        else if (type === "shopify") add("shopify", "Shopify", SiShopify, "text-green-600");
        else if (type === "google_sheets") add("google_sheets", "Google Sheets", FileSpreadsheet, "text-green-600");
        else if (type === "csv") add(`csv_${source?.id || items.length}`, String(source?.displayName || "CSV Upload"), FileText, "text-blue-500");
      });
    return items;
  })();

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
          {sourceItems.map(({ key, label, Icon, className }) => (
            <div key={key} className="nav-link nav-link-inactive">
              <Icon className={`w-5 h-5 ${className}`} />
              <span>{label}</span>
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
}
