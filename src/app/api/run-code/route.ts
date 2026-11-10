// app/api/run-code/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 60;

interface RunCodeRequest {
  code: string;
  input?: string;
  language: 'cpp' | 'c' | 'python' | 'java';
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  { auth: { persistSession: false } }
);

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired session', message: error?.message },
        { status: 401 }
      );
    }

    let body: RunCodeRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    const { code, input = '', language } = body;
    if (!code || !language || !['cpp', 'c', 'python', 'java'].includes(language)) {
      return NextResponse.json(
        { success: false, error: 'Invalid or missing parameters' },
        { status: 400 }
      );
    }

    if (code.length > 1_000_000 || input.length > 100_000) {
      return NextResponse.json(
        { success: false, error: 'Code or input exceeds size limit' },
        { status: 400 }
      );
    }

    const judgeUrl = process.env.CODE_EXECUTION_URL || process.env.JUDGE_URL;
    if (!judgeUrl) {
      return NextResponse.json(
        { success: false, error: 'Code execution service is not configured' },
        { status: 500 }
      );
    }

    const response = await fetch(`${judgeUrl}/ide`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
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