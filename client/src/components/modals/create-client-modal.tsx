import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useClient } from "@/lib/clientContext";
import { Building2 } from "lucide-react";
import type { Client } from "@shared/schema";

interface CreateClientModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateClientModal({ isOpen, onClose }: CreateClientModalProps) {
  const [name, setName] = useState("");
  const { toast } = useToast();
  const { setSelectedClientId } = useClient();

  const createClientMutation = useMutation({
    mutationFn: async (clientName: string) => {
      const res = await apiRequest("POST", "/api/clients", { name: clientName });
      return res.json() as Promise<Client>;
    },
    onSuccess: (newClient) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setSelectedClientId(newClient.id);
      toast({
        title: "Client created",
        description: `"${newClient.name}" has been added successfully.`,
      });
      setName("");
      onClose();
    },
    onError: () => {
      toast({
        title: "Failed to create client",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createClientMutation.mutate(name.trim());
  };

  const handleClose = () => {
    if (!createClientMutation.isPending) {
      setName("");
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-3">
            <Building2 className="w-5 h-5" />
            <span>Create new client</span>
          </DialogTitle>
          <DialogDescription>
            Add a client to start managing their campaigns and data.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="clientName">Client name</Label>
            <Input
              id="clientName"
              type="text"
              placeholder="e.g. Acme Corp"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={createClientMutation.isPending}
              autoFocus
            />
          </div>

          <div className="flex items-center space-x-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={handleClose}
              disabled={createClientMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={!name.trim() || createClientMutation.isPending}
            >
              {createClientMutation.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Creating...
                </>
              ) : (
                "Create client"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
