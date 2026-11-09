import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const r = await fetch(`${process.env.JUDGE_URL}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: req.headers.get('authorization') ?? '',
      },
      body: await req.text(),
    })
    return NextResponse.json(await r.json(), { status: r.status })
  } catch {
    return NextResponse.json({ error: 'Judge is offline' }, { status: 502 })
  }
}