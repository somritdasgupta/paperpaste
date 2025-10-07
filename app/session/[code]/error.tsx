"use client";

import { useEffect } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function SessionErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Session error:", error);
  }, [error]);

  const isSessionNotFound =
    error.message.includes("not found") || error.message.includes("404");
  const isNetworkError =
    error.message.includes("network") || error.message.includes("fetch");

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="border-destructive/20">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-xl border border-destructive/20 flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold text-destructive">
                {isSessionNotFound ? "Session Not Found" : "Session Error"}
              </CardTitle>
              <CardDescription className="text-lg mt-2">
                {isSessionNotFound
                  ? "The session you're looking for doesn't exist"
                  : isNetworkError
                  ? "Connection problem"
                  : "Something went wrong"}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground text-center text-sm">
              {isSessionNotFound
                ? "The session might have expired, been deleted, or the code might be incorrect."
                : isNetworkError
                ? "Please check your internet connection and try again."
                : "An unexpected error occurred while loading the session. Please try again."}
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={reset} className="flex-1">
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <Link href="/">
                  <Home className="w-4 h-4 mr-2" />
                  Go Home
                </Link>
              </Button>
            </div>
            {process.env.NODE_ENV === "development" && (
              <details className="mt-4 p-3 bg-muted rounded-md text-xs">
                <summary className="cursor-pointer font-medium">
                  Error Details (Dev)
                </summary>
                <pre className="mt-2 whitespace-pre-wrap break-all">
                  {error.message}
                  {error.stack && `\n\n${error.stack}`}
                </pre>
              </details>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
