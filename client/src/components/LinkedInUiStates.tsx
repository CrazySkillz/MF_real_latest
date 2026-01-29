import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

type LinkedInTabStateProps = {
  title: string;
  description?: string;
  message?: string;
  onRetry?: () => void;
  primaryAction?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
};

export function LinkedInTabErrorState({
  title,
  description,
  message,
  onRetry,
  primaryAction,
  secondaryAction,
}: LinkedInTabStateProps) {
  return (
    <Card className="border-slate-200 dark:border-slate-700">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <div>
            <AlertTitle>We couldn’t load this data</AlertTitle>
            <AlertDescription>
              {message || "Please try again in a moment."}
            </AlertDescription>
          </div>
        </Alert>
        <div className="flex flex-wrap gap-2">
          {onRetry ? (
            <Button variant="outline" onClick={onRetry}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          ) : null}
          {primaryAction ? (
            <Button onClick={primaryAction.onClick}>{primaryAction.label}</Button>
          ) : null}
          {secondaryAction ? (
            <Button variant="outline" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function LinkedInTabEmptyState({
  title,
  description,
  message,
  primaryAction,
  secondaryAction,
}: LinkedInTabStateProps) {
  return (
    <Card className="border-slate-200 dark:border-slate-700">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-slate-600 dark:text-slate-400">
          {message || "No data available yet."}
        </div>
        <div className="flex flex-wrap gap-2">
          {primaryAction ? (
            <Button onClick={primaryAction.onClick}>{primaryAction.label}</Button>
          ) : null}
          {secondaryAction ? (
            <Button variant="outline" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

type LinkedInErrorBoundaryProps = {
  children: React.ReactNode;
};

type LinkedInErrorBoundaryState = { hasError: boolean; message?: string };

export class LinkedInErrorBoundary extends React.Component<
  LinkedInErrorBoundaryProps,
  LinkedInErrorBoundaryState
> {
  state: LinkedInErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, message: String(error?.message || "Unexpected error") };
  }

  componentDidCatch(error: any) {
    // Don’t spam production consoles; keep detailed error logging to dev only.
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error("[LinkedInErrorBoundary]", error);
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="p-6">
        <Card className="border-slate-200 dark:border-slate-700">
          <CardHeader>
            <CardTitle>Something went wrong</CardTitle>
            <CardDescription>LinkedIn analytics couldn’t be displayed.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <div>
                <AlertTitle>Page error</AlertTitle>
                <AlertDescription>{this.state.message}</AlertDescription>
              </div>
            </Alert>
            <div className="flex gap-2">
              <Button onClick={() => window.location.reload()}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Reload
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
}

