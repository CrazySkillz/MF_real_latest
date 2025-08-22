import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { SiGoogle } from "react-icons/si";
import { FileSpreadsheet, CheckCircle, AlertCircle } from "lucide-react";

interface GoogleSheetsConnectionFlowProps {
  campaignId: string;
  onConnectionSuccess: () => void;
}

interface Spreadsheet {
  id: string;
  name: string;
  url: string;
}

export function GoogleSheetsConnectionFlow({ campaignId, onConnectionSuccess }: GoogleSheetsConnectionFlowProps) {
  const [step, setStep] = useState<'credentials' | 'connecting' | 'select-sheet' | 'manual-entry' | 'connected'>('credentials');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [showClientIdInput, setShowClientIdInput] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [spreadsheets, setSpreadsheets] = useState<Spreadsheet[]>([]);
  const [selectedSpreadsheet, setSelectedSpreadsheet] = useState<string>('');
  const [manualSpreadsheetId, setManualSpreadsheetId] = useState<string>('');
  const { toast } = useToast();

  const handleGoogleOAuth = async () => {
    if (!clientId || !clientSecret) {
      setShowClientIdInput(true);
      toast({
        title: "OAuth Credentials Required",
        description: "Please enter both your Google OAuth Client ID and Client Secret to continue.",
        variant: "destructive"
      });
      return;
    }

    setIsConnecting(true);
    setStep('connecting');

    try {
      // Use current domain for redirect - works for both localhost and Replit domains
      const redirectUri = `${window.location.origin}/oauth-callback.html`;
      const scope = 'https://www.googleapis.com/auth/spreadsheets.readonly https://www.googleapis.com/auth/drive.readonly';
      
      console.log('OAuth redirect URI:', redirectUri);
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${encodeURIComponent(clientId)}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent(scope)}&` +
        `access_type=offline&` +
        `prompt=consent`;

      // Open popup for OAuth
      const popup = window.open(authUrl, 'google-oauth', 'width=500,height=600');
      
      if (!popup) {
        toast({
          title: "Popup Blocked",
          description: "Please allow popups for this site and try again.",
          variant: "destructive"
        });
        setStep('credentials');
        setIsConnecting(false);
        return;
      }
      
      console.log('OAuth popup opened successfully');
      
      // Listen for OAuth callback
      const handleMessage = async (event: MessageEvent) => {
        console.log('Received message:', event.data, 'from origin:', event.origin);
        
        // Accept messages from same origin (more flexible for Replit domains)
        const currentOrigin = window.location.origin;
        if (event.origin !== currentOrigin) {
          console.log(`Rejecting message from ${event.origin}, expected ${currentOrigin}`);
          return;
        }
        
        if (event.data.type === 'OAUTH_SUCCESS') {
          const authCode = event.data.code;
          
          try {
            // Exchange authorization code for tokens
            const response = await fetch('/api/google-sheets/oauth-exchange', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                campaignId,
                authCode,
                clientId,
                clientSecret,
                redirectUri
              })
            });

            const data = await response.json();
            
            if (data.success) {
              setSpreadsheets(data.spreadsheets || []);
              setStep('select-sheet');
              toast({
                title: "Connected to Google Sheets!",
                description: "Select a spreadsheet to import campaign data from."
              });
            } else {
              // Check if this is a Drive API issue that requires manual entry
              if (data.errorCode === 'DRIVE_API_DISABLED') {
                setStep('manual-entry');
                toast({
                  title: "API Access Required",
                  description: "Please enable BOTH Google Drive API and Google Sheets API in your Cloud Console, or enter a spreadsheet ID manually.",
                  variant: "destructive"
                });
              } else {
                throw new Error(data.error || 'OAuth exchange failed');
              }
            }
          } catch (error: any) {
            console.error('Google Sheets OAuth error:', error);
            toast({
              title: "Connection Failed",
              description: error.message || "Failed to connect to Google Sheets",
              variant: "destructive"
            });
            setStep('credentials');
          }
        } else if (event.data.type === 'OAUTH_ERROR') {
          toast({
            title: "OAuth Error",
            description: event.data.error || "Authentication failed",
            variant: "destructive"
          });
          setStep('credentials');
        }
        
        cleanup();
      };

      const cleanup = () => {
        window.removeEventListener('message', handleMessage);
        if (popup && !popup.closed) {
          popup.close();
        }
        setIsConnecting(false);
        clearInterval(checkClosed);
        clearTimeout(timeoutId);
      };

      window.addEventListener('message', handleMessage);
      
      // Handle popup being closed manually
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', handleMessage);
          setIsConnecting(false);
          setStep('credentials');
          clearTimeout(timeoutId);
        }
      }, 1000);
      
      // Set timeout for OAuth flow (5 minutes)
      const timeoutId = setTimeout(() => {
        console.log('OAuth flow timed out');
        toast({
          title: "Connection Timeout",
          description: "The connection process timed out. Please try again.",
          variant: "destructive"
        });
        setStep('credentials');
        cleanup();
      }, 5 * 60 * 1000);

    } catch (error: any) {
      console.error('Google Sheets connection error:', error);
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to start Google Sheets connection",
        variant: "destructive"
      });
      setIsConnecting(false);
      setStep('credentials');
    }
  };

  const handleSpreadsheetSelection = async (manualId?: string) => {
    const spreadsheetId = manualId || selectedSpreadsheet;
    if (!spreadsheetId) {
      toast({
        title: "Selection Required",
        description: "Please select or enter a spreadsheet ID to continue.",
        variant: "destructive"
      });
      return;
    }

    try {
      const response = await fetch('/api/google-sheets/select-spreadsheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId,
          spreadsheetId: spreadsheetId
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setStep('connected');
        toast({
          title: "Spreadsheet Connected!",
          description: "Your Google Sheets data is now connected to this campaign."
        });
        onConnectionSuccess();
      } else {
        throw new Error(data.error || 'Failed to connect spreadsheet');
      }
    } catch (error: any) {
      toast({
        title: "Selection Failed",
        description: error.message || "Failed to connect to selected spreadsheet",
        variant: "destructive"
      });
    }
  };

  if (step === 'manual-entry') {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-green-500" />
            Enter Spreadsheet ID
          </CardTitle>
          <CardDescription>
            Enter your Google Sheets ID manually. You can find this in your spreadsheet URL.
            <br />
            <span className="text-xs text-slate-400">Example: 1ABC...XYZ from docs.google.com/spreadsheets/d/1ABC...XYZ/edit</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Spreadsheet ID</Label>
            <Input
              value={manualSpreadsheetId}
              onChange={(e) => setManualSpreadsheetId(e.target.value)}
              placeholder="1ABC...XYZ"
              className="font-mono text-sm"
            />
          </div>
          
          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={() => setStep('credentials')} className="flex-1">
              Back
            </Button>
            <Button 
              onClick={() => handleSpreadsheetSelection(manualSpreadsheetId)}
              disabled={!manualSpreadsheetId.trim()}
              className="flex-1"
            >
              Connect Spreadsheet
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === 'connected') {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="text-center py-8">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">Connected!</h3>
          <p className="text-slate-500 dark:text-slate-400">
            Your Google Sheets data is now connected and will sync automatically.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (step === 'select-sheet') {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-green-500" />
            Select Spreadsheet
          </CardTitle>
          <CardDescription>
            Choose which Google Sheets document to connect for campaign data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {spreadsheets.length > 0 ? (
            <>
              <div className="space-y-2">
                <Label>Available Spreadsheets</Label>
                <Select value={selectedSpreadsheet} onValueChange={setSelectedSpreadsheet}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a spreadsheet..." />
                  </SelectTrigger>
                  <SelectContent>
                    {spreadsheets.map((sheet) => (
                      <SelectItem key={sheet.id} value={sheet.id}>
                        {sheet.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => setStep('credentials')} className="flex-1">
                  Back
                </Button>
                <Button 
                  onClick={() => handleSpreadsheetSelection()}
                  disabled={!selectedSpreadsheet}
                  className="flex-1"
                >
                  Connect Spreadsheet
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <AlertCircle className="w-8 h-8 mx-auto text-orange-500 mb-2" />
              <p className="text-slate-600 dark:text-slate-400">No spreadsheets found in your Google Drive</p>
              <Button variant="outline" onClick={() => setStep('credentials')} className="mt-4">
                Try Again
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SiGoogle className="w-5 h-5 text-green-500" />
          Connect Google Sheets
        </CardTitle>
        <CardDescription>
          Import campaign data and metrics from your Google Sheets
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!showClientIdInput ? (
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <FileSpreadsheet className="w-8 h-8 text-green-500" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">Connect Your Spreadsheets</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                Access your Google Sheets data to automatically import campaign metrics, budgets, and performance data.
              </p>
            </div>
            <Button onClick={() => setShowClientIdInput(true)} className="w-full">
              <SiGoogle className="w-4 h-4 mr-2" />
              Connect with Google OAuth
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Badge variant="outline" className="mb-3">OAuth Setup Required</Badge>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                To connect Google Sheets, provide your OAuth credentials from Google Cloud Console.
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="client-id">Google OAuth Client ID</Label>
              <Input
                id="client-id"
                type="text"
                placeholder="Your Google OAuth Client ID"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="client-secret">Google OAuth Client Secret</Label>
              <Input
                id="client-secret"
                type="password"
                placeholder="Your Google OAuth Client Secret"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
              />
            </div>
            
            <div className="flex gap-3 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setShowClientIdInput(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleGoogleOAuth}
                disabled={isConnecting || !clientId || !clientSecret}
                className="flex-1"
              >
                {isConnecting ? "Connecting..." : "Continue"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}