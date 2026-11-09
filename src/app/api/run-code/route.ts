import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 60;

interface RunCodeRequest {
  code: string;
  input: string;
  language: 'cpp' | 'c' | 'python' | 'java';
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  { auth: { persistSession: false } }
);

export async function POST(request: NextRequest) {
  try {
    // console.log('[DEBUG] Request headers:', Object.fromEntries(request.headers));

    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // console.log('[DEBUG] Missing or invalid Authorization header');
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      // console.log('[DEBUG] Supabase auth error:', error?.message);
      return NextResponse.json(
        { success: false, error: 'Invalid or expired session', message: error?.message },
        { status: 401 }
      );
    }

    let body: RunCodeRequest;
    try {
      body = await request.json();
      // console.log('[DEBUG] Request body:', body);
    } catch (e) {
      // console.log('[DEBUG] Failed to parse request body:', e);
      return NextResponse.json(
        { success: false, error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    const { code, input, language } = body;
    if (!code || !language || !['cpp', 'c', 'python', 'java'].includes(language)) {
      // console.log('[DEBUG] Invalid parameters:', { code, input, language });
      return NextResponse.json(
        { success: false, error: 'Invalid or missing parameters' },
        { status: 400 }
      );
    }

    if (code.length > 1_000_000 || input.length > 100_000) {
      // console.log('[DEBUG] Payload too large:', { codeLength: code.length, inputLength: input.length });
      return NextResponse.json(
        { success: false, error: 'Code or input exceeds size limit' },
        { status: 400 }
      );
    }

        const judgeUrl = process.env.CODE_EXECUTION_URL || 'http://78.154.103.30:12731';

    const response = await fetch(`${judgeUrl}/ide`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,          // the judge verifies the token itself
      },
      body: JSON.stringify({ code, input, language }),
      signal: AbortSignal.timeout(50_000),
    });

    const text = await response.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Judge returned an invalid response', message: text.slice(0, 200) },
        { status: 502 }
      );
    }
    // Compile errors, TLE, etc. come back as 400 with a JSON body: pass them through
    // so the user sees the compiler message instead of a generic 500.
    return NextResponse.json(result, { status: result.success ? 200 : response.status });
  } catch (error) {
    console.error('[ERROR] Code execution failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process request',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ready',
    message: 'Code execution API endpoint',
    supportedLanguages: ['cpp', 'c', 'python', 'java'],
  });
}