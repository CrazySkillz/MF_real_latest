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
  Edit
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
  const [storedReports, setStoredReports] = useState<StoredReport[]>([]);
  const [reportHistory, setReportHistory] = useState<StoredReport[]>([]);

  // Load reports from storage
  useEffect(() => {
    const loadReports = () => {
      const allReports = reportStorage.getReports();
      const scheduled = allReports.filter(r => r.status === 'Scheduled');
      const history = allReports.filter(r => r.status === 'Generated');
      
      setStoredReports(scheduled);
      setReportHistory(history);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "Paused":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "Error":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

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
    const scheduled = allReports.filter(r => r.status === 'Scheduled');
    const history = allReports.filter(r => r.status === 'Generated');
    
    setStoredReports(scheduled);
    setReportHistory(history);
    
    setShowCreateDialog(false);
    resetForm();
    alert(`${scheduleEnabled ? 'Scheduled' : 'Generated'} report created successfully!`);
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
                <TabsTrigger value="history">Report History</TabsTrigger>
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
                  {storedReports.filter(r => r.status === 'Scheduled').map((report) => (
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
                                  setStoredReports(allReports.filter(r => r.status === 'Scheduled'));
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

              <TabsContent value="history">
                <div className="space-y-6">
                  {reportHistory.length === 0 ? (
                    <Card>
                      <CardHeader>
                        <CardTitle>Report History</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                          <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p>Generated reports will appear here. Create reports from campaign pages or schedule them above.</p>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid gap-4">
                      {reportHistory.map((report) => (
                        <Card key={report.id}>
                          <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                              <div className="space-y-1">
                                <h3 className="font-semibold">{report.name}</h3>
                                <div className="flex items-center space-x-4 text-sm text-slate-600 dark:text-slate-400">
                                  <span>{report.type}</span>
                                  <span>{report.format}</span>
                                  {report.size && <span>{report.size}</span>}
                                  {report.campaignName && <span>Campaign: {report.campaignName}</span>}
                                </div>
                                <div className="text-xs text-slate-500">
                                  Generated on {format(report.generatedAt, "MMM d, yyyy 'at' h:mm a")}
                                </div>
                                {(report.includeKPIs || report.includeBenchmarks) && (
                                  <div className="text-xs text-primary">
                                    Includes: {report.includeKPIs ? 'KPIs' : ''}
                                    {report.includeKPIs && report.includeBenchmarks ? ', ' : ''}
                                    {report.includeBenchmarks ? 'Benchmarks' : ''}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center space-x-2">
                                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                  {report.status}
                                </Badge>
                                <Button variant="outline" size="sm">
                                  <Download className="w-4 h-4 mr-2" />
                                  Download
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="text-red-600 hover:text-red-700"
                                  onClick={() => {
                                    reportStorage.deleteReport(report.id);
                                    const allReports = reportStorage.getReports();
                                    setReportHistory(allReports.filter(r => r.status === 'Generated'));
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
                  )}
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