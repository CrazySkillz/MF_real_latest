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
        return "text-gradient-primary";
      case "click":
        return "text-gradient-success";
      case "percentage":
        return "text-gradient-accent";
      case "dollar":
        return "text-gradient-accent";
      default:
        return "text-gradient-primary";
    }
  };

  const getIconBg = (iconName: string) => {
    switch (iconName) {
      case "eye":
        return "gradient-card-primary";
      case "click":
        return "btn-success";
      case "percentage":
        return "btn-accent";
      case "dollar":
        return "btn-secondary";
      default:
        return "gradient-card-primary";
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 bg-muted rounded-lg"></div>
                <div className="w-16 h-4 bg-muted rounded"></div>
              </div>
              <div className="w-20 h-8 bg-muted rounded mb-3"></div>
              <div className="w-24 h-4 bg-muted rounded"></div>
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
        const trendColor = isPositive ? "text-gradient-success" : "text-destructive";
        
        return (
          <Card key={index} className="metric-card">
            <CardContent className="p-8">
              <div className="flex items-center justify-between mb-6">
                <div className={`w-16 h-16 ${getIconBg(metric.icon)} rounded-2xl flex items-center justify-center`}>
                  <IconComponent className={`w-8 h-8 text-white`} />
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  <TrendIcon className={`w-4 h-4 ${trendColor}`} />
                  <span className={`font-semibold ${trendColor}`}>{metric.change}</span>
                </div>
              </div>
              <h3 className="heading-lg mb-2">{metric.value}</h3>
              <p className="body-md text-muted-foreground">{metric.name}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
