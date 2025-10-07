"use client";

import type React from "react";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getSupabaseBrowserWithCode } from "@/lib/supabase/client";

function randomCode(): string {
  // 7-digit numeric code
  return Math.floor(1000000 + Math.random() * 9000000).toString();
}

interface JoinFormProps {
  prefilledCode?: string | null;
}

export default function JoinForm({ prefilledCode }: JoinFormProps) {
  const router = useRouter();
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", "", ""]);
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  const cleanedJoin = () => digits.join("").replace(/\D/g, "").slice(0, 7);

  const validateAndJoin = async (code: string) => {
    if (code.length !== 7) return false;

    setIsValidating(true);
    setValidationError(null);

    try {
      const supabase = getSupabaseBrowserWithCode(code);
      if (!supabase) {
        setValidationError("Supabase not configured");
        return false;
      }

      // Check if session exists
      const { data, error } = await supabase
        .from("sessions")
        .select("code")
        .eq("code", code)
        .single();

      if (error || !data) {
        setValidationError("Session not found. Please check the code.");
        return false;
      }

      // Valid session found, proceed to join
      router.push(`/session/${code}`);
      return true;
    } catch (e: any) {
      setValidationError("Failed to validate session code");
      return false;
    } finally {
      setIsValidating(false);
    }
  };

  const onJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = cleanedJoin();
    if (cleaned.length === 7) {
      await validateAndJoin(cleaned);
    }
  };

  const onCreate = () => {
    const newCode = randomCode();
    router.push(`/session/${newCode}?new=1`);
  };

  const onCreateWithCode = (code?: string | null) => {
    const useCode = code && /^\d{7}$/.test(code) ? code : randomCode();
    router.push(`/session/${useCode}?new=1`);
  };

  const setDigit = (index: number, val: string) => {
    const v = (val || "").replace(/\D/g, "").slice(0, 1);
    setDigits((prev) => {
      const next = [...prev];
      next[index] = v;
      return next;
    });
  };

  const onKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      e.preventDefault();
      refs.current[index - 1]?.focus();
      setDigit(index - 1, "");
      return;
    }
    if (e.key === "ArrowLeft" && index > 0) {
      refs.current[index - 1]?.focus();
      return;
    }
    if (e.key === "ArrowRight" && index < 6) {
      refs.current[index + 1]?.focus();
      return;
    }
  };

  const onChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, "");
    if (v.length === 0) {
      setDigit(index, "");
      return;
    }
    const chars = v.slice(0, 7 - index).split("");
    setDigits((prev) => {
      const next = [...prev];
      for (let i = 0; i < chars.length; i++) {
        const pos = index + i;
        if (pos < 7) next[pos] = chars[i];
      }
      return next;
    });
    const nextIndex = Math.min(index + chars.length, 6);
    refs.current[nextIndex]?.focus();
  };

  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text") || "";
    const cleaned = text.replace(/\D/g, "").slice(0, 7).split("");
    if (cleaned.length) {
      e.preventDefault();
      setDigits((prev) => {
        const next = [...prev];
        for (let i = 0; i < 7; i++) next[i] = cleaned[i] || "";
        return next;
      });
      refs.current[Math.min(cleaned.length, 6)]?.focus();
    }
  };

  useEffect(() => {
    // auto validate and join when all 7 digits filled
    const val = cleanedJoin();
    if (val.length === 7 && !isValidating) {
      validateAndJoin(val);
    }
  }, [digits]); // eslint-disable-line react-hooks/exhaustive-deps

  // If a prefilled code is provided, populate the digits on mount
  useEffect(() => {
    if (prefilledCode && /^\d{7}$/.test(prefilledCode)) {
      setDigits(prefilledCode.split(""));
    }
  }, [prefilledCode]);

  return (
    <form onSubmit={onJoin} className="flex flex-col gap-4 sm:gap-6">
      <div className="grid grid-cols-7 gap-2 sm:gap-3 max-w-sm sm:max-w-md mx-auto">
        {digits.map((d, i) => (
          <Input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            value={d}
            onKeyDown={(e) => onKeyDown(i, e)}
            onChange={(e) => onChange(i, e)}
            onPaste={onPaste}
            disabled={isValidating}
            aria-label={`Digit ${i + 1}`}
            className={cn(
              "h-10 sm:h-12 md:h-14",
              "text-base sm:text-lg md:text-2xl",
              "text-center font-medium session-code",
              "min-w-0 flex-1 px-1 sm:px-2",
              "border-2 focus:border-primary",
              "rounded-lg transition-all duration-200",
              "touch-manipulation", // Improves touch responsiveness
              "selection:bg-primary/20", // Better text selection color
              validationError &&
                "border-destructive focus-visible:ring-destructive",
              isValidating && "opacity-50"
            )}
          />
        ))}
      </div>

      {validationError && (
        <div className="text-sm text-destructive text-center bg-destructive/10 border border-destructive/20 rounded-md p-2 max-w-md mx-auto">
          {validationError}
        </div>
      )}

      {isValidating && (
        <div className="text-sm text-muted-foreground text-center">
          Validating session code...
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 sm:gap-2 max-w-md mx-auto w-full">
        <Button
          type="submit"
          variant="default"
          className="w-full sm:flex-1"
          disabled={isValidating || cleanedJoin().length !== 7}
        >
          {isValidating ? "Validating..." : "Join Session"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => onCreateWithCode(prefilledCode)}
          className="w-full sm:flex-1"
          disabled={isValidating}
        >
          Create New
        </Button>
      </div>
    </form>
  );
}
