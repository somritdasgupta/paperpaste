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

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-destructive/5 flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            <Card className="border-destructive/20">
              <CardHeader className="text-center space-y-4">
                <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-xl border border-destructive/20 flex items-center justify-center">
                  <AlertTriangle className="h-8 w-8 text-destructive" />
                </div>
                <div>
                  <CardTitle className="text-2xl font-bold text-destructive">
                    Application Error
                  </CardTitle>
                  <CardDescription className="text-lg mt-2">
                    Something went wrong with PaperPaste
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <p className="text-muted-foreground text-center text-sm">
                  An unexpected error occurred in the application. Please try
                  refreshing the page or go back to the homepage.
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
      </body>
    </html>
  );
}
