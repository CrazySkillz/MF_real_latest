import { useState } from "react";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { Building2, ChevronRight, Plus } from "lucide-react";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import CreateClientModal from "@/components/modals/create-client-modal";
import { useClient } from "@/lib/clientContext";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { clients, setSelectedClientId } = useClient();
  const [, setLocation] = useLocation();

  const handleSelectClient = (clientId: string) => {
    setSelectedClientId(clientId);
    setLocation("/campaigns");
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="flex">
        <Sidebar />

        <main className="flex-1 p-8 fade-in">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Home</h1>
              <p className="text-muted-foreground mt-1">Select a client to view its campaigns</p>
            </div>
            <Button onClick={() => setIsModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add client
            </Button>
          </div>

          {clients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <Building2 className="w-8 h-8 text-muted-foreground/70" />
              </div>
              <h2 className="text-lg font-semibold text-foreground/80 mb-2">No clients yet</h2>
              <p className="text-muted-foreground/70 mb-6 max-w-xs">
                Create your first client to start viewing its campaigns.
              </p>
              <Button onClick={() => setIsModalOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create your first client
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {clients.map((client) => (
                <button
                  key={client.id}
                  onClick={() => handleSelectClient(client.id)}
                  className="w-full text-left p-5 bg-card rounded-2xl border border-border hover:border-blue-300 hover:shadow-sm transition-all group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                        style={{ background: "var(--gradient-primary)" }}
                      >
                        <Building2 className="w-6 h-6 text-white" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate">{client.name}</p>
                        <p className="text-xs text-muted-foreground/70 mt-1">
                          Added {formatDistanceToNow(new Date(client.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/60 group-hover:text-muted-foreground transition-colors shrink-0" />
                  </div>
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
