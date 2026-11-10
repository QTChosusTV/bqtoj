// app/api/submit/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  { auth: { persistSession: false } }
)

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '').trim()
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 })
    }

    // Fetch the verified username belonging to this authenticated user using their JWT
    const userClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false },
      }
    )

    const { data: profile, error: profileError } = await userClient
      .from('users')
      .select('username')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.username) {
      return NextResponse.json(
        { error: 'Please complete account setup (/post-register) before submitting.' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { code, problem_id, language } = body

    if (!code || !problem_id || !language) {
      return NextResponse.json({ error: 'Missing required submission fields' }, { status: 400 })
    }

    if (typeof code !== 'string' || code.length > 500_000) {
      return NextResponse.json({ error: 'Code exceeds maximum length' }, { status: 400 })
    }

    const judgeUrl = process.env.JUDGE_URL || process.env.CODE_EXECUTION_URL
    if (!judgeUrl) {
      return NextResponse.json({ error: 'Judge URL not configured' }, { status: 500 })
    }

    // Forward to Judge with the server-verified username and user_id (cannot be spoofed!)
    const r = await fetch(`${judgeUrl}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        code,
        problem_id,
        language,
        username: profile.username,
        user_id: user.id,
      }),
    })

    const data = await r.json()
    return NextResponse.json(data, { status: r.status })
  } catch {
    return NextResponse.json({ error: 'Judge is offline' }, { status: 502 })
  }
}