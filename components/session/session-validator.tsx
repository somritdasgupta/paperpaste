"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserWithCode } from "@/lib/supabase/client";
import { getOrCreateDeviceId } from "@/lib/device";
import { validateSession, setSessionJoined } from "@/lib/session-validation";
import { Button } from "@/components/ui/button";
import SessionValidation from "./session-validation";
import InvalidSession from "./invalid-session";

interface SessionValidatorProps {
  code: string;
  children: React.ReactNode;
}

export default function SessionValidator({
  code,
  children,
}: SessionValidatorProps) {
  const router = useRouter();
  const supabase = getSupabaseBrowserWithCode(code);
  const [isValidating, setIsValidating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const deviceId = getOrCreateDeviceId();

  useEffect(() => {
    let mounted = true;

    const validate = async () => {
      if (!supabase) {
        setError(
          "Database connection not available. Please check your environment configuration."
        );
        setIsValidating(false);
        return;
      }

      try {
        const result = await validateSession(supabase, code);

        if (!mounted) return;

        if (!result.isValid) {
          setError(result.error || "Session is invalid");
          setIsValidating(false);
          return;
        }

        if (result.needsRejoin) {
          // Redirect to pairing screen
          router.replace(`/session/${code}`);
          return;
        }

        // Session is valid and device is registered
        setSessionJoined(code, deviceId);
        setIsValidating(false);
        setError(null);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Session validation failed");
        setIsValidating(false);
      }
    };

    validate();

    return () => {
      mounted = false;
    };
  }, [supabase, code, deviceId, router]);

  if (isValidating) {
    return <SessionValidation code={code} />;
  }

  if (error) {
    return (
      <InvalidSession
        code={code}
        error={error}
        onRetry={() => window.location.reload()}
      />
    );
  }

  return <>{children}</>;
}
