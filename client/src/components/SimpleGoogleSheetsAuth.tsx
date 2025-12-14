import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { SiGoogle } from "react-icons/si";
import { AlertCircle, RefreshCw, FileSpreadsheet } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface SimpleGoogleSheetsAuthProps {
  campaignId: string;
  onSuccess: () => void;
  onError: (error: string) => void;
}

interface Spreadsheet {
  id: string;
  name: string;
}

interface Sheet {
  sheetId: number;
  title: string;
  index: number;
  sheetType: string;
  gridProperties?: any;
}

export function SimpleGoogleSheetsAuth({ campaignId, onSuccess, onError }: SimpleGoogleSheetsAuthProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [authCompleted, setAuthCompleted] = useState(false);
  const [spreadsheets, setSpreadsheets] = useState<Spreadsheet[]>([]);
  const [selectedSpreadsheet, setSelectedSpreadsheet] = useState<string>("");
  const [availableSheets, setAvailableSheets] = useState<Sheet[]>([]);
  const [selectedSheetName, setSelectedSheetName] = useState<string>("");
  const [isLoadingSheets, setIsLoadingSheets] = useState(false);
  const [isSelectingSpreadsheet, setIsSelectingSpreadsheet] = useState(false);
  const popupRef = useRef<Window | null>(null);

  const cleanupPopup = useCallback(() => {
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.close();
    }
    popupRef.current = null;
    setIsConnecting(false);
  }, []);

  useEffect(() => {
    const handlePopupMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === "sheets_auth_success") {
        setAuthCompleted(true);
        cleanupPopup();
        // Fetch spreadsheets after successful auth
        fetchSpreadsheets();
      } else if (event.data?.type === "sheets_auth_error") {
        cleanupPopup();
        onError(event.data.error || "Authentication failed");
      }
    };

    window.addEventListener("message", handlePopupMessage);
    return () => {
      window.removeEventListener("message", handlePopupMessage);
    };
  }, [cleanupPopup, onError]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (popupRef.current && popupRef.current.closed) {
        cleanupPopup();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [cleanupPopup]);

  const fetchSpreadsheets = useCallback(async () => {
    try {
      const response = await apiRequest("GET", `/api/google-sheets/${campaignId}/spreadsheets`);
      const data = await response.json();

      if (data.spreadsheets && data.spreadsheets.length > 0) {
        setSpreadsheets(data.spreadsheets);
      } else {
        onError("No spreadsheets found in your Google Drive");
      }
    } catch (error: any) {
      console.error("Failed to fetch spreadsheets:", error);
      onError(error?.message || "Failed to fetch spreadsheets");
    }
  }, [campaignId, onError]);

  const startOAuthFlow = useCallback(async () => {
    setIsConnecting(true);
    setAuthCompleted(false);

    try {
      const response = await apiRequest("POST", "/api/auth/google-sheets/connect", {
        campaignId,
      });

      const data = await response.json();

      if (!data.authUrl) {
        throw new Error(data.message || "Failed to start authentication");
      }

      const popup = window.open(
        data.authUrl,
        "google-sheets-auth",
        "width=500,height=700,scrollbars=yes,resizable=yes,location=yes,status=yes,menubar=no,toolbar=no"
      );

      if (!popup) {
        setIsConnecting(false);
        onError("Popup was blocked. Please allow popups and try again.");
        return;
      }

      popupRef.current = popup;
    } catch (error: any) {
      console.error("Google Sheets connection error:", error);
      cleanupPopup();
      onError(error?.message || "Failed to connect to Google Sheets");
    }
  }, [campaignId, cleanupPopup, onError]);

  const fetchAvailableSheets = useCallback(async (spreadsheetId: string) => {
    setIsLoadingSheets(true);
    try {
      const response = await fetch(`/api/google-sheets/${spreadsheetId}/sheets?campaignId=${campaignId}`);
      const data = await response.json();
      
      if (data.success && data.sheets && data.sheets.length > 0) {
        setAvailableSheets(data.sheets);
        // Auto-select first sheet if available
        if (data.sheets.length > 0) {
          setSelectedSheetName(data.sheets[0].title);
        }
      } else {
        setAvailableSheets([]);
        setSelectedSheetName("");
      }
    } catch (error: any) {
      console.error("Failed to fetch sheets:", error);
      // Don't show error, just set empty sheets - user can still proceed with default
      setAvailableSheets([]);
      setSelectedSheetName("");
    } finally {
      setIsLoadingSheets(false);
    }
  }, [campaignId]);

  const handleSpreadsheetChange = useCallback((spreadsheetId: string) => {
    setSelectedSpreadsheet(spreadsheetId);
    setAvailableSheets([]);
    setSelectedSheetName("");
    // Fetch available sheets for this spreadsheet
    if (spreadsheetId) {
      fetchAvailableSheets(spreadsheetId);
    }
  }, [fetchAvailableSheets]);

  const handleSpreadsheetSelection = useCallback(async () => {
    if (!selectedSpreadsheet) {
      onError("Please select a spreadsheet");
      return;
    }

    setIsSelectingSpreadsheet(true);

    try {
      const response = await apiRequest("POST", `/api/google-sheets/select-spreadsheet`, {
        campaignId,
        spreadsheetId: selectedSpreadsheet,
        sheetName: selectedSheetName || null, // Pass selected sheet name, or null to use first sheet
      });

      const data = await response.json();

      if (data.success) {
        onSuccess();
      } else {
        throw new Error(data.error || "Failed to connect spreadsheet");
      }
    } catch (error: any) {
      console.error("Failed to select spreadsheet:", error);
      onError(error?.message || "Failed to connect to selected spreadsheet");
    } finally {
      setIsSelectingSpreadsheet(false);
    }
  }, [campaignId, selectedSpreadsheet, selectedSheetName, onSuccess, onError]);

  // Show spreadsheet selection after auth
  if (authCompleted && spreadsheets.length > 0) {
    return (
      <Card className="w-full border border-slate-200">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-green-600" />
            Select Your Spreadsheet
          </CardTitle>
          <CardDescription>
            Choose which Google Sheets document to connect for campaign data
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Available Spreadsheets</Label>
            <Select value={selectedSpreadsheet} onValueChange={handleSpreadsheetChange}>
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

          {selectedSpreadsheet && (
            <div className="space-y-2">
              <Label>Select Sheet/Tab</Label>
              {isLoadingSheets ? (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Loading sheets...
                </div>
              ) : availableSheets.length > 0 ? (
                <Select value={selectedSheetName} onValueChange={setSelectedSheetName}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a sheet/tab..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSheets.map((sheet) => (
                      <SelectItem key={sheet.sheetId} value={sheet.title}>
                        {sheet.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-slate-500">
                  Using first sheet (default)
                </p>
              )}
              <p className="text-xs text-slate-400">
                {availableSheets.length > 0 
                  ? `Select which tab to use from this spreadsheet. If not selected, the first tab will be used.`
                  : `The first tab in the spreadsheet will be used.`}
              </p>
            </div>
          )}

          <Button
            onClick={handleSpreadsheetSelection}
            disabled={!selectedSpreadsheet || isSelectingSpreadsheet}
            className="w-full"
            size="lg"
          >
            {isSelectingSpreadsheet ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Connect Spreadsheet
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Initial connection screen
  return (
    <Card className="w-full border border-slate-200">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center gap-2">
          <SiGoogle className="w-5 h-5 text-green-600" />
          Connect Google Sheets
        </CardTitle>
        <CardDescription>
          Sign in with Google to import campaign data from your spreadsheets.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/40">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <p className="font-medium">Secure Google Sign-In</p>
            <p className="text-sm">
              Click connect to launch Google's authentication window. After signing in you'll pick your spreadsheet.
            </p>
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <Button
            onClick={startOAuthFlow}
            disabled={isConnecting}
            className="w-full"
            size="lg"
          >
            {isConnecting ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Waiting for Google...
              </>
            ) : (
              <>
                <SiGoogle className="w-4 h-4 mr-2" />
                Connect Google Sheets
              </>
            )}
          </Button>

          {isConnecting && (
            <p className="text-xs text-slate-500 text-center">
              We opened a Google sign-in window. Complete the login to continue.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

