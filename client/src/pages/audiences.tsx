import { useState } from "react";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Users, TrendingUp, Target, MapPin, Calendar, Eye, Edit, Trash2 } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

const audienceSegments = [
  {
    id: 1,
    name: "High-Value Customers",
    description: "Customers who spent over $500 in the last 6 months",
    size: 12450,
    growth: "+15%",
    platforms: ["Facebook", "Google Ads"],
    status: "active",
    conversion_rate: 8.5,
  },
  {
    id: 2,
    name: "Website Visitors",
    description: "Users who visited our website in the last 30 days",
    size: 25680,
    growth: "+23%",
    platforms: ["Facebook", "LinkedIn"],
    status: "active",
    conversion_rate: 3.2,
  },
  {
    id: 3,
    name: "Cart Abandoners",
    description: "Users who added items to cart but didn't purchase",
    size: 8920,
    growth: "-5%",
    platforms: ["Google Ads", "Twitter"],
    status: "paused",
    conversion_rate: 12.1,
  },
  {
    id: 4,
    name: "Email Subscribers",
    description: "Active email newsletter subscribers",
    size: 18340,
    growth: "+8%",
    platforms: ["Facebook", "LinkedIn", "Twitter"],
    status: "active",
    conversion_rate: 5.7,
  },
];

const demographicData = [
  { age: "18-24", value: 15, color: "#2563EB" },
  { age: "25-34", value: 35, color: "#10B981" },
  { age: "35-44", value: 28, color: "#F59E0B" },
  { age: "45-54", value: 15, color: "#EF4444" },
  { age: "55+", value: 7, color: "#8B5CF6" },
];

const locationData = [
  { location: "United States", users: 15420, percentage: 45 },
  { location: "Canada", users: 8230, percentage: 24 },
  { location: "United Kingdom", users: 5680, percentage: 16 },
  { location: "Australia", users: 3450, percentage: 10 },
  { location: "Germany", users: 1720, percentage: 5 },
];

const interestData = [
  { interest: "Technology", value: 32 },
  { interest: "Fashion", value: 28 },
  { interest: "Travel", value: 24 },
  { interest: "Fitness", value: 20 },
  { interest: "Food", value: 18 },
  { interest: "Business", value: 15 },
];

export default function Audiences() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedAudience, setSelectedAudience] = useState<any>(null);

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value);
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return <Badge className="bg-accent/10 text-accent border-accent/20">Active</Badge>;
      case "paused":
        return <Badge className="bg-warning/10 text-warning border-warning/20">Paused</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPlatformIcons = (platforms: string[]) => {
    return platforms.map((platform, index) => {
      let iconClass = "fas fa-ad";
      let colorClass = "text-slate-500";
      
      switch (platform.toLowerCase()) {
        case "facebook":
          iconClass = "fab fa-facebook";
          colorClass = "text-blue-600";
          break;
        case "google ads":
          iconClass = "fab fa-google";
          colorClass = "text-red-500";
          break;
        case "linkedin":
          iconClass = "fab fa-linkedin";
          colorClass = "text-blue-700";
          break;
        case "twitter":
          iconClass = "fab fa-twitter";
          colorClass = "text-blue-400";
          break;
      }
      
      return (
        <i key={index} className={`${iconClass} ${colorClass} text-sm mr-1`}></i>
      );
    });
  };

  const totalAudienceSize = audienceSegments.reduce((sum, segment) => sum + segment.size, 0);
  const avgConversionRate = (audienceSegments.reduce((sum, segment) => sum + segment.conversion_rate, 0) / audienceSegments.length).toFixed(1);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Navigation />
      
      <div className="flex">
        <Sidebar />
        
        <main className="flex-1 p-8">
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Audience Management</h1>
                <p className="text-slate-600 dark:text-slate-400 mt-1">Analyze and manage your customer segments and targeting</p>
              </div>
              
              <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Audience
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Create New Audience</DialogTitle>
                    <DialogDescription>
                      Define a new audience segment for targeted marketing.
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="audienceName">Audience Name</Label>
                      <Input
                        id="audienceName"
                        placeholder="Enter audience name"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        placeholder="Describe your audience segment"
                        rows={3}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="audienceType">Audience Type</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="custom">Custom Audience</SelectItem>
                          <SelectItem value="lookalike">Lookalike Audience</SelectItem>
                          <SelectItem value="interest">Interest-based</SelectItem>
                          <SelectItem value="behavioral">Behavioral</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="flex items-center space-x-3 pt-4">
                      <Button 
                        type="button" 
                        variant="outline" 
                        className="flex-1"
                        onClick={() => setIsCreateModalOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button className="flex-1">
                        Create Audience
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Audience Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Audiences</p>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">{audienceSegments.length}</p>
                    </div>
                    <Users className="w-8 h-8 text-primary" />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Reach</p>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatNumber(totalAudienceSize)}</p>
                    </div>
                    <Target className="w-8 h-8 text-accent" />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Avg. Conversion</p>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">{avgConversionRate}%</p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-warning" />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Active Segments</p>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">
                        {audienceSegments.filter(s => s.status === 'active').length}
                      </p>
                    </div>
                    <Eye className="w-8 h-8 text-emerald-600" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <Tabs defaultValue="segments" className="space-y-6">
            <TabsList>
              <TabsTrigger value="segments">Audience Segments</TabsTrigger>
              <TabsTrigger value="demographics">Demographics</TabsTrigger>
              <TabsTrigger value="insights">Insights</TabsTrigger>
            </TabsList>

            <TabsContent value="segments">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">Audience Segments</CardTitle>
                  <CardDescription>Manage your custom audience segments and their performance</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {audienceSegments.map((segment) => (
                      <div key={segment.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <h3 className="font-semibold text-slate-900 dark:text-white">{segment.name}</h3>
                              {getStatusBadge(segment.status)}
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">{segment.description}</p>
                            
                            <div className="flex items-center space-x-6 text-sm">
                              <div className="flex items-center space-x-1">
                                <Users className="w-4 h-4 text-slate-400" />
                                <span className="font-medium">{formatNumber(segment.size)}</span>
                                <span className={`text-xs ${segment.growth.startsWith('+') ? 'text-accent' : 'text-destructive'}`}>
                                  {segment.growth}
                                </span>
                              </div>
                              
                              <div className="flex items-center space-x-1">
                                <TrendingUp className="w-4 h-4 text-slate-400" />
                                <span>{segment.conversion_rate}% CVR</span>
                              </div>
                              
                              <div className="flex items-center space-x-1">
                                {getPlatformIcons(segment.platforms)}
                                <span className="text-slate-500">{segment.platforms.length} platforms</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <Button variant="ghost" size="sm">
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="demographics">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">Age Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={demographicData}
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                            label={({ age, value }) => `${age} ${value}%`}
                          >
                            {demographicData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">Top Locations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {locationData.map((location, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <MapPin className="w-4 h-4 text-slate-400" />
                            <span className="font-medium text-slate-900 dark:text-white">{location.location}</span>
                          </div>
                          <div className="flex items-center space-x-3">
                            <Progress value={location.percentage} className="w-20" />
                            <span className="text-sm text-slate-600 dark:text-slate-400 w-16 text-right">
                              {formatNumber(location.users)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">Interest Categories</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={interestData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis 
                            dataKey="interest" 
                            stroke="#64748b"
                            fontSize={12}
                          />
                          <YAxis 
                            stroke="#64748b"
                            fontSize={12}
                          />
                          <Bar dataKey="value" fill="#2563EB" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="insights">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">Audience Growth</CardTitle>
                    <CardDescription>Monthly audience size changes</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                        <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>Connect your platforms to see audience growth insights</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">Performance Insights</CardTitle>
                    <CardDescription>Key audience performance metrics</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                        <span className="text-sm font-medium">Best Performing Segment</span>
                        <span className="text-sm text-accent">Cart Abandoners (12.1% CVR)</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                        <span className="text-sm font-medium">Fastest Growing</span>
                        <span className="text-sm text-accent">Website Visitors (+23%)</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                        <span className="text-sm font-medium">Largest Segment</span>
                        <span className="text-sm text-accent">Website Visitors (25.6K)</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                        <span className="text-sm font-medium">Needs Attention</span>
                        <span className="text-sm text-destructive">Cart Abandoners (-5%)</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}