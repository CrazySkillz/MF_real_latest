import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function Navigation() {
  return (
    <nav className="bg-white border-b border-slate-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <i className="fas fa-chart-line text-white text-sm"></i>
            </div>
            <span className="text-xl font-semibold text-slate-900">MarketPulse</span>
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
              <div className="text-sm font-medium text-slate-900">Sarah Johnson</div>
              <div className="text-xs text-slate-500">Marketing Director</div>
            </div>
            <div className="w-8 h-8 bg-slate-300 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-slate-700">SJ</span>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
