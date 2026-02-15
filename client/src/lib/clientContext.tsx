import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Client } from "@shared/schema";

const STORAGE_KEY = "selectedClientId";

interface ClientContextValue {
  clients: Client[];
  selectedClientId: string | null;
  setSelectedClientId: (id: string | null) => void;
  isLoading: boolean;
}

const ClientContext = createContext<ClientContextValue | null>(null);

export function ClientProvider({ children }: { children: ReactNode }) {
  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const [selectedClientId, setSelectedClientIdState] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEY);
  });

  // Auto-select: restore from localStorage if valid, else pick first client
  useEffect(() => {
    if (isLoading || clients.length === 0) return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && clients.some(c => c.id === stored)) {
      setSelectedClientIdState(stored);
    } else {
      const first = clients[0].id;
      setSelectedClientIdState(first);
      localStorage.setItem(STORAGE_KEY, first);
    }
  }, [clients, isLoading]);

  const setSelectedClientId = (id: string | null) => {
    setSelectedClientIdState(id);
    if (id) {
      localStorage.setItem(STORAGE_KEY, id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
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
