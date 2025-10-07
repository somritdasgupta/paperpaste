"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Home, RotateCcw, Plus } from "lucide-react";

interface InvalidSessionProps {
  code: string;
  error?: string;
  onRetry?: () => void;
}

export default function InvalidSession({
  code,
  error,
  onRetry,
}: InvalidSessionProps) {
  const errorMessage = error || "The session code is invalid or has expired";
  const isSessionNotFound =
    errorMessage.includes("not found") || errorMessage.includes("expired");
  const isConnectionError =
    errorMessage.includes("connection") || errorMessage.includes("Database");

  const handleCreateNewSession = () => {
    // Redirect to create a new session with the same code
    window.location.href = `/?code=${code}&action=create`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-destructive/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="border-destructive/20">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-xl border border-destructive/20 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold text-destructive">
                {isSessionNotFound
                  ? "Session Not Found"
                  : isConnectionError
                  ? "Connection Error"
                  : "Invalid Session"}
              </CardTitle>
              <CardDescription className="text-lg mt-2">
                Session Code:{" "}
                <span className="font-mono bg-muted px-2 py-1 rounded text-sm">
                  {code}
                </span>
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center space-y-3">
              <p className="text-muted-foreground text-sm">
                {isSessionNotFound
                  ? "This session might have expired, been deleted, or the code might be incorrect."
                  : isConnectionError
                  ? "Unable to connect to the session service. Please check your internet connection."
                  : errorMessage}
              </p>
              {isSessionNotFound && (
                <div className="text-xs text-muted-foreground/80 space-y-1">
                  <p>• Sessions expire after 24 hours of inactivity</p>
                  <p>• Double-check the session code</p>
                  <p>• Ask the host to create a new session</p>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-3">
              {isSessionNotFound && (
                <Button onClick={handleCreateNewSession} className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Create New Session with Code {code}
                </Button>
              )}
              <div className="flex flex-col sm:flex-row gap-3">
                {onRetry && (
                  <Button onClick={onRetry} className="flex-1">
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Try Again
                  </Button>
                )}
                <Button
                  asChild
                  variant={onRetry ? "outline" : "default"}
                  className="flex-1"
                >
                  <Link href="/">
                    <Home className="w-4 h-4 mr-2" />
                    Go Home
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
