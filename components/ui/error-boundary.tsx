"use client";

import React, { ErrorInfo, ReactNode } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="min-h-screen bg-gradient-to-br from-background via-background to-destructive/5 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
              <Card className="border-destructive/20">
                <CardHeader className="text-center space-y-4">
                  <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-xl border border-destructive/20 flex items-center justify-center">
                    <AlertTriangle className="h-8 w-8 text-destructive" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl font-bold text-destructive">
                      Something went wrong
                    </CardTitle>
                    <CardDescription className="text-lg mt-2">
                      An unexpected error occurred
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <p className="text-muted-foreground text-center text-sm">
                    The application encountered an error. Please try refreshing
                    the page or go back to the homepage.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      onClick={() => this.setState({ hasError: false })}
                      className="flex-1"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Try Again
                    </Button>
                    <Button asChild variant="outline" className="flex-1">
                      <a href="/">
                        <Home className="w-4 h-4 mr-2" />
                        Go Home
                      </a>
                    </Button>
                  </div>
                  {process.env.NODE_ENV === "development" &&
                    this.state.error && (
                      <details className="mt-4 p-3 bg-muted rounded-md text-xs">
                        <summary className="cursor-pointer font-medium">
                          Error Details (Dev)
                        </summary>
                        <pre className="mt-2 whitespace-pre-wrap break-all">
                          {this.state.error.message}
                          {this.state.error.stack &&
                            `\n\n${this.state.error.stack}`}
                        </pre>
                      </details>
                    )}
                </CardContent>
              </Card>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
