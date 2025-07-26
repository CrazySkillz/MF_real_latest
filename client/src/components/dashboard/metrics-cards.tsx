import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Eye, MousePointer, Percent, DollarSign, TrendingUp, TrendingDown } from "lucide-react";
import { Metric } from "@shared/schema";

export default function MetricsCards() {
  const { data: metrics = [], isLoading } = useQuery<Metric[]>({
    queryKey: ["/api/metrics"],
  });

  // Default metrics when no data is available
  const defaultMetrics = [
    {
      name: "Total Impressions",
      value: "0",
      change: "0%",
      icon: "eye",
      isPositive: true
    },
    {
      name: "Total Clicks", 
      value: "0",
      change: "0%",
      icon: "click",
      isPositive: true
    },
    {
      name: "Click-through Rate",
      value: "0%",
      change: "0%", 
      icon: "percentage",
      isPositive: false
    },
    {
      name: "Ad Spend",
      value: "$0",
      change: "0%",
      icon: "dollar",
      isPositive: true
    }
  ];

  const displayMetrics = metrics.length > 0 ? metrics : defaultMetrics;

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case "eye":
        return Eye;
      case "click":
        return MousePointer;
      case "percentage":
        return Percent;
      case "dollar":
        return DollarSign;
      default:
        return Eye;
    }
  };

  const getIconColor = (iconName: string) => {
    switch (iconName) {
      case "eye":
        return "text-primary";
      case "click":
        return "text-accent";
      case "percentage":
        return "text-warning";
      case "dollar":
        return "text-emerald-600";
      default:
        return "text-primary";
    }
  };

  const getIconBg = (iconName: string) => {
    switch (iconName) {
      case "eye":
        return "bg-primary/10";
      case "click":
        return "bg-accent/10";
      case "percentage":
        return "bg-warning/10";
      case "dollar":
        return "bg-emerald-100";
      default:
        return "bg-primary/10";
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-slate-200 rounded-lg"></div>
                <div className="w-16 h-4 bg-slate-200 rounded"></div>
              </div>
              <div className="w-20 h-8 bg-slate-200 rounded mb-2"></div>
              <div className="w-24 h-4 bg-slate-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {displayMetrics.map((metric, index) => {
        const IconComponent = getIcon(metric.icon);
        const isPositive = metric.change?.startsWith('+') || metric.change === "0%";
        const TrendIcon = isPositive ? TrendingUp : TrendingDown;
        const trendColor = isPositive ? "text-accent" : "text-destructive";
        
        return (
          <Card key={index} className="metric-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 ${getIconBg(metric.icon)} rounded-lg flex items-center justify-center`}>
                  <IconComponent className={`w-6 h-6 ${getIconColor(metric.icon)}`} />
                </div>
                <div className="flex items-center space-x-1 text-xs">
                  <TrendIcon className={`w-3 h-3 ${trendColor}`} />
                  <span className={`font-medium ${trendColor}`}>{metric.change}</span>
                </div>
              </div>
              <h3 className="text-2xl font-bold text-slate-900">{metric.value}</h3>
              <p className="text-sm text-slate-600">{metric.name}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
