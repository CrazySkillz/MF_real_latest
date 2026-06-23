import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { Notification } from "@shared/schema";
import { UserButton } from "@clerk/clerk-react";

export default function Navigation() {
  const [location, setLocation] = useLocation();
  const isNotificationsPage = location === "/notifications" || location.startsWith("/notifications?");

  // Fetch notifications to get unread count
  const { data: allNotifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const notifications = allNotifications;
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <nav className="bg-card border-b border-border/40 px-6 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
              <i className="fas fa-chart-line text-white text-sm"></i>
            </div>
            <span
              className="text-2xl font-bold tracking-tight"
              style={{
                background: 'linear-gradient(135deg, hsl(24, 95%, 53%), hsl(15, 90%, 45%))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              MimoSaaS
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="relative disabled:opacity-100 disabled:cursor-default"
            onClick={() => setLocation("/notifications")}
            disabled={isNotificationsPage}
            aria-current={isNotificationsPage ? "page" : undefined}
            aria-label="Open Notifications"
            title="Open Notifications"
            data-testid="button-notifications"
          >
            <Bell className={`w-4 h-4 ${isNotificationsPage ? "text-green-600" : ""}`} />
            {unreadCount > 0 && (
              <Badge
                className="absolute -top-1 -right-1 min-w-[20px] h-5 flex items-center justify-center p-0 px-1 bg-red-500 hover:bg-red-600 text-white text-xs font-bold"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            )}
          </Button>

          <UserButton afterSignOutUrl="/sign-in" />
        </div>
      </div>
    </nav>
  );
}
