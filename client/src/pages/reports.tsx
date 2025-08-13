import { useState, useEffect } from "react";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  FileText, 
  Calendar, 
  Clock,
  Mail,
  Download,
  Plus,
  Settings,
  Trash2,
  Play,
  Pause,
  Edit,
  Search,
  Filter
} from "lucide-react";
import { format } from "date-fns";
import { reportStorage, type StoredReport } from "@/lib/reportStorage";

export default function Reports() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [reportType, setReportType] = useState("performance");
  const [reportName, setReportName] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleFrequency, setScheduleFrequency] = useState("weekly");
  const [scheduleDay, setScheduleDay] = useState("monday");
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [recipients, setRecipients] = useState("");
  const [allStoredReports, setAllStoredReports] = useState<StoredReport[]>([]);
  
  // Filter states for All Reports tab
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");

  // Load reports from storage
  useEffect(() => {
    const loadReports = () => {
      const allReports = reportStorage.getReports();
      console.log('Loading reports:', allReports);
      
      // Add mock data if no reports exist
      if (allReports.length === 0) {
        const mockReports = [
          // Generated Reports
          {
            name: "Q3 Performance Analysis",
            type: "Performance",
            status: 'Generated' as const,
            generatedAt: new Date(2025, 7, 10, 14, 30),
            format: 'PDF',
            size: '2.4 MB',
            campaignName: "Digital Marketing Q3",
            includeKPIs: true,
            includeBenchmarks: false
          },
          {
            name: "Weekly Social Media Report",
            type: "Social Media",
            status: 'Generated' as const,
            generatedAt: new Date(2025, 7, 8, 9, 15),
            format: 'PDF',
            size: '1.8 MB',
            campaignName: "Social Media Campaign",
            includeKPIs: false,
            includeBenchmarks: true
          },
          {
            name: "August ROI Dashboard",
            type: "Financial",
            status: 'Generated' as const,
            generatedAt: new Date(2025, 7, 5, 16, 45),
            format: 'Excel',
            size: '856 KB',
            campaignName: "Brand Awareness",
            includeKPIs: true,
            includeBenchmarks: true
          },
          {
            name: "Lead Generation Summary",
            type: "Lead Generation",
            status: 'Generated' as const,
            generatedAt: new Date(2025, 7, 2, 11, 20),
            format: 'PDF',
            size: '3.1 MB',
            campaignName: "Q3 Lead Generation",
            includeKPIs: true,
            includeBenchmarks: false
          },
          {
            name: "Campaign Comparison Analysis",
            type: "Comparative",
            status: 'Generated' as const,
            generatedAt: new Date(2025, 6, 28, 13, 10),
            format: 'PDF',
            size: '4.2 MB',
            campaignName: "All Campaigns",
            includeKPIs: true,
            includeBenchmarks: true
          },
          
          // Scheduled Reports
          {
            name: "Daily KPI Monitor",
            type: "KPI Tracking",
            status: 'Scheduled' as const,
            generatedAt: new Date(2025, 7, 11, 10, 0),
            format: 'PDF',
            campaignName: "Digital Marketing Q3",
            includeKPIs: true,
            includeBenchmarks: false,
            schedule: {
              frequency: "Daily",
              day: "monday",
              time: "08:00",
              recipients: ["team@company.com", "manager@company.com"]
            }
          },
          {
            name: "Weekly Performance Digest",
            type: "Performance",
            status: 'Scheduled' as const,
            generatedAt: new Date(2025, 7, 9, 15, 30),
            format: 'PDF',
            campaignName: "Social Media Campaign",
            includeKPIs: false,
            includeBenchmarks: true,
            schedule: {
              frequency: "Weekly",
              day: "monday",
              time: "09:00",
              recipients: ["sarah.johnson@company.com", "marketing@company.com"]
            }
          },
          {
            name: "Monthly Executive Summary",
            type: "Executive",
            status: 'Scheduled' as const,
            generatedAt: new Date(2025, 7, 7, 12, 0),
            format: 'PDF',
            campaignName: "All Campaigns",
            includeKPIs: true,
            includeBenchmarks: true,
            schedule: {
              frequency: "Monthly",
              day: "1",
              time: "15:00",
              recipients: ["ceo@company.com", "cfo@company.com", "marketing-lead@company.com"]
            }
          },
          {
            name: "Bi-weekly ROI Tracker",
            type: "Financial",
            status: 'Scheduled' as const,
            generatedAt: new Date(2025, 7, 6, 14, 15),
            format: 'Excel',
            campaignName: "Brand Awareness",
            includeKPIs: true,
            includeBenchmarks: false,
            schedule: {
              frequency: "Bi-weekly",
              day: "monday",
              time: "14:00",
              recipients: ["finance@company.com", "marketing-budget@company.com"]
            }
          },
          {
            name: "Platform Performance Review",
            type: "Platform Analysis",
            status: 'Scheduled' as const,
            generatedAt: new Date(2025, 7, 4, 11, 45),
            format: 'PDF',
            campaignName: "Q3 Lead Generation",
            includeKPIs: false,
            includeBenchmarks: true,
            schedule: {
              frequency: "Weekly",
              day: "friday",
              time: "11:00",
              recipients: ["platform-team@company.com"]
            }
          }
        ];

        // Add each mock report to storage
        mockReports.forEach(report => {
          reportStorage.addReport(report);
        });
        
        // Reload after adding mock data
        const updatedReports = reportStorage.getReports();
        setAllStoredReports(updatedReports);
        return;
      }
      
      setAllStoredReports(allReports);
    };
    
    loadReports();
    
    // Listen for storage changes (when reports are added from other components)
    const handleStorageChange = () => loadReports();
    window.addEventListener('storage', handleStorageChange);
    
    // Also listen for custom events from same page
    window.addEventListener('reportAdded', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('reportAdded', handleStorageChange);
    };
  }, []);

  // Mock data for existing reports
  const scheduledReports = [
    {
      id: "1",
      name: "Weekly Performance Summary",
      type: "Performance",
      status: "Active",
      frequency: "Weekly",
      nextRun: new Date(2025, 7, 12, 9, 0),
      recipients: ["sarah.johnson@company.com", "marketing@company.com"],
      campaigns: ["Digital Marketing Q3", "Brand Awareness"],
      lastGenerated: new Date(2025, 7, 5, 9, 0),
      format: "PDF"
    },
    {
      id: "2", 
      name: "Monthly ROI Analysis",
      type: "Financial",
      status: "Active",
      frequency: "Monthly",
      nextRun: new Date(2025, 8, 1, 15, 0),
      recipients: ["cfo@company.com", "marketing-lead@company.com"],
      campaigns: ["All Campaigns"],
      lastGenerated: new Date(2025, 6, 1, 15, 0),
      format: "Excel"
    },
    {
      id: "3",
      name: "Daily KPI Dashboard",
      type: "KPI Tracking",
      status: "Paused",
      frequency: "Daily",
      nextRun: null,
      recipients: ["team@company.com"],
      campaigns: ["Q3 Lead Generation", "Social Media Campaign"],
      lastGenerated: new Date(2025, 7, 8, 6, 0),
      format: "CSV"
    }
  ];

  const resetForm = () => {
    setReportName("");
    setReportDescription("");
    setSelectedCampaigns([]);
    setScheduleEnabled(false);
    setScheduleFrequency("weekly");
    setScheduleDay("monday");
    setScheduleTime("09:00");
    setRecipients("");
  };

  const createReport = () => {
    // Save the created report to storage
    const newReport = reportStorage.addReport({
      name: reportName,
      type: reportType,
      status: scheduleEnabled ? 'Scheduled' : 'Generated',
      generatedAt: new Date(),
      format: 'PDF', // Default format
      includeKPIs: false,
      includeBenchmarks: false,
      schedule: scheduleEnabled ? {
        frequency: scheduleFrequency,
        day: scheduleDay,
        time: scheduleTime,
        recipients: recipients.split(',').map(email => email.trim()).filter(email => email)
      } : null
    });
    
    // Refresh the reports list
    const allReports = reportStorage.getReports();
    setAllStoredReports(allReports);
    
    setShowCreateDialog(false);
    resetForm();
    alert(`${scheduleEnabled ? 'Scheduled' : 'Generated'} report created successfully!`);
  };

  // Filter reports for All Reports tab
  const filteredReports = allStoredReports.filter(report => {
    // Search query filter
    if (searchQuery && !report.name.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !report.campaignName?.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    // Status filter
    if (statusFilter !== "all" && report.status !== statusFilter) {
      return false;
    }

    // Campaign filter
    if (campaignFilter !== "all" && report.campaignName !== campaignFilter) {
      return false;
    }

    // Type filter
    if (typeFilter !== "all" && report.type !== typeFilter) {
      return false;
    }

    // Date filter
    if (dateFilter !== "all") {
      const now = new Date();
      const reportDate = new Date(report.generatedAt);
      const daysDiff = Math.floor((now.getTime() - reportDate.getTime()) / (1000 * 60 * 60 * 24));

      switch (dateFilter) {
        case "today":
          if (daysDiff !== 0) return false;
          break;
        case "week":
          if (daysDiff > 7) return false;
          break;
        case "month":
          if (daysDiff > 30) return false;
          break;
        case "quarter":
          if (daysDiff > 90) return false;
          break;
      }
    }

    return true;
  });

  // Get unique campaign names for filter dropdown
  const uniqueCampaigns = Array.from(new Set(
    allStoredReports.map(r => r.campaignName).filter(Boolean)
  ));

  // Get unique report types for filter dropdown
  const uniqueTypes = Array.from(new Set(
    allStoredReports.map(r => r.type).filter(Boolean)
  ));

  // Helper function for status badge colors
  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "Paused":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "Error":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default:
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Navigation />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-8">
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Reports</h1>
                <p className="text-slate-600 dark:text-slate-400 mt-1">
                  Manage scheduled reports and download historical data
                </p>
              </div>
              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Report
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create Scheduled Report</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-6">
                    {/* Basic Info */}
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Report Name</Label>
                        <Input
                          placeholder="e.g., Weekly Performance Summary"
                          value={reportName}
                          onChange={(e) => setReportName(e.target.value)}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Report Type</Label>
                        <Select value={reportType} onValueChange={setReportType}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="performance">Performance Summary</SelectItem>
                            <SelectItem value="financial">Financial Analysis</SelectItem>
                            <SelectItem value="kpi">KPI Tracking</SelectItem>
                            <SelectItem value="custom">Custom Report</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Description (Optional)</Label>
                        <Input
                          placeholder="Brief description of what this report covers"
                          value={reportDescription}
                          onChange={(e) => setReportDescription(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Scheduling */}
                    <div className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="enable-schedule"
                          checked={scheduleEnabled}
                          onCheckedChange={(checked) => setScheduleEnabled(checked as boolean)}
                        />
                        <Label htmlFor="enable-schedule" className="text-base font-medium">
                          Schedule Automatic Generation
                        </Label>
                      </div>
                      
                      {scheduleEnabled && (
                        <div className="ml-6 space-y-4 p-4 border rounded-lg bg-slate-50 dark:bg-slate-800">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <Label>Frequency</Label>
                              <Select value={scheduleFrequency} onValueChange={setScheduleFrequency}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="daily">Daily</SelectItem>
                                  <SelectItem value="weekly">Weekly</SelectItem>
                                  <SelectItem value="monthly">Monthly</SelectItem>
                                  <SelectItem value="quarterly">Quarterly</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            
                            {scheduleFrequency === "weekly" && (
                              <div className="space-y-2">
                                <Label>Day of Week</Label>
                                <Select value={scheduleDay} onValueChange={setScheduleDay}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="monday">Monday</SelectItem>
                                    <SelectItem value="tuesday">Tuesday</SelectItem>
                                    <SelectItem value="wednesday">Wednesday</SelectItem>
                                    <SelectItem value="thursday">Thursday</SelectItem>
                                    <SelectItem value="friday">Friday</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                            
                            <div className="space-y-2">
                              <Label>Time</Label>
                              <Select value={scheduleTime} onValueChange={setScheduleTime}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="06:00">6:00 AM</SelectItem>
                                  <SelectItem value="09:00">9:00 AM</SelectItem>
                                  <SelectItem value="12:00">12:00 PM</SelectItem>
                                  <SelectItem value="15:00">3:00 PM</SelectItem>
                                  <SelectItem value="18:00">6:00 PM</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <Label>Email Recipients</Label>
                            <Input
                              placeholder="Enter email addresses (comma-separated)"
                              value={recipients}
                              onChange={(e) => setRecipients(e.target.value)}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-between pt-4 border-t">
                      <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                        Cancel
                      </Button>
                      <div className="flex items-center space-x-3">
                        <Button variant="outline" onClick={resetForm}>
                          Reset
                        </Button>
                        <Button 
                          onClick={createReport}
                          disabled={!reportName.trim() || (scheduleEnabled && !recipients.trim())}
                        >
                          Create Report
                        </Button>
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Reports Tabs */}
            <Tabs defaultValue="scheduled" className="space-y-6">
              <TabsList>
                <TabsTrigger value="scheduled">Scheduled Reports</TabsTrigger>
                <TabsTrigger value="all">All Reports</TabsTrigger>
                <TabsTrigger value="templates">Templates</TabsTrigger>
              </TabsList>

              <TabsContent value="scheduled" className="space-y-6">
                <div className="grid gap-6">
                  {/* Mock scheduled reports (for demo) */}
                  {scheduledReports.map((report) => (
                    <Card key={report.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <CardTitle className="text-lg">{report.name}</CardTitle>
                            <div className="flex items-center space-x-4 text-sm text-slate-600 dark:text-slate-400">
                              <div className="flex items-center space-x-1">
                                <FileText className="w-4 h-4" />
                                <span>{report.type}</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <Calendar className="w-4 h-4" />
                                <span>{report.frequency}</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <Mail className="w-4 h-4" />
                                <span>{report.recipients.length} recipient(s)</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge className={getStatusColor(report.status)}>
                              {report.status}
                            </Badge>
                            <Button variant="ghost" size="sm">
                              <Settings className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="font-medium text-slate-900 dark:text-white">Next Run:</span>
                              <div className="text-slate-600 dark:text-slate-400">
                                {report.nextRun ? format(report.nextRun, "MMM d, yyyy 'at' h:mm a") : "Not scheduled"}
                              </div>
                            </div>
                            <div>
                              <span className="font-medium text-slate-900 dark:text-white">Last Generated:</span>
                              <div className="text-slate-600 dark:text-slate-400">
                                {format(report.lastGenerated, "MMM d, yyyy")}
                              </div>
                            </div>
                            <div>
                              <span className="font-medium text-slate-900 dark:text-white">Format:</span>
                              <div className="text-slate-600 dark:text-slate-400">{report.format}</div>
                            </div>
                            <div>
                              <span className="font-medium text-slate-900 dark:text-white">Campaigns:</span>
                              <div className="text-slate-600 dark:text-slate-400">
                                {Array.isArray(report.campaigns) ? report.campaigns.join(", ") : report.campaigns}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between pt-4 border-t">
                            <div className="flex items-center space-x-2">
                              <Button variant="outline" size="sm">
                                <Download className="w-4 h-4 mr-2" />
                                Download Latest
                              </Button>
                              <Button variant="outline" size="sm">
                                <Edit className="w-4 h-4 mr-2" />
                                Edit
                              </Button>
                            </div>
                            <div className="flex items-center space-x-2">
                              {report.status === "Active" ? (
                                <Button variant="outline" size="sm">
                                  <Pause className="w-4 h-4 mr-2" />
                                  Pause
                                </Button>
                              ) : (
                                <Button variant="outline" size="sm">
                                  <Play className="w-4 h-4 mr-2" />
                                  Resume
                                </Button>
                              )}
                              <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  
                  {/* Dynamically created scheduled reports */}
                  {allStoredReports.filter(r => r.status === 'Scheduled').map((report) => (
                    <Card key={report.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <CardTitle className="text-lg">{report.name}</CardTitle>
                            <div className="flex items-center space-x-4 text-sm text-slate-600 dark:text-slate-400">
                              <div className="flex items-center space-x-1">
                                <FileText className="w-4 h-4" />
                                <span>{report.type}</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <Calendar className="w-4 h-4" />
                                <span>{report.schedule?.frequency || 'Unknown'}</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <Mail className="w-4 h-4" />
                                <span>{report.schedule?.recipients.length || 0} recipient(s)</span>
                              </div>
                              {report.campaignName && (
                                <div className="flex items-center space-x-1">
                                  <span>Campaign: {report.campaignName}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                              {report.status}
                            </Badge>
                            <Button variant="ghost" size="sm">
                              <Settings className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="font-medium text-slate-900 dark:text-white">Created:</span>
                              <div className="text-slate-600 dark:text-slate-400">
                                {format(report.generatedAt, "MMM d, yyyy 'at' h:mm a")}
                              </div>
                            </div>
                            <div>
                              <span className="font-medium text-slate-900 dark:text-white">Schedule:</span>
                              <div className="text-slate-600 dark:text-slate-400">
                                {report.schedule ? `${report.schedule.frequency} at ${report.schedule.time}` : 'Not scheduled'}
                              </div>
                            </div>
                            <div>
                              <span className="font-medium text-slate-900 dark:text-white">Format:</span>
                              <div className="text-slate-600 dark:text-slate-400">{report.format}</div>
                            </div>
                            <div>
                              <span className="font-medium text-slate-900 dark:text-white">Data Included:</span>
                              <div className="text-slate-600 dark:text-slate-400">
                                {report.includeKPIs || report.includeBenchmarks 
                                  ? `${report.includeKPIs ? 'KPIs' : ''}${report.includeKPIs && report.includeBenchmarks ? ', ' : ''}${report.includeBenchmarks ? 'Benchmarks' : ''}`
                                  : 'Standard metrics'}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between pt-4 border-t">
                            <div className="flex items-center space-x-2">
                              <Button variant="outline" size="sm">
                                <Edit className="w-4 h-4 mr-2" />
                                Edit
                              </Button>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Button variant="outline" size="sm">
                                <Pause className="w-4 h-4 mr-2" />
                                Pause
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="text-red-600 hover:text-red-700"
                                onClick={() => {
                                  reportStorage.deleteReport(report.id);
                                  const allReports = reportStorage.getReports();
                                  setAllStoredReports(allReports);
                                }}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="all">
                <div className="space-y-6">
                  {/* Filters */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Filter className="w-5 h-5" />
                        Filter Reports
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                        {/* Search */}
                        <div className="space-y-2">
                          <Label>Search</Label>
                          <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                            <Input
                              placeholder="Search reports or campaigns..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="pl-10"
                            />
                          </div>
                        </div>

                        {/* Status Filter */}
                        <div className="space-y-2">
                          <Label>Status</Label>
                          <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Statuses</SelectItem>
                              <SelectItem value="Generated">Generated</SelectItem>
                              <SelectItem value="Scheduled">Scheduled</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Campaign Filter */}
                        <div className="space-y-2">
                          <Label>Campaign</Label>
                          <Select value={campaignFilter} onValueChange={setCampaignFilter}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Campaigns</SelectItem>
                              {uniqueCampaigns.map((campaign) => (
                                <SelectItem key={campaign} value={campaign!}>{campaign}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Type Filter */}
                        <div className="space-y-2">
                          <Label>Report Type</Label>
                          <Select value={typeFilter} onValueChange={setTypeFilter}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Types</SelectItem>
                              {uniqueTypes.map((type) => (
                                <SelectItem key={type} value={type}>{type}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Date Filter */}
                        <div className="space-y-2">
                          <Label>Date Range</Label>
                          <Select value={dateFilter} onValueChange={setDateFilter}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Dates</SelectItem>
                              <SelectItem value="today">Today</SelectItem>
                              <SelectItem value="week">Last 7 days</SelectItem>
                              <SelectItem value="month">Last 30 days</SelectItem>
                              <SelectItem value="quarter">Last 90 days</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Results */}
                  <div className="space-y-4">
                    {filteredReports.length === 0 ? (
                      <Card>
                        <CardContent className="py-12">
                          <div className="text-center text-slate-500 dark:text-slate-400">
                            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p className="text-lg font-medium mb-2">No reports found</p>
                            <p>Try adjusting your filters or create a new report from a campaign page.</p>
                          </div>
                        </CardContent>
                      </Card>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            Showing {filteredReports.length} of {allStoredReports.length} reports
                          </p>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => {
                              setSearchQuery("");
                              setStatusFilter("all");
                              setCampaignFilter("all");
                              setTypeFilter("all");
                              setDateFilter("all");
                            }}
                          >
                            Clear Filters
                          </Button>
                        </div>

                        <div className="grid gap-4">
                          {filteredReports.map((report) => (
                            <Card key={report.id} className="hover:shadow-md transition-shadow">
                              <CardContent className="pt-6">
                                <div className="flex items-start justify-between">
                                  <div className="space-y-2 flex-1">
                                    <div className="flex items-center gap-3">
                                      <h3 className="font-semibold text-lg">{report.name}</h3>
                                      <Badge className={
                                        report.status === 'Generated' 
                                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                          : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                                      }>
                                        {report.status}
                                      </Badge>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                                      <div>
                                        <span className="font-medium text-slate-900 dark:text-white">Type:</span>
                                        <div className="text-slate-600 dark:text-slate-400">{report.type}</div>
                                      </div>
                                      
                                      <div>
                                        <span className="font-medium text-slate-900 dark:text-white">Format:</span>
                                        <div className="text-slate-600 dark:text-slate-400">
                                          {report.format}
                                          {report.size && ` (${report.size})`}
                                        </div>
                                      </div>
                                      
                                      {report.campaignName && (
                                        <div>
                                          <span className="font-medium text-slate-900 dark:text-white">Campaign:</span>
                                          <div className="text-slate-600 dark:text-slate-400">{report.campaignName}</div>
                                        </div>
                                      )}
                                      
                                      <div>
                                        <span className="font-medium text-slate-900 dark:text-white">
                                          {report.status === 'Scheduled' ? 'Created:' : 'Generated:'}
                                        </span>
                                        <div className="text-slate-600 dark:text-slate-400">
                                          {format(report.generatedAt, "MMM d, yyyy 'at' h:mm a")}
                                        </div>
                                      </div>
                                    </div>

                                    {report.schedule && (
                                      <div className="text-sm">
                                        <span className="font-medium text-slate-900 dark:text-white">Schedule:</span>
                                        <span className="text-slate-600 dark:text-slate-400 ml-2">
                                          {report.schedule.frequency} at {report.schedule.time}
                                          {report.schedule.recipients.length > 0 && 
                                            ` • ${report.schedule.recipients.length} recipient(s)`
                                          }
                                        </span>
                                      </div>
                                    )}

                                    {(report.includeKPIs || report.includeBenchmarks) && (
                                      <div className="text-sm">
                                        <span className="font-medium text-primary">
                                          Includes: {report.includeKPIs ? 'KPIs' : ''}
                                          {report.includeKPIs && report.includeBenchmarks ? ', ' : ''}
                                          {report.includeBenchmarks ? 'Benchmarks' : ''}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                  
                                  <div className="flex items-center space-x-2 ml-4">
                                    {report.status === 'Generated' ? (
                                      <Button variant="outline" size="sm">
                                        <Download className="w-4 h-4 mr-2" />
                                        Download
                                      </Button>
                                    ) : (
                                      <div className="flex items-center space-x-2">
                                        <Button variant="outline" size="sm">
                                          <Edit className="w-4 h-4 mr-2" />
                                          Edit
                                        </Button>
                                        <Button variant="outline" size="sm">
                                          <Pause className="w-4 h-4 mr-2" />
                                          Pause
                                        </Button>
                                      </div>
                                    )}
                                    
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      className="text-red-600 hover:text-red-700"
                                      onClick={() => {
                                        reportStorage.deleteReport(report.id);
                                        const allReports = reportStorage.getReports();
                                        setAllStoredReports(allReports);
                                      }}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="templates">
                <Card>
                  <CardHeader>
                    <CardTitle>Report Templates</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                      <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Custom report templates will be available soon</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}