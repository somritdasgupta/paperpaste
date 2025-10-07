import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export interface ServerValidationResult {
  isValid: boolean;
  exists: boolean;
  expired: boolean;
  error?: string;
}

export async function validateSessionServer(code: string): Promise<ServerValidationResult> {
  try {
    // Create Supabase client for server-side operations
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return [];
          },
          setAll() {
            // No-op for server-side validation
          },
        },
      }
    );

    // Basic format validation
    if (!code || code.length !== 7 || !/^[A-Z0-9]{7}$/.test(code)) {
      return {
        isValid: false,
        exists: false,
        expired: false,
        error: 'Invalid session code format'
      };
    }

    // Check if session exists in database
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id, code, created_at, updated_at')
      .eq('code', code)
      .single();

    if (sessionError || !session) {
      return {
        isValid: false,
        exists: false,
        expired: false,
        error: 'Session not found'
      };
    }

    // Check if session is expired (24 hours)
    const sessionAge = Date.now() - new Date(session.updated_at).getTime();
    const isExpired = sessionAge > 24 * 60 * 60 * 1000; // 24 hours

    if (isExpired) {
      return {
        isValid: false,
        exists: true,
        expired: true,
        error: 'Session has expired'
      };
    }

    return {
      isValid: true,
      exists: true,
      expired: false
    };

  } catch (error: any) {
    console.error('Server validation error:', error);
    return {
      isValid: false,
      exists: false,
      expired: false,
      error: 'Validation service unavailable'
    };
  }
}

export function isValidSessionCodeFormat(code: string): boolean {
  return Boolean(code && code.length === 7 && /^[A-Z0-9]{7}$/.test(code));
}
