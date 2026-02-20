import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import { Campaign } from "@shared/schema";
import { useClient } from "@/lib/clientContext";

export default function CampaignTable() {
  const { selectedClientId } = useClient();
  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns", { clientId: selectedClientId }],
    queryFn: async () => {
      const url = selectedClientId
        ? `/api/campaigns?clientId=${encodeURIComponent(selectedClientId)}`
        : "/api/campaigns";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch campaigns");
      return res.json();
    },
  });

  const formatCurrency = (value: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(parseFloat(value));
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value);
  };

  const calculateCTR = (clicks: number, impressions: number) => {
    if (impressions === 0) return "0.00%";
    return ((clicks / impressions) * 100).toFixed(2) + "%";
  };

  const getHealthBadge = (health: string | null) => {
    if (!health) return <Badge variant="outline">Unknown</Badge>;

    switch (health.toLowerCase()) {
      case "on_track":
        return <Badge className="bg-green-100 text-green-700 border-green-200">On Track</Badge>;
      case "needs_attention":
        return <Badge className="bg-orange-100 text-orange-700 border-orange-200">Needs Attention</Badge>;
      case "behind":
        return <Badge className="bg-red-100 text-red-700 border-red-200">Behind</Badge>;
      default:
        return <Badge variant="outline">{health}</Badge>;
    }
  };

  const getPlatformIcon = (platform: string | null) => {
    if (!platform) {
      return "fas fa-ad text-slate-500";
    }
    switch (platform.toLowerCase()) {
      case "facebook":
        return "fab fa-facebook text-blue-600";
      case "google ads":
        return "fab fa-google text-red-500";
      case "linkedin":
        return "fab fa-linkedin text-blue-700";
      case "twitter":
        return "fab fa-twitter text-blue-400";
      default:
        return "fas fa-ad text-slate-500";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return <Badge className="bg-accent/10 text-accent border-accent/20">Active</Badge>;
      case "paused":
        return <Badge className="bg-warning/10 text-warning border-warning/20">Paused</Badge>;
      case "completed":
        return <Badge className="bg-slate-100 text-slate-600 border-slate-200">Completed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Active Campaigns</CardTitle>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Campaign
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-slate-100 rounded animate-pulse"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-slate-900">Active Campaigns</CardTitle>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Campaign
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {campaigns.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-lg font-medium text-slate-900 mb-2">No campaigns found</div>
            <p className="text-slate-500 mb-4">Get started by creating your first marketing campaign</p>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Campaign
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Impressions</TableHead>
                  <TableHead>Conversions</TableHead>
                  <TableHead>CTR</TableHead>
                  <TableHead>Spend</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Health</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => (
                  <TableRow key={campaign.id} className="hover:bg-slate-50">
                    <TableCell>
                      <div>
                        <div className="font-medium text-slate-900">{campaign.name}</div>
                        <div className="text-sm text-slate-500">{campaign.type}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <i className={getPlatformIcon(campaign.platform)}></i>
                        <span className="text-sm">{campaign.platform}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatNumber(campaign.impressions)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatNumber((campaign as any).conversions || 0)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {calculateCTR(campaign.clicks, campaign.impressions)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatCurrency(campaign.spend)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {(campaign as any).revenue ? formatCurrency(String((campaign as any).revenue)) : '$0.00'}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(campaign.status)}
                    </TableCell>
                    <TableCell>
                      {getHealthBadge((campaign as any).health || null)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
