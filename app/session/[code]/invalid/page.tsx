import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Home } from "lucide-react";

interface Props {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function InvalidSessionPage({
  params,
  searchParams,
}: Props) {
  const { code } = await params;
  const searchParamsResolved = await searchParams;
  const reason = Array.isArray(searchParamsResolved?.reason)
    ? searchParamsResolved.reason[0]
    : searchParamsResolved?.reason || "Session is invalid or has expired";

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-destructive/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="border-destructive/20">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-destructive/10 rounded border border-destructive/20 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold text-destructive">
                Invalid Session
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
              <p className="text-muted-foreground text-sm">{reason}</p>
              <div className="text-xs text-muted-foreground/80 space-y-1">
                <p>• Sessions expire after 24 hours of inactivity</p>
                <p>• Double-check the session code</p>
                <p>• Ask the host to create a new session</p>
              </div>
            </div>
            <Button asChild className="w-full">
              <Link href="/">
                <Home className="w-4 h-4 mr-2" />
                Create New Session
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
