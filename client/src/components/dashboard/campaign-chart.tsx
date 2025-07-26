import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from "recharts";
import { Campaign } from "@shared/schema";

export default function CampaignChart() {
  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
  });

  // Process campaign data for chart
  const platformData = campaigns.reduce((acc, campaign) => {
    const existing = acc.find(item => item.name === campaign.platform);
    if (existing) {
      existing.value += parseFloat(campaign.spend);
    } else {
      acc.push({
        name: campaign.platform,
        value: parseFloat(campaign.spend),
      });
    }
    return acc;
  }, [] as { name: string; value: number }[]);

  const COLORS = {
    "Facebook": "#2563EB",
    "Google Ads": "#10B981", 
    "LinkedIn": "#F59E0B",
    "Twitter": "#EF4444",
  };

  const defaultData = [
    { name: "No data", value: 1 }
  ];

  const chartData = platformData.length > 0 ? platformData : defaultData;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Campaign Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-slate-100 rounded animate-pulse"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-slate-900">Campaign Performance</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          {campaigns.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-500">
              <div className="text-center">
                <div className="text-lg font-medium mb-2">No campaign data available</div>
                <div className="text-sm">Create campaigns to see performance distribution</div>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={COLORS[entry.name as keyof typeof COLORS] || "#64748b"} 
                    />
                  ))}
                </Pie>
                <Legend 
                  verticalAlign="bottom" 
                  height={36}
                  formatter={(value) => <span className="text-sm text-slate-600">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
