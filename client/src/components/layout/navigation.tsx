import { Bell, X, AlertCircle, CheckCircle, Info, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useState } from "react";
import type { Notification } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

export default function Navigation() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [showClearAllDialog, setShowClearAllDialog] = useState(false);
  
  // Fetch notifications to get unread count
  const { data: allNotifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Filter to only show performance alerts (Option C: Hybrid)
  // Hide old notification types: reminder, period-complete, trend-alert
  const notifications = allNotifications.filter(n => 
    n.type === 'alert' || n.type === 'performance-alert'
  );

  const unreadCount = notifications.filter(n => !n.read).length;
  
  // Mark notification as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const res = await fetch(`/api/notifications/${notificationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ read: true }),
      });
      if (!res.ok) throw new Error('Failed to mark as read');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
  });
  
  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const unread = notifications.filter(n => !n.read);
      await Promise.all(
        unread.map(n => 
          fetch(`/api/notifications/${n.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ read: true }),
          })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
  });
  
  // Delete all notifications mutation
  const deleteAllNotificationsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/notifications/all/clear', {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete all notifications');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
  });
  
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'alert':
      case 'performance-alert':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'reminder':
        return <Info className="w-4 h-4 text-blue-500" />;
      case 'period-complete':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'trend-alert':
        return <TrendingUp className="w-4 h-4 text-orange-500" />;
      default:
        return <Bell className="w-4 h-4 text-slate-500" />;
    }
  };
  
  const handleNotificationClick = (notification: Notification) => {
    // Mark as read
    if (!notification.read) {
      markAsReadMutation.mutate(notification.id);
    }
    
    // Parse metadata if it's a string
    let metadata = notification.metadata;
    if (typeof metadata === 'string') {
      try {
        metadata = JSON.parse(metadata);
      } catch (e) {
        console.error('Failed to parse notification metadata:', e);
      }
    }
    
    // Navigate to KPI if metadata has actionUrl
    if (metadata && typeof metadata === 'object' && 'actionUrl' in metadata) {
      const actionUrl = metadata.actionUrl as string;
      setLocation(actionUrl);
    } else {
      setLocation('/linkedin-analytics?tab=kpis');
    }
  };

  return (
    <nav className="gradient-card border-b border-border px-6 py-4 backdrop-blur-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{background: 'var(--gradient-primary)'}}>
              <i className="fas fa-chart-line text-white text-sm"></i>
            </div>
            <span className="text-2xl font-bold text-gradient-primary">PerformanceCore</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="relative" data-testid="button-notifications">
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <Badge 
                    className="absolute -top-1 -right-1 min-w-[20px] h-5 flex items-center justify-center p-0 px-1 bg-red-500 hover:bg-red-600 text-white text-xs font-bold"
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0" align="end">
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="font-semibold text-sm">Notifications</h3>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => markAllAsReadMutation.mutate()}
                    >
                      Mark all as read
                    </Button>
                  )}
                  {notifications.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                      onClick={() => setShowClearAllDialog(true)}
                    >
                      Clear all
                    </Button>
                  )}
                </div>
              </div>
              <ScrollArea className="h-[400px]">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Bell className="w-12 h-12 text-slate-300 mb-3" />
                    <p className="text-sm text-slate-500">No notifications yet</p>
                    <p className="text-xs text-slate-400 mt-1">
                      You'll see alerts here when KPIs need attention
                    </p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {notifications.map((notification) => (
                      <button
                        key={notification.id}
                        className={`w-full text-left p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${
                          !notification.read ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''
                        }`}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">
                            {getNotificationIcon(notification.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${!notification.read ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                              {notification.title}
                            </p>
                            <p className={`text-xs mt-0.5 ${!notification.read ? 'text-slate-600 dark:text-slate-400' : 'text-slate-500 dark:text-slate-500'}`}>
                              {notification.message}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              {notification.campaignName && (
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                  Campaign: {notification.campaignName}
                                </span>
                              )}
                              <span className="text-xs text-slate-400">
                                {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                              </span>
                            </div>
                          </div>
                          {!notification.read && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </PopoverContent>
          </Popover>
          
          <div className="flex items-center space-x-3">
            <div className="text-right">
              <div className="text-sm font-medium text-foreground">Park Ranger</div>
              <div className="text-xs text-muted-foreground">Marketing Director</div>
            </div>
            <div className="w-10 h-10 gradient-card rounded-full flex items-center justify-center border border-border">
              <span className="text-sm font-medium text-foreground">PR</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Clear All Confirmation Dialog */}
      <AlertDialog open={showClearAllDialog} onOpenChange={setShowClearAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all notifications?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all {notifications.length} notifications. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                deleteAllNotificationsMutation.mutate();
                setShowClearAllDialog(false);
              }}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </nav>
  );
}
