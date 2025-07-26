import { useState } from "react";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import MetricsCards from "@/components/dashboard/metrics-cards";
import PerformanceChart from "@/components/dashboard/performance-chart";
import CampaignChart from "@/components/dashboard/campaign-chart";
import CampaignTable from "@/components/dashboard/campaign-table";
import IntegrationPanel from "@/components/dashboard/integration-panel";
import IntegrationModal from "@/components/modals/integration-modal";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download } from "lucide-react";

export default function Dashboard() {
  const [isIntegrationModalOpen, setIsIntegrationModalOpen] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState("7days");

  const handleIntegrationClick = (platform: string) => {
    setSelectedIntegration(platform);
    setIsIntegrationModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsIntegrationModalOpen(false);
    setSelectedIntegration(null);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation />
      
      <div className="flex">
        <Sidebar />
        
        <main className="flex-1 p-8">
          {/* Header Section */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold text-slate-900">Marketing Dashboard</h1>
                <p className="text-slate-600 mt-1">Track your campaign performance and marketing metrics</p>
              </div>
              
              {/* Date Range Filter */}
              <div className="flex items-center space-x-4">
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7days">Last 7 days</SelectItem>
                    <SelectItem value="30days">Last 30 days</SelectItem>
                    <SelectItem value="3months">Last 3 months</SelectItem>
                    <SelectItem value="custom">Custom range</SelectItem>
                  </SelectContent>
                </Select>
                <Button>
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>

            {/* KPI Cards */}
            <MetricsCards />
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <PerformanceChart />
            <CampaignChart />
          </div>

          {/* Campaign Table and Integration Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <CampaignTable />
            </div>
            <div>
              <IntegrationPanel onIntegrationClick={handleIntegrationClick} />
            </div>
          </div>
        </main>
      </div>

      <IntegrationModal
        isOpen={isIntegrationModalOpen}
        onClose={handleCloseModal}
        platform={selectedIntegration}
      />
    </div>
  );
}
