import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { PerformanceData } from "@shared/schema";
import { useState } from "react";

export default function PerformanceChart() {
  const [selectedMetric, setSelectedMetric] = useState("impressions");
  
  const { data: performanceData = [], isLoading } = useQuery<PerformanceData[]>({
    queryKey: ["/api/performance"],
  });

  // Default empty state data
  const defaultData = [
    { date: "Jan", impressions: 0, clicks: 0, conversions: 0 },
    { date: "Feb", impressions: 0, clicks: 0, conversions: 0 },
    { date: "Mar", impressions: 0, clicks: 0, conversions: 0 },
    { date: "Apr", impressions: 0, clicks: 0, conversions: 0 },
    { date: "May", impressions: 0, clicks: 0, conversions: 0 },
    { date: "Jun", impressions: 0, clicks: 0, conversions: 0 },
    { date: "Jul", impressions: 0, clicks: 0, conversions: 0 },
  ];

  const chartData = performanceData.length > 0 ? performanceData : defaultData;

  const getMetricColor = () => {
    switch (selectedMetric) {
      case "impressions":
        return "#2563EB";
      case "clicks":
        return "#10B981";
      case "conversions":
        return "#F59E0B";
      default:
        return "#2563EB";
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Performance Over Time</CardTitle>
            <div className="w-32 h-8 bg-slate-200 rounded animate-pulse"></div>
          </div>
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
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-slate-900">Performance Over Time</CardTitle>
          <Select value={selectedMetric} onValueChange={setSelectedMetric}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="impressions">Impressions</SelectItem>
              <SelectItem value="clicks">Clicks</SelectItem>
              <SelectItem value="conversions">Conversions</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          {performanceData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-500">
              <div className="text-center">
                <div className="text-lg font-medium mb-2">No performance data available</div>
                <div className="text-sm">Connect your marketing platforms to see performance metrics</div>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis 
                  dataKey="date" 
                  stroke="#64748b"
                  fontSize={12}
                />
                <YAxis 
                  stroke="#64748b"
                  fontSize={12}
                />
                <Line
                  type="monotone"
                  dataKey={selectedMetric}
                  stroke={getMetricColor()}
                  strokeWidth={2}
                  dot={{ fill: getMetricColor(), strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: getMetricColor(), strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
