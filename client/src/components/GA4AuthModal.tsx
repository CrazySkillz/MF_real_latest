import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ExternalLink, Copy } from "lucide-react";

interface GA4AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (accessToken: string) => void;
  isLoading?: boolean;
}

export function GA4AuthModal({ isOpen, onClose, onSubmit, isLoading }: GA4AuthModalProps) {
  const [accessToken, setAccessToken] = useState("");
  const [step, setStep] = useState<'instructions' | 'token'>('instructions');

  const handleSubmit = () => {
    if (accessToken.trim()) {
      onSubmit(accessToken.trim());
    }
  };

  const oauthPlaygroundUrl = "https://developers.google.com/oauthplayground/";

  const copyScope = () => {
    navigator.clipboard.writeText("https://www.googleapis.com/auth/analytics.readonly");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Connect to Google Analytics</DialogTitle>
          <DialogDescription>
            Get an access token to connect to your GA4 property
          </DialogDescription>
        </DialogHeader>

        {step === 'instructions' && (
          <div className="space-y-4">
            <Alert>
              <AlertDescription>
                Follow these steps to get your Google Analytics access token:
              </AlertDescription>
            </Alert>
            
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium">1</span>
                <div>
                  <p>Go to the OAuth 2.0 Playground:</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-1"
                    onClick={() => window.open(oauthPlaygroundUrl, '_blank')}
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Open OAuth Playground
                  </Button>
                </div>
              </div>
              
              <div className="flex items-start gap-2">
                <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium">2</span>
                <div>
                  <p>In Step 1, look for "Google Analytics Data API v1" OR manually enter this scope:</p>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-xs">
                      https://www.googleapis.com/auth/analytics.readonly
                    </code>
                    <Button variant="ghost" size="sm" onClick={copyScope}>
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Then click "Authorize APIs"</p>
                </div>
              </div>
              
              <div className="flex items-start gap-2">
                <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium">3</span>
                <p>In Step 2, click "Exchange authorization code for tokens"</p>
              </div>
              
              <div className="flex items-start gap-2">
                <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium">4</span>
                <p>Copy the "Access token" value and return here</p>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={() => setStep('token')}>I have my token</Button>
            </DialogFooter>
          </div>
        )}

        {step === 'token' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="access-token">Access Token</Label>
              <Input
                id="access-token"
                placeholder="Paste your access token here..."
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                disabled={isLoading}
              />
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('instructions')}>
                Back to Instructions
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={!accessToken.trim() || isLoading}
              >
                {isLoading ? "Connecting..." : "Connect"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}