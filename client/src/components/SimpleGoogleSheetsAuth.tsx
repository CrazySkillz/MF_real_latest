import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SiGoogle } from "react-icons/si";
import { AlertCircle, RefreshCw, FileSpreadsheet } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface SimpleGoogleSheetsAuthProps {
  campaignId: string;
  onSuccess: (connectionInfo?: { connectionId: string; spreadsheetId: string; connectionIds?: string[]; sheetNames?: string[] }) => void;
  onError: (error: string) => void;
  selectionMode?: 'replace' | 'append';
  purpose?: 'spend' | 'revenue' | 'general' | 'linkedin_revenue';
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

export function SimpleGoogleSheetsAuth({ campaignId, onSuccess, onError, selectionMode = 'replace', purpose = 'general' }: SimpleGoogleSheetsAuthProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [authCompleted, setAuthCompleted] = useState(false);
  const [spreadsheets, setSpreadsheets] = useState<Spreadsheet[]>([]);
  const [selectedSpreadsheet, setSelectedSpreadsheet] = useState<string>("");
  const [availableSheets, setAvailableSheets] = useState<Sheet[]>([]);
  const [selectedSheetNames, setSelectedSheetNames] = useState<string[]>([]);
  const isRevenueConnector = purpose === 'revenue' || purpose === 'linkedin_revenue';
  // Keep a ref in sync to avoid any edge-case where the latest checkbox selection
  // isn't reflected yet when the user immediately clicks "Connect".
  const selectedSheetNamesRef = useRef<string[]>([]);
  const [isLoadingSheets, setIsLoadingSheets] = useState(false);
  const [isSelectingSpreadsheet, setIsSelectingSpreadsheet] = useState(false);
  const popupRef = useRef<Window | null>(null);
  const autoConnectRanRef = useRef(false);

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
      const response = await apiRequest("GET", `/api/google-sheets/${campaignId}/spreadsheets?purpose=${encodeURIComponent(purpose)}`);
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
        purpose,
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
      const response = await fetch(
        `/api/google-sheets/${spreadsheetId}/sheets?campaignId=${encodeURIComponent(campaignId)}&purpose=${encodeURIComponent(purpose)}`
      );
      const data = await response.json();
      
      if (data.success && data.sheets && data.sheets.length > 0) {
        setAvailableSheets(data.sheets);
        // Don't auto-select - let user choose
        selectedSheetNamesRef.current = [];
        setSelectedSheetNames([]);
      } else {
        setAvailableSheets([]);
        selectedSheetNamesRef.current = [];
        setSelectedSheetNames([]);
      }
    } catch (error: any) {
      console.error("Failed to fetch sheets:", error);
      // Don't show error, just set empty sheets - user can still proceed with default
      setAvailableSheets([]);
      selectedSheetNamesRef.current = [];
      setSelectedSheetNames([]);
    } finally {
      setIsLoadingSheets(false);
    }
  }, [campaignId]);

  const handleSpreadsheetChange = useCallback((spreadsheetId: string) => {
    autoConnectRanRef.current = false;
    setSelectedSpreadsheet(spreadsheetId);
    setAvailableSheets([]);
    selectedSheetNamesRef.current = [];
    setSelectedSheetNames([]);
    // Fetch available sheets for this spreadsheet
    if (spreadsheetId) {
      fetchAvailableSheets(spreadsheetId);
    }
  }, [fetchAvailableSheets]);

  // Keep the ref always in sync with state so we never send stale selections.
  useEffect(() => {
    selectedSheetNamesRef.current = selectedSheetNames;
  }, [selectedSheetNames]);

  const toggleSheetSelection = useCallback((sheetTitle: string) => {
    autoConnectRanRef.current = false;
    setSelectedSheetNames(prev => {
      // Revenue connector must be single-tab to avoid ambiguity/double-counting.
      if (isRevenueConnector) {
        const next = prev.includes(sheetTitle) ? [] : [sheetTitle];
        selectedSheetNamesRef.current = next;
        return next;
      }

      if (prev.includes(sheetTitle)) {
        const next = prev.filter(s => s !== sheetTitle);
        selectedSheetNamesRef.current = next;
        return next;
      } else {
        const next = [...prev, sheetTitle];
        selectedSheetNamesRef.current = next;
        return next;
      }
    });
  }, [isRevenueConnector]);

  const selectAllSheets = useCallback(() => {
    if (selectedSheetNames.length === availableSheets.length) {
      selectedSheetNamesRef.current = [];
      setSelectedSheetNames([]);
    } else {
      const next = availableSheets.map(sheet => sheet.title);
      selectedSheetNamesRef.current = next;
      setSelectedSheetNames(next);
    }
  }, [availableSheets, selectedSheetNames]);

  const handleSpreadsheetSelection = useCallback(async () => {
    if (!selectedSpreadsheet) {
      onError("Please select a spreadsheet");
      return;
    }

    // Require explicit tab selection to avoid accidentally connecting the wrong tab due to defaults/stale state.
    const sheetsToConnect = selectedSheetNamesRef.current.length > 0 ? selectedSheetNamesRef.current : selectedSheetNames;
    if (availableSheets.length > 0 && (!Array.isArray(sheetsToConnect) || sheetsToConnect.length === 0)) {
      onError(isRevenueConnector ? "Please select 1 tab to connect." : "Please select at least one tab to connect.");
      return;
    }
    if (isRevenueConnector && Array.isArray(sheetsToConnect) && sheetsToConnect.length > 1) {
      onError("Revenue connections support 1 tab only. Please select a single tab.");
      return;
    }

    // Persist the user’s explicit tab selection so the next screen can reliably scope detection,
    // even if something drops props/state during modal transitions.
    try {
      const persisted = (sheetsToConnect || []).filter((s): s is string => typeof s === 'string' && s !== null);
      localStorage.setItem(
        `mm:selectedSheetNames:${campaignId}:${purpose}:${selectedSpreadsheet}`,
        JSON.stringify(persisted)
      );
    } catch {
      // ignore storage failures
    }

    setIsSelectingSpreadsheet(true);

    try {
      // Call the API to connect multiple sheets
      const response = await apiRequest("POST", `/api/google-sheets/select-spreadsheet-multiple`, {
        campaignId,
        spreadsheetId: selectedSpreadsheet,
        sheetNames: sheetsToConnect.length > 0 ? sheetsToConnect : [null],
        selectionMode,
        purpose,
      });

      const data = await response.json();

      if (data.success) {
        // Prefer server-confirmed sheet names (most reliable), fallback to the client selection.
        const connectedSheetNames: string[] =
          Array.isArray(data.sheetNames) && data.sheetNames.length > 0
            ? data.sheetNames
            : sheetsToConnect.filter((s): s is string => s !== null);
        // Overwrite persisted selection with server-confirmed tabs to prevent any stale/mismatched tab names
        // from being reused by later steps (e.g., mapping scope fallback).
        try {
          localStorage.setItem(
            `mm:selectedSheetNames:${campaignId}:${purpose}:${selectedSpreadsheet}`,
            JSON.stringify(connectedSheetNames)
          );
        } catch {
          // ignore storage failures
        }
        onSuccess({
          connectionId: data.connectionIds?.[0] || data.connectionId,
          spreadsheetId: selectedSpreadsheet,
          connectionIds: data.connectionIds || [data.connectionId],
          sheetNames: connectedSheetNames // Pass the connected sheet names (server-confirmed)
        });
      } else {
        throw new Error(data.error || "Failed to connect spreadsheet");
      }
    } catch (error: any) {
      console.error("Failed to select spreadsheet:", error);
      onError(error?.message || "Failed to connect to selected spreadsheet");
    } finally {
      setIsSelectingSpreadsheet(false);
    }
  }, [campaignId, selectedSpreadsheet, selectedSheetNames, availableSheets, onSuccess, onError, isRevenueConnector]);

  // Revenue connector UX: once the user has selected a spreadsheet + exactly one tab, auto-connect (no redundant Next/Connect button).
  useEffect(() => {
    if (!isRevenueConnector) return;
    if (!authCompleted) return;
    if (!selectedSpreadsheet) return;
    if (!selectedSheetNamesRef.current || selectedSheetNamesRef.current.length === 0) return;
    if (isSelectingSpreadsheet) return;
    if (autoConnectRanRef.current) return;
    autoConnectRanRef.current = true;
    void handleSpreadsheetSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRevenueConnector, authCompleted, selectedSpreadsheet, isSelectingSpreadsheet]);

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
              <div className="flex items-center justify-between">
                <Label>{isRevenueConnector ? "Select Sheet/Tab (Revenue/Conversion Value)" : "Select Sheet/Tab(s)"}</Label>
                {!isRevenueConnector && availableSheets.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={selectAllSheets}
                    className="text-xs h-auto py-1"
                  >
                    {selectedSheetNames.length === availableSheets.length ? 'Deselect All' : 'Select All'}
                  </Button>
                )}
              </div>
              {isLoadingSheets ? (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Loading sheets...
                </div>
              ) : availableSheets.length > 0 ? (
                <>
                  <div className="space-y-2 max-h-64 overflow-y-auto border border-slate-200 rounded-md p-3">
                    {isRevenueConnector ? (
                      <RadioGroup
                        value={selectedSheetNames[0] || ""}
                        onValueChange={(v) => toggleSheetSelection(v)}
                        className="space-y-2"
                      >
                        {availableSheets.map((sheet) => (
                          <div key={sheet.sheetId} className="flex items-center space-x-2">
                            <RadioGroupItem id={`sheet-${sheet.sheetId}`} value={sheet.title} />
                            <label
                              htmlFor={`sheet-${sheet.sheetId}`}
                              className="text-sm font-medium leading-none cursor-pointer flex-1"
                            >
                              {sheet.title}
                            </label>
                          </div>
                        ))}
                      </RadioGroup>
                    ) : (
                      availableSheets.map((sheet) => (
                        <div key={sheet.sheetId} className="flex items-center space-x-2">
                          <Checkbox
                            id={`sheet-${sheet.sheetId}`}
                            checked={selectedSheetNames.includes(sheet.title)}
                            onCheckedChange={() => toggleSheetSelection(sheet.title)}
                          />
                          <label
                            htmlFor={`sheet-${sheet.sheetId}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                          >
                            {sheet.title}
                          </label>
                        </div>
                      ))
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-500">
                  Using first sheet (default)
                </p>
              )}
              <p className="text-xs text-slate-400">
                {availableSheets.length > 0 
                  ? (isRevenueConnector
                      ? `Select exactly 1 tab. You’ll map Revenue or Conversion Value columns in the next step.`
                      : `Select one or multiple tabs to connect. If none selected, the first tab will be used.`)
                  : `The first tab in the spreadsheet will be used.`}
              </p>
            </div>
          )}

          {!isRevenueConnector ? (
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
                  {selectedSheetNames.length > 0
                    ? `Connect ${selectedSheetNames.length} Sheet${selectedSheetNames.length > 1 ? 's' : ''}`
                    : 'Connect Spreadsheet'}
                </>
              )}
            </Button>
          ) : (
            <div className="text-xs text-slate-500 text-center">
              {isSelectingSpreadsheet ? "Connecting your selected tab…" : "Select a tab to continue."}
            </div>
          )}
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

