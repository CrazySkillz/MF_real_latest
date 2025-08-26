import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Users, Target, DollarSign, MousePointer } from "lucide-react";

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088fe', '#00c49f'];

interface AttributionModel {
  id: string;
  name: string;
  type: string;
  description: string | null;
  isDefault: boolean;
  isActive: boolean;
}

interface CustomerJourney {
  id: string;
  customerId: string;
  totalTouchpoints: number;
  conversionValue: string | null;
  status: string;
  createdAt: string;
}

interface ChannelPerformance {
  channel: string;
  totalAttributedValue: number;
  totalTouchpoints: number;
  averageCredit: number;
  assistedConversions: number;
  lastClickConversions: number;
  firstClickConversions: number;
}

export function AttributionDashboard() {
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [dateRange, setDateRange] = useState({ 
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  // Fetch attribution models
  const { data: models = [] } = useQuery<AttributionModel[]>({
    queryKey: ['/api/attribution/models'],
  });

  // Fetch customer journeys
  const { data: journeys = [] } = useQuery<CustomerJourney[]>({
    queryKey: ['/api/attribution/journeys'],
  });

  // Fetch channel performance data
  const { data: channelPerformance = [] } = useQuery<ChannelPerformance[]>({
    queryKey: ['/api/attribution/channel-performance', dateRange.startDate, dateRange.endDate, selectedModel],
    queryFn: () => 
      fetch(`/api/attribution/channel-performance?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}${selectedModel ? `&modelId=${selectedModel}` : ''}`)
        .then(res => res.json()),
    enabled: !!dateRange.startDate && !!dateRange.endDate
  });

  // Get default model if none selected
  const defaultModel = models.find(m => m.isDefault);
  const currentModel = selectedModel ? models.find(m => m.id === selectedModel) : defaultModel;

  // Calculate summary metrics
  const totalAttributedValue = channelPerformance.reduce((sum, channel) => sum + channel.totalAttributedValue, 0);
  const totalTouchpoints = channelPerformance.reduce((sum, channel) => sum + channel.totalTouchpoints, 0);
  const totalConversions = journeys.filter(j => j.status === 'completed').length;
  const averageJourneyLength = journeys.length > 0 ? 
    journeys.reduce((sum, j) => sum + j.totalTouchpoints, 0) / journeys.length : 0;

  // Prepare chart data
  const channelChartData = channelPerformance.map(channel => ({
    name: channel.channel,
    'Attributed Value': channel.totalAttributedValue,
    'Touchpoints': channel.totalTouchpoints,
    'Avg Credit': channel.averageCredit,
  }));

  const conversionTypeData = channelPerformance.map(channel => ({
    name: channel.channel,
    'First Click': channel.firstClickConversions,
    'Last Click': channel.lastClickConversions,
    'Assisted': channel.assistedConversions,
  }));

  return (
    <div className="space-y-6" data-testid="attribution-dashboard">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold" data-testid="page-title">Attribution Analysis</h1>
          <p className="text-muted-foreground mt-1">
            Understand how your marketing channels work together to drive conversions
          </p>
        </div>
        
        <div className="flex gap-4">
          <Select value={selectedModel} onValueChange={setSelectedModel}>
            <SelectTrigger className="w-48" data-testid="model-selector">
              <SelectValue placeholder="Select Attribution Model" />
            </SelectTrigger>
            <SelectContent>
              {models.map(model => (
                <SelectItem key={model.id} value={model.id} data-testid={`model-option-${model.type}`}>
                  {model.name} {model.isDefault && "(Default)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <div className="flex gap-2">
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
              className="px-3 py-2 border rounded-md"
              data-testid="start-date-input"
            />
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
              className="px-3 py-2 border rounded-md"
              data-testid="end-date-input"
            />
          </div>
        </div>
      </div>

      {/* Current Attribution Model Info */}
      {currentModel && (
        <Card data-testid="current-model-info">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Current Attribution Model: {currentModel.name}
              {currentModel.isDefault && <Badge variant="secondary">Default</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {currentModel.description}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="metric-attributed-value">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Attributed Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalAttributedValue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Across all channels
            </p>
          </CardContent>
        </Card>

        <Card data-testid="metric-touchpoints">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Touchpoints</CardTitle>
            <MousePointer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTouchpoints.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Customer interactions
            </p>
          </CardContent>
        </Card>

        <Card data-testid="metric-conversions">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversions</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalConversions}</div>
            <p className="text-xs text-muted-foreground">
              Completed journeys
            </p>
          </CardContent>
        </Card>

        <Card data-testid="metric-journey-length">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Journey Length</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{averageJourneyLength.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">
              Touchpoints per journey
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Attribution Analysis Tabs */}
      <Tabs defaultValue="channels" data-testid="attribution-tabs">
        <TabsList>
          <TabsTrigger value="channels" data-testid="channels-tab">Channel Performance</TabsTrigger>
          <TabsTrigger value="conversions" data-testid="conversions-tab">Conversion Types</TabsTrigger>
          <TabsTrigger value="journeys" data-testid="journeys-tab">Customer Journeys</TabsTrigger>
        </TabsList>

        <TabsContent value="channels" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Channel Attribution Performance</CardTitle>
            </CardHeader>
            <CardContent>
              {channelChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={channelChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="Attributed Value" fill="#8884d8" />
                    <Bar dataKey="Touchpoints" fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  No channel performance data available for the selected period
                </div>
              )}
            </CardContent>
          </Card>

          {/* Channel Performance Table */}
          <Card>
            <CardHeader>
              <CardTitle>Detailed Channel Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Channel</th>
                      <th className="text-right py-2">Attributed Value</th>
                      <th className="text-right py-2">Touchpoints</th>
                      <th className="text-right py-2">Avg Credit</th>
                      <th className="text-right py-2">Conversions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {channelPerformance.map((channel, index) => (
                      <tr key={channel.channel} className="border-b" data-testid={`channel-row-${channel.channel}`}>
                        <td className="py-2 font-medium">{channel.channel}</td>
                        <td className="text-right py-2">${channel.totalAttributedValue.toLocaleString()}</td>
                        <td className="text-right py-2">{channel.totalTouchpoints}</td>
                        <td className="text-right py-2">{(channel.averageCredit * 100).toFixed(1)}%</td>
                        <td className="text-right py-2">
                          {channel.lastClickConversions + channel.firstClickConversions + channel.assistedConversions}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conversions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Conversion Attribution Types</CardTitle>
            </CardHeader>
            <CardContent>
              {conversionTypeData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={conversionTypeData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="First Click" fill="#8884d8" stackId="a" />
                    <Bar dataKey="Last Click" fill="#82ca9d" stackId="a" />
                    <Bar dataKey="Assisted" fill="#ffc658" stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  No conversion type data available for the selected period
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="journeys" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Customer Journeys Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Journey Status Distribution */}
                <div>
                  <h4 className="font-medium mb-3">Journey Status</h4>
                  {journeys.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Active', value: journeys.filter(j => j.status === 'active').length },
                            { name: 'Completed', value: journeys.filter(j => j.status === 'completed').length },
                            { name: 'Abandoned', value: journeys.filter(j => j.status === 'abandoned').length },
                          ]}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {[
                            { name: 'Active', value: journeys.filter(j => j.status === 'active').length },
                            { name: 'Completed', value: journeys.filter(j => j.status === 'completed').length },
                            { name: 'Abandoned', value: journeys.filter(j => j.status === 'abandoned').length },
                          ].map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-64 text-muted-foreground">
                      No customer journey data available
                    </div>
                  )}
                </div>

                {/* Recent Journeys */}
                <div>
                  <h4 className="font-medium mb-3">Recent Journeys</h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {journeys.slice(0, 10).map((journey) => (
                      <div key={journey.id} className="border rounded-lg p-3" data-testid={`journey-${journey.id}`}>
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-sm">Customer {journey.customerId}</p>
                            <p className="text-xs text-muted-foreground">
                              {journey.totalTouchpoints} touchpoints
                            </p>
                          </div>
                          <div className="text-right">
                            <Badge variant={journey.status === 'completed' ? 'default' : 'secondary'}>
                              {journey.status}
                            </Badge>
                            {journey.conversionValue && (
                              <p className="text-sm font-medium mt-1">
                                ${parseFloat(journey.conversionValue).toLocaleString()}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Individual Customer Journeys with Touchpoints */}
          <Card>
            <CardHeader>
              <CardTitle>Individual Customer Journeys & Touchpoints</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {journeys.map((journey) => (
                  <JourneyDetailCard key={journey.id} journey={journey} />
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Component to show detailed journey with touchpoints
interface Touchpoint {
  id: string;
  channel: string;
  touchpointType: string;
  timestamp: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  attribution_credit: number;
  sequence: number;
  device_type: string;
  referrer: string;
  page_url: string;
  conversion_value: string;
}

function JourneyDetailCard({ journey }: { journey: CustomerJourney }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const { data: touchpoints = [] } = useQuery<Touchpoint[]>({
    queryKey: ['/api/attribution/touchpoints', journey.id],
    queryFn: () => 
      fetch(`/api/attribution/touchpoints?journeyId=${journey.id}`)
        .then(res => res.json()),
    enabled: isExpanded
  });

  const getChannelColor = (channel: string) => {
    const colors: Record<string, string> = {
      'Google Ads': 'bg-blue-100 text-blue-800',
      'Facebook': 'bg-blue-100 text-blue-800',
      'LinkedIn Ads': 'bg-blue-100 text-blue-800', 
      'Instagram': 'bg-pink-100 text-pink-800',
      'YouTube': 'bg-red-100 text-red-800',
      'Email': 'bg-green-100 text-green-800',
      'Direct': 'bg-gray-100 text-gray-800',
      'Content Marketing': 'bg-purple-100 text-purple-800'
    };
    return colors[channel] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="border rounded-lg" data-testid={`journey-detail-${journey.id}`}>
      <div 
        className="p-4 cursor-pointer hover:bg-gray-50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Customer {journey.customerId}</span>
            </div>
            <Badge variant={journey.status === 'completed' ? 'default' : journey.status === 'active' ? 'secondary' : 'outline'}>
              {journey.status}
            </Badge>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground">
              {journey.totalTouchpoints} touchpoints
            </div>
            {journey.conversionValue && (
              <div className="text-sm font-medium">
                ${parseFloat(journey.conversionValue).toLocaleString()}
              </div>
            )}
            <Button variant="ghost" size="sm" data-testid={`expand-journey-${journey.id}`}>
              {isExpanded ? 'Hide Details' : 'Show Touchpoints'}
            </Button>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t px-4 pb-4">
          <div className="pt-4">
            <h4 className="font-medium mb-3">Customer Journey Timeline</h4>
            {touchpoints.length > 0 ? (
              <div className="space-y-3">
                {touchpoints.sort((a, b) => a.sequence - b.sequence).map((touchpoint, index) => (
                  <div key={touchpoint.id} className="relative flex items-start gap-4 pb-3" data-testid={`touchpoint-${touchpoint.id}`}>
                    {/* Timeline connector */}
                    {index < touchpoints.length - 1 && (
                      <div className="absolute left-5 top-8 h-8 w-0.5 bg-gray-200" />
                    )}
                    
                    {/* Sequence number */}
                    <div className="flex-shrink-0 w-10 h-10 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-sm font-medium">
                      {touchpoint.sequence}
                    </div>

                    {/* Touchpoint details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge className={getChannelColor(touchpoint.channel)}>
                            {touchpoint.channel}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {formatDate(touchpoint.timestamp)}
                          </span>
                        </div>
                        <div className="text-sm font-medium">
                          ${parseFloat(touchpoint.conversion_value).toFixed(2)} credited
                        </div>
                      </div>
                      
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2">
                          <MousePointer className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">Campaign:</span>
                          <span>{touchpoint.utm_campaign}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Target className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">Page:</span>
                          <span className="truncate">{touchpoint.page_url}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Device:</span>
                          <span className="capitalize">{touchpoint.device_type}</span>
                          <span className="text-muted-foreground">•</span>
                          <span className="text-muted-foreground">Attribution:</span>
                          <span>{(touchpoint.attribution_credit * 100).toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Loading touchpoint details...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}