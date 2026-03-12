import { useState } from "react";
import { useLocation } from "wouter";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import CreateClientModal from "@/components/modals/create-client-modal";
import { Button } from "@/components/ui/button";
import { Building2, Plus, ChevronRight } from "lucide-react";
import { useClient } from "@/lib/clientContext";
import { formatDistanceToNow } from "date-fns";

export default function ClientsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { clients, setSelectedClientId } = useClient();
  const [, setLocation] = useLocation();

  const handleSelectClient = (clientId: string) => {
    setSelectedClientId(clientId);
    setLocation("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="flex">
        <Sidebar />

        <main className="flex-1 p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Clients</h1>
              <p className="text-muted-foreground mt-1">Manage the clients you work with</p>
            </div>
            <Button onClick={() => setIsModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add client
            </Button>
          </div>

          {/* Client list */}
          {clients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <Building2 className="w-8 h-8 text-muted-foreground/70" />
              </div>
              <h2 className="text-lg font-semibold text-foreground/80 mb-2">No clients yet</h2>
              <p className="text-muted-foreground/70 mb-6 max-w-xs">
                Create your first client to start managing campaigns and data.
              </p>
              <Button onClick={() => setIsModalOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create your first client
              </Button>
            </div>
          ) : (
            <div className="space-y-3 max-w-2xl">
              {clients.map((client) => (
                <button
                  key={client.id}
                  onClick={() => handleSelectClient(client.id)}
                  className="w-full flex items-center justify-between p-4 bg-card rounded-xl border border-border hover:border-blue-300 hover:shadow-sm transition-all text-left group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
                      <Building2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{client.name}</p>
                      <p className="text-xs text-muted-foreground/70 mt-0.5">
                        Added {formatDistanceToNow(new Date(client.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/60 group-hover:text-muted-foreground transition-colors" />
                </button>
              ))}
            </div>
          )}
        </main>
      </div>

      <CreateClientModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
