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
import { Bell, Filter, Search, Clock, AlertCircle, CheckCircle, Info, XCircle, Check, Trash2, Mail, MailOpen } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Campaign, Notification } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, isToday, isYesterday, formatDistanceToNow } from "date-fns";
import { useClient } from "@/lib/clientContext";

export default function Notifications() {
  const [searchTerm, setSearchTerm] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [readFilter, setReadFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { clients } = useClient();

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
  });
  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
  });

  const setReadStateMutation = useMutation({
    mutationFn: async (vars: { notificationId: string; read: boolean }) => {
      const response = await apiRequest("PATCH", `/api/notifications/${vars.notificationId}`, { read: vars.read });
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
      const response = await apiRequest("DELETE", `/api/notifications/${notificationId}`);
      const result = await response.json();
      return result;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      await queryClient.refetchQueries({ queryKey: ["/api/notifications"] });
      toast({
        title: "Notification deleted",
        description: "The notification has been deleted.",
      });
    },
    onError: (error) => {
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
    
    const matchesPriority = priorityFilter === "all" || notification.priority === priorityFilter;
    const matchesRead = readFilter === "all" || 
                       (readFilter === "unread" && !notification.read) || 
                       (readFilter === "read" && notification.read);
    const campaignClientId = campaigns.find(c => c.id === notification.campaignId)?.clientId || null;
    const matchesClient = clientFilter === "all" || campaignClientId === clientFilter;

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

    return matchesSearch && matchesPriority && matchesRead && matchesClient && matchesDate;
  });

  const uniqueClientIds = Array.from(
    new Set(
      notifications
        .map(n => campaigns.find(c => c.id === n.campaignId)?.clientId)
        .filter(Boolean)
    )
  );

  // Pagination
  const totalPages = Math.ceil(filteredNotifications.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedNotifications = filteredNotifications.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, priorityFilter, readFilter, clientFilter, dateFilter]);

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
        return <Badge className="bg-muted text-muted-foreground border-border">Low</Badge>;
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
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="flex">
        <Sidebar />
        
        <main className="flex-1 p-6">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <Bell className="w-6 h-6 text-muted-foreground" />
                <div>
                  <h1 className="text-2xl font-bold text-foreground">
                    Notifications
                  </h1>
                  <p className="text-muted-foreground/70">
                    {unreadCount > 0 ? `${unreadCount} unread notifications` : "All notifications are read"}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                    <Label htmlFor="client-filter">Client</Label>
                    <Select value={clientFilter} onValueChange={setClientFilter}>
                      <SelectTrigger data-testid="select-client-filter">
                        <SelectValue placeholder="All clients" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Clients</SelectItem>
                        {uniqueClientIds.map((clientId) => (
                          <SelectItem key={clientId} value={clientId || ""}>
                            {clients.find(c => c.id === clientId)?.name || clientId}
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
                  <span className="text-muted-foreground">Loading notifications...</span>
                </div>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center">
                    <Bell className="w-12 h-12 text-muted-foreground/60 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">
                      No notifications found
                    </h3>
                    <p className="text-muted-foreground/70">
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
                              <h3 className={`font-semibold ${!notification.read ? "text-foreground" : "text-foreground/80"}`}>
                                {notification.title}
                              </h3>
                              {/* Unread state is shown via left blue border + subtle background */}
                            </div>
                            
                            <p className="text-muted-foreground text-sm mb-2">
                              {notification.message}
                            </p>
                            
                            <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                              {notification.campaignName && (
                                <div className="flex items-center space-x-1">
                                  <span>Campaign:</span>
                                  <Badge variant="outline" className="text-xs">
                                    {notification.campaignName}
                                  </Badge>
                                </div>
                              )}
                              
                              <div>{getPriorityBadge(notification.priority)}</div>
                              
                              <div className="flex items-center space-x-1">
                                <Clock className="w-3 h-3" />
                                <span>
                                  {isToday(new Date(notification.createdAt))
                                    ? `Today at ${format(new Date(notification.createdAt), 'h:mm a')}`
                                    : isYesterday(new Date(notification.createdAt))
                                    ? `Yesterday at ${format(new Date(notification.createdAt), 'h:mm a')}`
                                    : format(new Date(notification.createdAt), 'MMM d, yyyy h:mm a')}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          {/* View alert button */}
                          {(() => {
                            try {
                              const metadata = notification.metadata ? JSON.parse(notification.metadata) : null;
                              if (metadata?.kpiId || metadata?.benchmarkId) {
                                return (
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      
                                      setReadStateMutation.mutate({ notificationId: notification.id, read: true });
                                      
                                      const campaignId = notification.campaignId;
                                      if (campaignId && (metadata?.kpiId || metadata?.benchmarkId)) {
                                        try {
                                          const rawUrl = String(metadata?.actionUrl || "");
                                          const baseUrl = rawUrl
                                            ? new URL(rawUrl, window.location.origin)
                                            : new URL(`/campaigns/${campaignId}/ga4-metrics`, window.location.origin);
                                          const isBenchmark = Boolean(metadata?.benchmarkId);
                                          baseUrl.searchParams.set("tab", isBenchmark ? "benchmarks" : "kpis");
                                          baseUrl.searchParams.set("highlight", String(isBenchmark ? metadata.benchmarkId : metadata.kpiId));
                                          setLocation(`${baseUrl.pathname}${baseUrl.search}`);
                                          return;
                                        } catch {
                                          // Fall through to existing non-URL-safe fallback below
                                        }
                                      }
                                      if (metadata?.actionUrl) {
                                        setLocation(String(metadata.actionUrl));
                                      } else if (campaignId) {
                                        const url = metadata?.benchmarkId
                                          ? `/campaigns/${campaignId}/ga4-metrics?tab=benchmarks&highlight=${metadata.benchmarkId}`
                                          : `/campaigns/${campaignId}/ga4-metrics?tab=kpis&highlight=${metadata?.kpiId || ''}`;
                                        setLocation(url);
                                      } else {
                                        toast({
                                          title: "Error",
                                          description: "Cannot navigate to alert - link not available",
                                          variant: "destructive",
                                        });
                                      }
                                    }}
                                    className="bg-purple-600 hover:bg-purple-700"
                                    data-testid={`button-view-alert-${notification.id}`}
                                  >
                                    {metadata?.benchmarkId ? "View Benchmark" : "View KPI"}
                                  </Button>
                                );
                              }
                            } catch (e) {
                              // Ignore malformed metadata
                            }
                            return null;
                          })()}
                          
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setReadStateMutation.mutate({
                                    notificationId: notification.id,
                                    read: !notification.read,
                                  })
                                }
                                disabled={setReadStateMutation.isPending}
                                aria-label={notification.read ? "Mark as unread" : "Mark as read"}
                                data-testid={`button-toggle-read-${notification.id}`}
                              >
                                {notification.read ? (
                                  <MailOpen className="w-4 h-4" />
                                ) : (
                                  <Mail className="w-4 h-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{notification.read ? "Mark as unread" : "Mark as read"}</TooltipContent>
                          </Tooltip>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteNotificationMutation.mutate(notification.id)}
                            disabled={deleteNotificationMutation.isPending}
                            data-testid={`button-delete-${notification.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
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
                          
                          // Smart pagination: 1 2 3 ... 10 or 1 ... 8 9 10
                          if (totalPages <= 7) {
                            // Show all pages if 7 or fewer
                            for (let i = 1; i <= totalPages; i++) {
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
                          } else {
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

                            // Show pages around current page
                            let startPage = Math.max(2, currentPage - 1);
                            let endPage = Math.min(totalPages - 1, currentPage + 1);

                            // Adjust if near start
                            if (currentPage <= 3) {
                              startPage = 2;
                              endPage = Math.min(4, totalPages - 1);
                            }

                            // Adjust if near end
                            if (currentPage >= totalPages - 2) {
                              startPage = Math.max(2, totalPages - 3);
                              endPage = totalPages - 1;
                            }

                            // Show ellipsis after first page if needed
                            if (startPage > 2) {
                              pages.push(
                                <span key="ellipsis-start" className="px-2 text-muted-foreground/70">
                                  ...
                                </span>
                              );
                            }

                            // Show middle pages
                            for (let i = startPage; i <= endPage; i++) {
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

                            // Show ellipsis before last page if needed
                            if (endPage < totalPages - 1) {
                              pages.push(
                                <span key="ellipsis-end" className="px-2 text-muted-foreground/70">
                                  ...
                                </span>
                              );
                            }

                            // Always show last page
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
