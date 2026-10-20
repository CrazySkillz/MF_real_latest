import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Client } from "@shared/schema";
import { useAuth } from "@clerk/clerk-react";

interface ClientContextValue {
  clients: Client[];
  selectedClientId: string | null;
  setSelectedClientId: (id: string | null) => void;
  isLoading: boolean;
}

const ClientContext = createContext<ClientContextValue | null>(null);

export function ClientProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth();
  const storageKey = `selectedClientId:${userId}`;
  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const [selectedClientId, setSelectedClientIdState] = useState<string | null>(() => {
    return localStorage.getItem(storageKey);
  });

  // Auto-select: restore from localStorage if valid, else pick first client
  useEffect(() => {
    if (isLoading) return;
    if (clients.length === 0) {
      setSelectedClientIdState(null);
      localStorage.removeItem(storageKey);
      return;
    }
    const stored = localStorage.getItem(storageKey);
    if (stored && clients.some(c => c.id === stored)) {
      setSelectedClientIdState(stored);
    } else {
      const first = clients[0].id;
      setSelectedClientIdState(first);
      localStorage.setItem(storageKey, first);
    }
  }, [clients, isLoading, storageKey]);

  const setSelectedClientId = (id: string | null) => {
    setSelectedClientIdState(id);
    if (id) {
      localStorage.setItem(storageKey, id);
    } else {
      localStorage.removeItem(storageKey);
    }
  };

  return (
    <ClientContext.Provider value={{ clients, selectedClientId, setSelectedClientId, isLoading }}>
      {children}
    </ClientContext.Provider>
  );
}

export function useClient(): ClientContextValue {
  const ctx = useContext(ClientContext);
  if (!ctx) throw new Error("useClient must be used within ClientProvider");
  return ctx;
}
