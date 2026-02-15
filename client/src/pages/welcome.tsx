import { useState } from "react";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import CreateClientModal from "@/components/modals/create-client-modal";
import { Button } from "@/components/ui/button";
import { Building2, BarChart3, Target, FileText, Bell } from "lucide-react";

export default function WelcomePage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation />

      <div className="flex">
        <Sidebar />

        <main className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-lg text-center">
            {/* Icon */}
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6" style={{ background: 'var(--gradient-primary)' }}>
              <Building2 className="w-10 h-10 text-white" />
            </div>

            {/* Heading */}
            <h1 className="text-3xl font-bold text-slate-900 mb-3">
              Welcome to PerformanceCore
            </h1>
            <p className="text-slate-500 mb-8 text-lg leading-relaxed">
              Get started by creating your first client. All your campaigns, reports, and analytics will be organised under each client.
            </p>

            {/* CTA */}
            <Button
              size="lg"
              className="px-8"
              onClick={() => setIsModalOpen(true)}
            >
              <Building2 className="w-5 h-5 mr-2" />
              Create your first client
            </Button>

            {/* What you'll unlock preview */}
            <div className="mt-12 grid grid-cols-2 gap-4 text-left">
              {[
                { icon: BarChart3, label: "Dashboard", desc: "Overview of all campaign metrics" },
                { icon: Target, label: "Campaigns", desc: "Create and manage campaigns" },
                { icon: FileText, label: "Reports", desc: "Schedule and export reports" },
                { icon: Bell, label: "Notifications", desc: "KPI alerts and reminders" },
              ].map(({ icon: Icon, label, desc }) => (
                <div key={label} className="flex items-start gap-3 p-3 rounded-xl bg-white border border-slate-100">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">{label}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>

      <CreateClientModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
