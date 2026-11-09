import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

    const codeExecutionUrl = process.env.CODE_EXECUTION_URL || 'https://78.154.103.30:12731';
    // console.log('[DEBUG] Fetching from:', `${codeExecutionUrl}/ide`);

    const response = await fetch(`${codeExecutionUrl}/ide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, input, language }),
      signal: AbortSignal.timeout(10_000),
    });

    const responseBody = await response.text();
    /* onsole.log('[DEBUG] External service response:', {
      status: response.status,
      statusText: response.statusText,
      body: responseBody,
    });*/

    if (!response.ok) {
      let errorDetails;
      try {
        errorDetails = JSON.parse(responseBody);
      } catch {
        errorDetails = { error: response.statusText, message: responseBody };
      }
      throw new Error(`External service error: ${errorDetails.error || response.statusText}`);
    }

    let result;
    try {
      result = JSON.parse(responseBody);
    } catch (e) {
      // console.log('[DEBUG] Failed to parse external service response:', e);
      throw new Error('Invalid response from external service');
    }

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Execution failed', message: result.message || '' },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
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