import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Filter, Search, Clock, AlertCircle, CheckCircle, Info, XCircle, Check, MoreHorizontal } from "lucide-react";
import { Notification } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, isToday, isYesterday, formatDistanceToNow } from "date-fns";

export default function Notifications() {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [readFilter, setReadFilter] = useState("all");
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await apiRequest("PATCH", `/api/notifications/${notificationId}`, { read: true });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PATCH", "/api/notifications/mark-all-read", {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      toast({
        title: "All notifications marked as read",
        description: "All notifications have been marked as read.",
      });
    },
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      console.log('[Delete] Deleting notification:', notificationId);
      const response = await apiRequest("DELETE", `/api/notifications/${notificationId}`);
      const result = await response.json();
      console.log('[Delete] Result:', result);
      return result;
    },
    onSuccess: async () => {
      console.log('[Delete] Success, refetching notifications');
      await queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      await queryClient.refetchQueries({ queryKey: ["/api/notifications"] });
      toast({
        title: "Notification deleted",
        description: "The notification has been deleted.",
      });
    },
    onError: (error) => {
      console.error('[Delete] Error:', error);
      toast({
        title: "Error",
        description: "Failed to delete notification",
        variant: "destructive",
      });
    },
  });

  // Filter notifications based on search and filters
  const filteredNotifications = notifications.filter(notification => {
    const matchesSearch = notification.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         notification.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (notification.campaignName && notification.campaignName.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesType = typeFilter === "all" || notification.type === typeFilter;
    const matchesPriority = priorityFilter === "all" || notification.priority === priorityFilter;
    const matchesRead = readFilter === "all" || 
                       (readFilter === "unread" && !notification.read) || 
                       (readFilter === "read" && notification.read);
    const matchesCampaign = campaignFilter === "all" || notification.campaignName === campaignFilter;

    let matchesDate = true;
    if (dateFilter !== "all") {
      const notificationDate = new Date(notification.createdAt);
      const now = new Date();
      
      switch (dateFilter) {
        case "today":
          matchesDate = isToday(notificationDate);
          break;
        case "yesterday":
          matchesDate = isYesterday(notificationDate);
          break;
        case "this-week":
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          matchesDate = notificationDate >= weekAgo;
          break;
        case "this-month":
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          matchesDate = notificationDate >= monthAgo;
          break;
      }
    }

    return matchesSearch && matchesType && matchesPriority && matchesRead && matchesCampaign && matchesDate;
  });

  // Get unique campaign names for filter dropdown
  const uniqueCampaigns = Array.from(new Set(notifications.map(n => n.campaignName).filter(Boolean)));

  // Pagination
  const totalPages = Math.ceil(filteredNotifications.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedNotifications = filteredNotifications.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, typeFilter, priorityFilter, readFilter, campaignFilter, dateFilter]);

  // Adjust current page if it's now out of bounds (after deletion)
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [filteredNotifications.length, currentPage, totalPages]);

  // Get notification type icon
  const getTypeIcon = (type: string) => {
    switch (type) {
      case "success":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "warning":
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case "error":
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  // Get priority badge
  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "urgent":
        return <Badge className="bg-red-100 text-red-800 border-red-200">Urgent</Badge>;
      case "high":
        return <Badge className="bg-orange-100 text-orange-800 border-orange-200">High</Badge>;
      case "normal":
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Normal</Badge>;
      case "low":
        return <Badge className="bg-slate-100 text-slate-600 border-slate-200">Low</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  // Format notification date
  const formatNotificationDate = (dateString: string) => {
    const date = new Date(dateString);
    if (isToday(date)) {
      return formatDistanceToNow(date, { addSuffix: true });
    } else if (isYesterday(date)) {
      return "Yesterday";
    } else {
      return format(date, "MMM dd, yyyy");
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Navigation />
      
      <div className="flex">
        <Sidebar />
        
        <main className="flex-1 p-6">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <Bell className="w-6 h-6 text-slate-600" />
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                    Notifications
                  </h1>
                  <p className="text-slate-500 dark:text-slate-400">
                    {unreadCount > 0 ? `${unreadCount} unread notifications` : "All notifications are read"}
                  </p>
                </div>
              </div>
              
              {unreadCount > 0 && (
                <Button
                  onClick={() => markAllAsReadMutation.mutate()}
                  disabled={markAllAsReadMutation.isPending}
                  data-testid="button-mark-all-read"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Mark All as Read
                </Button>
              )}
            </div>

            {/* Filters */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="w-5 h-5" />
                  Filters
                </CardTitle>
                <CardDescription>
                  Filter and search your notifications
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="search">Search</Label>
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        id="search"
                        placeholder="Search notifications..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8"
                        data-testid="input-search-notifications"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="type-filter">Type</Label>
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                      <SelectTrigger data-testid="select-type-filter">
                        <SelectValue placeholder="All types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="info">Info</SelectItem>
                        <SelectItem value="success">Success</SelectItem>
                        <SelectItem value="warning">Warning</SelectItem>
                        <SelectItem value="error">Error</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="priority-filter">Priority</Label>
                    <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                      <SelectTrigger data-testid="select-priority-filter">
                        <SelectValue placeholder="All priorities" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Priorities</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="read-filter">Status</Label>
                    <Select value={readFilter} onValueChange={setReadFilter}>
                      <SelectTrigger data-testid="select-read-filter">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="unread">Unread</SelectItem>
                        <SelectItem value="read">Read</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="campaign-filter">Campaign</Label>
                    <Select value={campaignFilter} onValueChange={setCampaignFilter}>
                      <SelectTrigger data-testid="select-campaign-filter">
                        <SelectValue placeholder="All campaigns" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Campaigns</SelectItem>
                        {uniqueCampaigns.map((campaign) => (
                          <SelectItem key={campaign} value={campaign || ""}>
                            {campaign}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="date-filter">Date</Label>
                    <Select value={dateFilter} onValueChange={setDateFilter}>
                      <SelectTrigger data-testid="select-date-filter">
                        <SelectValue placeholder="All dates" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Dates</SelectItem>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="yesterday">Yesterday</SelectItem>
                        <SelectItem value="this-week">This Week</SelectItem>
                        <SelectItem value="this-month">This Month</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Notifications List */}
            {isLoading ? (
              <div className="text-center py-12">
                <div className="inline-flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  <span className="text-slate-500">Loading notifications...</span>
                </div>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center">
                    <Bell className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                      No notifications found
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400">
                      {notifications.length === 0
                        ? "You don't have any notifications yet."
                        : "No notifications match your current filters."}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="space-y-4">
                  {paginatedNotifications.map((notification) => (
                  <Card
                    key={notification.id}
                    className={`transition-all hover:shadow-md ${
                      !notification.read ? "border-l-4 border-l-blue-500 bg-blue-50/30" : ""
                    }`}
                    data-testid={`notification-${notification.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3 flex-1">
                          <div className="mt-1">
                            {getTypeIcon(notification.type)}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                              <h3 className={`font-semibold ${!notification.read ? "text-slate-900" : "text-slate-700"}`}>
                                {notification.title}
                              </h3>
                              {!notification.read && (
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              )}
                            </div>
                            
                            <p className="text-slate-600 text-sm mb-2">
                              {notification.message}
                            </p>
                            
                            <div className="flex items-center space-x-4 text-xs text-slate-500">
                              {notification.campaignName && (
                                <div className="flex items-center space-x-1">
                                  <span>Campaign:</span>
                                  <Badge variant="outline" className="text-xs">
                                    {notification.campaignName}
                                  </Badge>
                                </div>
                              )}
                              
                              <div>{getPriorityBadge(notification.priority)}</div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          {/* View KPI Button - if notification has KPI metadata */}
                          {(() => {
                            try {
                              const metadata = notification.metadata ? JSON.parse(notification.metadata) : null;
                              console.log('[View KPI] Notification:', notification.id, 'Metadata:', metadata, 'CampaignId:', notification.campaignId);
                              if (metadata?.kpiId) {
                                return (
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      console.log('[View KPI] ===== BUTTON CLICKED =====');
                                      console.log('[View KPI] Notification ID:', notification.id);
                                      console.log('[View KPI] Campaign ID:', notification.campaignId);
                                      console.log('[View KPI] Metadata:', metadata);
                                      
                                      markAsReadMutation.mutate(notification.id);
                                      
                                      // Navigate to LinkedIn Analytics KPIs tab
                                      const campaignId = notification.campaignId;
                                      console.log('[View KPI] Using campaignId:', campaignId);
                                      
                                      if (campaignId) {
                                        const url = `/campaigns/${campaignId}/linkedin-analytics?tab=kpis`;
                                        console.log('[View KPI] Navigating to:', url);
                                        setLocation(url);
                                      } else {
                                        console.error('[View KPI] No campaignId found!');
                                        toast({
                                          title: "Error",
                                          description: "Cannot navigate to KPI - campaign not found",
                                          variant: "destructive",
                                        });
                                      }
                                    }}
                                    className="bg-purple-600 hover:bg-purple-700"
                                    data-testid={`button-view-kpi-${notification.id}`}
                                  >
                                    View KPI →
                                  </Button>
                                );
                              }
                            } catch (e) {
                              console.error('[View KPI] Error parsing metadata:', e);
                            }
                            return null;
                          })()}
                          
                          {!notification.read && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => markAsReadMutation.mutate(notification.id)}
                              disabled={markAsReadMutation.isPending}
                              data-testid={`button-mark-read-${notification.id}`}
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                          )}
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteNotificationMutation.mutate(notification.id)}
                            disabled={deleteNotificationMutation.isPending}
                            data-testid={`button-delete-${notification.id}`}
                          >
                            <XCircle className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  ))}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center mt-6 px-4">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                      >
                        Previous
                      </Button>
                      <div className="flex items-center gap-1">
                        {(() => {
                          const pages = [];
                          const showEllipsisStart = currentPage > 3;
                          const showEllipsisEnd = currentPage < totalPages - 2;

                          // Always show first page
                          pages.push(
                            <Button
                              key={1}
                              variant={currentPage === 1 ? "default" : "outline"}
                              size="sm"
                              onClick={() => setCurrentPage(1)}
                              className="w-10"
                            >
                              1
                            </Button>
                          );

                          // Show ellipsis or pages near start
                          if (showEllipsisStart) {
                            pages.push(
                              <span key="ellipsis-start" className="px-2 text-slate-400">
                                ...
                              </span>
                            );
                          }

                          // Show current page and neighbors (if not first or last)
                          const start = Math.max(2, Math.min(currentPage - 1, 2));
                          const end = Math.min(totalPages - 1, Math.max(currentPage + 1, 3));
                          
                          for (let i = start; i <= end; i++) {
                            if (i !== 1 && i !== totalPages) {
                              pages.push(
                                <Button
                                  key={i}
                                  variant={currentPage === i ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => setCurrentPage(i)}
                                  className="w-10"
                                >
                                  {i}
                                </Button>
                              );
                            }
                          }

                          // Show ellipsis or pages near end
                          if (showEllipsisEnd) {
                            pages.push(
                              <span key="ellipsis-end" className="px-2 text-slate-400">
                                ...
                              </span>
                            );
                          }

                          // Always show last page (if more than 1 page)
                          if (totalPages > 1) {
                            pages.push(
                              <Button
                                key={totalPages}
                                variant={currentPage === totalPages ? "default" : "outline"}
                                size="sm"
                                onClick={() => setCurrentPage(totalPages)}
                                className="w-10"
                              >
                                {totalPages}
                              </Button>
                            );
                          }

                          return pages;
                        })()}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}