import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plug } from "lucide-react";

interface IntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  platform: string | null;
}

const integrationFormSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  accessToken: z.string().min(1, "Access token is required"),
});

type IntegrationFormData = z.infer<typeof integrationFormSchema>;

export default function IntegrationModal({ isOpen, onClose, platform }: IntegrationModalProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const { toast } = useToast();

  const form = useForm<IntegrationFormData>({
    resolver: zodResolver(integrationFormSchema),
    defaultValues: {
      email: "",
      accessToken: "",
    },
  });

  const createIntegrationMutation = useMutation({
    mutationFn: async (data: { platform: string; name: string; credentials: string }) => {
      const response = await apiRequest("POST", "/api/integrations", {
        platform: data.platform,
        name: data.name,
        connected: true,
        credentials: data.credentials,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      toast({
        title: "Integration successful",
        description: `${getPlatformName(platform)} has been connected successfully.`,
      });
      onClose();
      form.reset();
    },
    onError: () => {
      toast({
        title: "Connection failed",
        description: "Failed to connect to the platform. Please check your credentials and try again.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsConnecting(false);
    },
  });

  const getPlatformName = (platform: string | null) => {
    switch (platform) {
      case "facebook":
        return "Facebook Ads";
      case "google-analytics":
        return "Google Analytics";
      case "linkedin":
        return "LinkedIn Ads";
      case "twitter":
        return "Twitter Ads";
      case "tiktok":
        return "TikTok Ads";
      case "linkedin":
        return "LinkedIn Ads";
      default:
        return "Platform";
    }
  };

  const getPlatformIcon = (platform: string | null) => {
    switch (platform) {
      case "facebook":
        return "fab fa-facebook text-blue-600";
      case "google-analytics":
        return "fab fa-google text-red-500";
      case "linkedin":
        return "fab fa-linkedin text-blue-700";
      case "twitter":
        return "fab fa-twitter text-blue-400";
      case "tiktok":
        return "fab fa-tiktok text-black";
      case "linkedin":
        return "fab fa-linkedin text-blue-700";
      default:
        return "fas fa-plug text-slate-500";
    }
  };

  const getTokenDescription = (platform: string | null) => {
    switch (platform) {
      case "facebook":
        return "Find this in your Facebook Developer Console";
      case "google-analytics":
        return "Generate this in your Google Cloud Console";
      case "linkedin":
        return "Get this from your LinkedIn Developer Portal";
      case "twitter":
        return "Find this in your Twitter Developer Account";
      case "tiktok":
        return "Get this from your TikTok for Business Developer Portal";
      case "linkedin":
        return "Get this from your LinkedIn Developer Portal";
      default:
        return "Find this in your platform's developer console";
    }
  };

  const onSubmit = async (data: IntegrationFormData) => {
    if (!platform) return;
    
    setIsConnecting(true);
    
    // Simulate API key validation delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    createIntegrationMutation.mutate({
      platform,
      name: getPlatformName(platform),
      credentials: JSON.stringify(data),
    });
  };

  const handleClose = () => {
    if (!isConnecting) {
      onClose();
      form.reset();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-3">
            <i className={getPlatformIcon(platform)}></i>
            <span>Connect {getPlatformName(platform)}</span>
          </DialogTitle>
          <DialogDescription>
            Enter your credentials to connect your {getPlatformName(platform)} account
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Account Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              {...form.register("email")}
              disabled={isConnecting}
            />
            {form.formState.errors.email && (
              <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="accessToken">Access Token</Label>
            <Input
              id="accessToken"
              type="password"
              placeholder="••••••••••••••••"
              {...form.register("accessToken")}
              disabled={isConnecting}
            />
            <p className="text-xs text-slate-500">{getTokenDescription(platform)}</p>
            {form.formState.errors.accessToken && (
              <p className="text-sm text-destructive">{form.formState.errors.accessToken.message}</p>
            )}
          </div>
          
          <div className="flex items-center space-x-3 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              className="flex-1"
              onClick={handleClose}
              disabled={isConnecting}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="flex-1"
              disabled={isConnecting}
            >
              {isConnecting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Connecting...
                </>
              ) : (
                <>
                  <Plug className="w-4 h-4 mr-2" />
                  Connect
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
