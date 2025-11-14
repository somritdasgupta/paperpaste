"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

interface SessionValidationProps {
  code: string;
}

export default function SessionValidation({ code }: SessionValidationProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="border-primary/20">
          <CardContent className="p-8">
            <div className="flex flex-col items-center space-y-6">
              <div className="w-16 h-16 bg-primary/10 rounded-sm border border-primary/20 flex items-center justify-center">
                <div className="w-8 h-8 bg-primary rounded-sm animate-pulse" />
              </div>
              <div className="text-center space-y-3">
                <div className="flex items-center justify-center space-x-2">
                  <Spinner className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    Validating Session...
                  </span>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Session Code:{" "}
                    <span className="font-mono bg-muted px-2 py-0.5 rounded text-xs">
                      {code}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Checking session status and device registration
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
