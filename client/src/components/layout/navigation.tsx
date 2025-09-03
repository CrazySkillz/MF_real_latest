import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function Navigation() {
  return (
    <nav className="glass-strong border-b border-white/20 dark:border-white/10 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{background: 'var(--gradient-primary)'}}>
              <i className="fas fa-chart-line text-white text-sm"></i>
            </div>
            <span className="text-xl font-semibold text-foreground">PerformanceCore</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <Link href="/notifications">
            <Button variant="ghost" size="sm" className="relative" data-testid="button-notifications">
              <Bell className="w-4 h-4" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></span>
            </Button>
          </Link>
          
          <div className="flex items-center space-x-3">
            <div className="text-right">
              <div className="text-sm font-medium text-foreground">Sarah Johnson</div>
              <div className="text-xs text-muted-foreground">Marketing Director</div>
            </div>
            <div className="w-8 h-8 glass-strong rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-foreground">SJ</span>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
