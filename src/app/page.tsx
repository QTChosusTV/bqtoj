'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import Link from 'next/link'
import Image from 'next/image'
import { getDisplayedElo } from "@/utils/eloAccumulation"
import { getEloClass, getEloColor } from "@/utils/eloDisplay"
import { useAuth } from '@/context/AuthContext'
import AnimatedContent from '@/components/reactbits/AnimatedContent/AnimatedContent'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const eloRanks = [
  { class: 'elo-0-400', min: 0 },
  { class: 'elo-400-800', min: 400 },
  { class: 'elo-800-1200', min: 800 },
  { class: 'elo-1200-1400', min: 1200 },
  { class: 'elo-1400-1500', min: 1400 },
  { class: 'elo-1500-1600', min: 1500 },
  { class: 'elo-1600-1750', min: 1600 },
  { class: 'elo-1750-1900', min: 1750 },
  { class: 'elo-1900-2100', min: 1900 },
  { class: 'elo-2100-2300', min: 2100 },
  { class: 'elo-2300-2500', min: 2300 },
  { class: 'elo-2500-2700', min: 2500 },
  { class: 'elo-2700-3000', min: 2700 },
  { class: 'elo-3000-plus', min: 3000 },
]

type Contest = {
  id: number
  name: string | null
  time_start: string | null
  time_end: string | null
  elo_min: number | null
  elo_max: number | null
  link: string | null
}
 
type LeaderboardUser = {
  username: string
  elo: number
  displayElo: number
}
 
type TopACUser = {
  username: string
  count: number
  elo: number
}
 
// ── Reusable rank row ────────────────────────────────────────
function RankRow({
  rank,
  username,
  valueLabel,
  eloForIcon,
}: {
  rank: number
  username: string
  valueLabel: string
  eloForIcon: number
}) {
  const eloClass = getEloClass(eloForIcon)
  return (
    <Link href={`/user/${encodeURIComponent(username)}`} prefetch={false} style={{ textDecoration: 'none', display: 'block' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '24px 26px 1fr 48px',
          alignItems: 'center',
          gap: '6px',
          padding: '7px 8px',
          borderRadius: '6px',
          transition: 'background 0.12s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = '#1a1c2e')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <span style={{
          fontSize: '14px',
          color: rank === 1 ? '#00ddff' : rank === 2 ? '#ffbf00' : rank === 3 ? '#aaaaaa' : '#4a4e62',
          fontWeight: '500',
          textAlign: 'center',
        }}>{rank}</span>
        <Image
          src={`/assets/ranks/${eloClass}.png`}
          alt={eloClass}
          width={22}
          height={22}
          style={{ imageRendering: 'pixelated' }}
        />
        <span style={{
          fontSize: '14px',
          fontWeight: '500',
          color: getEloColor(eloForIcon),
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>{username}</span>
        <span style={{
          fontSize: '14px',
          fontWeight: '500',
          color: getEloColor(eloForIcon),
          textAlign: 'right',
        }}>{valueLabel}</span>
      </div>
    </Link>
  )
}
 
// ── Panel wrapper ────────────────────────────────────────────
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: '#10121a',
      border: '1px solid #1e2030',
      borderRadius: '12px',
      padding: '14px',
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0,
    }}>
      <div style={{
        fontSize: '16px',
        fontWeight: '500',
        color: '#c8ccde',
        marginBottom: '10px',
        paddingBottom: '8px',
        borderBottom: '1px solid #1e2030',
      }}>{title}</div>
      {children}
    </div>
  )
}

export default function HomePage() {
  const [upcoming, setUpcoming] = useState<Contest[]>([])
  const [ongoing, setOngoing] = useState<Contest[]>([])
  const [past, setPast] = useState<Contest[]>([])
  const [elo, setElo] = useState<number>(0)
  const [tick, setTick] = useState(0)
  const [topRanking, setTopRanking] = useState<LeaderboardUser[]>([])
  const { username, email } = useAuth()
  const [topAC, setTopAC] = useState<TopACUser[]>([])

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(interval)
  }, [])
 
  // fetch contests
  useEffect(() => {
    const run = async () => {
      const { data } = await supabase
        .from('contests')
        .select('*')
        .order('time_start', { ascending: true })
        .limit(20)
      if (!data) return
      const now = new Date().toISOString()
      const up: Contest[] = [], on: Contest[] = [], pa: Contest[] = []
      for (const c of data) {
        if (c.time_start > now) up.push(c)
        else if (c.time_end >= now) on.push(c)
        else pa.push(c)
      }
      setUpcoming(up)
      setOngoing(on)
      setPast(pa.sort((a, b) =>
        new Date(b.time_end ?? 0).getTime() - new Date(a.time_end ?? 0).getTime()
      ).slice(0, 5))
    }
    run()
  }, [])
 
  // fetch logged-in user elo
  useEffect(() => {
    if (!username) return
    const run = async () => {
      const { data } = await supabase
        .from('leaderboard')
        .select('elo, history')
        .eq('username', username)
        .maybeSingle()
      if (!data) return
      setElo(getDisplayedElo(data.elo, data.history?.length ?? 0))
    }
    run()
  }, [username])
 
  // fetch leaderboard top 7 + top AC this month
  useEffect(() => {
    // Top ranking
    const fetchRanking = async () => {
      const { data } = await supabase
        .from('leaderboard')
        .select('username, elo, history')
        .order('elo', { ascending: false })
        .limit(50) // fetch more to account for filtering
      if (!data) return
      const filtered = data
        .filter(u => (u.history?.length ?? 0) >= 5)
        .slice(0, 7)
      setTopRanking(filtered.map(u => ({
        username: u.username,
        elo: u.elo,
        displayElo: u.elo, // decay = 0 at 5+ contests
      })))
    }
    // Top AC this month — fetch only accepted submissions in date range,
    // count unique problems solved per user, sort descending
    const fetchTopAC = async () => {
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString()
 
      const { data } = await supabase
        .from('submissions')
        .select('username, problem_id')
        .eq('overall', 'Accepted')
        .lt('problem_id', 1_000_000_000)
        .gte('created_at', monthStart)
        .lt('created_at', monthEnd)
 
      if (!data) return
 
      // Deduplicate: count unique problems per user
      const map: Record<string, Set<number>> = {}
      for (const row of data) {
        if (!map[row.username]) map[row.username] = new Set()
        map[row.username].add(row.problem_id)
      }
 
      const sorted = Object.entries(map)
        .map(([u, s]) => ({ username: u, count: s.size }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 7)
 
      if (sorted.length === 0) return
 
      // Fetch elo for these users
      const { data: lbData } = await supabase
        .from('leaderboard')
        .select('username, elo, history')
        .in('username', sorted.map(s => s.username))
 
      const eloLookup: Record<string, number> = {}
      lbData?.forEach(u => {
        eloLookup[u.username] = getDisplayedElo(u.elo, u.history?.length ?? 0)
      })
 
      setTopAC(sorted.map(s => ({
        username: s.username,
        count: s.count,
        elo: eloLookup[s.username] ?? 0,
      })))
    }
 
    fetchRanking()
    fetchTopAC()
  }, [])

  const formatTimeLeft = (toTime: string | null) => {
    if (!toTime) return ""
    const ms = new Date(toTime).getTime() - Date.now()
    if (ms <= 0) return "0s"
    const s = Math.floor(ms / 1000)
    const m = Math.floor(s / 60)
    const h = Math.floor(m / 60)
    const d = Math.floor(h / 24)
    return `${d > 0 ? `${d}d ` : ""}${h % 24}h ${m % 60}m ${s % 60}s`
  }

  const monthLabel = new Date().toLocaleString('en-US', { month: 'long' })

  const renderContestCard = (contest: Contest, type: "upcoming" | "ongoing" | "past") => {
    const eloMin = contest.elo_min ?? 0
    const eloMax = contest.elo_max ?? 9999
    const timeLeft =
      type === "upcoming" ? formatTimeLeft(contest.time_start) :
      type === "ongoing"  ? formatTimeLeft(contest.time_end)   : ""

    const iconsInRange = eloRanks.filter(r => r.min >= eloMin && r.min <= eloMax)

    return (
      <Link
        key={contest.id}
        href={contest.link ?? "#"}
        style={{
          display: 'block',
          background: '#161827',
          border: '1px solid #1e2030',
          borderRadius: '10px',
          padding: '14px 16px',
          textDecoration: 'none',
          transition: 'border-color 0.15s, background 0.15s',
          marginBottom: '8px',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.borderColor = '#2a2d3a'
          ;(e.currentTarget as HTMLElement).style.background = '#1a1c2e'
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.borderColor = '#1e2030'
          ;(e.currentTarget as HTMLElement).style.background = '#161827'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: '500', color: '#a89cee', marginBottom: '6px' }}>
              {contest.name ?? "Unnamed Contest"}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '14px', color: '#4a4e62' }}>Rated:</span>
              {iconsInRange.map(rank => (
                <Image
                  key={rank.class}
                  src={`/assets/ranks/${rank.class}.png`}
                  alt={rank.class}
                  width={24}
                  height={24}
                />
              ))}
            </div>
          </div>
          {timeLeft && (
            <span style={{
              fontSize: '12px',
              padding: '4px 10px',
              borderRadius: '6px',
              fontWeight: '500',
              background: type === "ongoing" ? '#0e2820' : '#161827',
              color: type === "ongoing" ? '#5DCAA5' : '#8a8ea8',
              border: '1px solid ' + (type === "ongoing" ? '#1D9E75' : '#1e2030'),
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}>
              {timeLeft}
            </span>
          )}
        </div>
      </Link>
    )
  }

  // ── Gate: show a login prompt if not signed in ──────────────
  if (!email) {
    return (
      <main style={{ padding: '40px 24px', maxWidth: '480px' }}>
        <div style={{
          background: '#161827',
          border: '1px solid #1e2030',
          borderRadius: '12px',
          padding: '32px',
          textAlign: 'center',
        }}>
          <Image
            src="/assets/web-icon.png"
            alt="BQTOJ"
            width={48}
            height={48}
            style={{ borderRadius: '12px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px'}}
          />
          <h1 style={{ fontSize: '20px', fontWeight: '500', color: '#c8ccde', marginBottom: '8px' }}>
            Welcome to BQTOJ
          </h1>
          <p style={{ fontSize: '13px', color: '#6a6e88', lineHeight: 1.6, marginBottom: '24px' }}>
            BanhQuyTeam Online Judge — train, compete, and level up your competitive programming skills.
          </p>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <Link href="/login" style={{
              padding: '8px 20px', borderRadius: '7px',
              background: '#534AB7', color: '#CECBF6',
              fontSize: '13px', fontWeight: '500', textDecoration: 'none',
            }}>
              Log in
            </Link>
            <Link href="/register" style={{
              padding: '8px 20px', borderRadius: '7px',
              background: '#161827', color: '#8a8ea8',
              border: '1px solid #2a2d3a',
              fontSize: '13px', fontWeight: '500', textDecoration: 'none',
            }}>
              Register
            </Link>
          </div>
        </div>
      </main>
    )
  }

  // ── Main content (logged in only) ───────────────────────────
  return (
    <main style={{ padding: '16px 20px' }}>
      <AnimatedContent
        distance={30}
        direction="vertical"
        reverse={false}
        duration={0.6}
        ease="power3.out"
        initialOpacity={0.0}
        animateOpacity
        scale={1.0}
        threshold={0.1}
        delay={0.0}
      >
        {/* Welcome card */}
        <section style={{
          background: '#161827',
          border: '1px solid #1e2030',
          borderRadius: '12px',
          padding: '20px 24px',
          marginBottom: '24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '50%',
              background: '#1e2030', border: '1px solid #2a2d3a',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="32" height="32" viewBox="-3 -3 30 30" fill="#555">
                <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
              </svg>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Image
                  src={`/assets/ranks/${getEloClass(elo)}.png`}
                  alt={getEloClass(elo)}
                  width={20}
                  height={20}
                />
                <span style={{ fontSize: '16px', fontWeight: '500' }} className={getEloClass(elo)}>
                  {username}
                </span>
              </div>
              <div style={{ fontSize: '14px', color: '#4a4e62' }}>{email}</div>
            </div>
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <div style={{ fontSize: '14px', color: '#4a4e62', marginBottom: '2px' }}>Rating</div>
              <div style={{ fontSize: '20px', fontWeight: '500' }} className={getEloClass(elo)}>{elo}</div>
            </div>
          </div>
          <Link href="/problemset" style={{
            display: 'inline-block',
            padding: '7px 18px',
            borderRadius: '7px',
            background: '#534AB7',
            color: '#CECBF6',
            fontSize: '13px',
            fontWeight: '500',
            textDecoration: 'none',
          }}>
            Start Solving →
          </Link>
        </section>

        {/* Ongoing */}
        {ongoing.length > 0 && (
          <section style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '13px', fontWeight: '500', color: '#5DCAA5', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#5DCAA5', display: 'inline-block' }}/>
              Ongoing Contests
            </h2>
            {ongoing.map(c => renderContestCard(c, "ongoing"))}
          </section>
        )}

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <section style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '13px', fontWeight: '500', color: '#8a8ea8', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#534AB7', display: 'inline-block' }}/>
              Upcoming Contests
            </h2>
            {upcoming.map(c => renderContestCard(c, "upcoming"))}
          </section>
        )}

        {/* Past */}
        <section style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '500', color: '#8a8ea8', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2a2d3a', display: 'inline-block' }}/>
              Past Contests
            </span>
            <Link href="/contests/past/1" style={{ fontSize: '16px', color: '#534AB7', textDecoration: 'none' }}>
              View all →
            </Link>
          </h2>
          {past.map(c => renderContestCard(c, "past"))}
        </section>

        {/* Donate */}
        <section style={{
          background: '#161827',
          border: '1px solid #1e2030',
          borderRadius: '12px',
          padding: '20px 24px',
          textAlign: 'center',
        }}>
        
        {/* 4-panel row */}
        <div
          className="home-panels"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: '12px',
            alignItems: 'start',
          }}
        >
 
          {/* ── Panel 1: Support ── */}
          <Panel title="Support BQTOJ">
            <p style={{ fontSize: '11px', color: '#4a4e62', marginBottom: '10px', textAlign: 'center' }}>
              Help us keep the servers running!
            </p>
            {/* White bank-style QR card */}
            <div style={{
              background: '#ffffff',
              borderRadius: '10px',
              padding: '12px',
              textAlign: 'center',
            }}>
              {/* BIDV + VietQR logo row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#004a97', letterSpacing: '-0.5px' }}>BIDV</span>
                <span style={{ fontSize: '9px', color: '#004a97' }}>❖</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '1px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#d0021b' }}>VIET</span>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#00a651' }}>QR</span>
                  <span style={{ fontSize: '8px', color: '#00a651', marginLeft: '1px' }}>™</span>
                </span>
              </div>
              {/* QR image */}
              <Image
                src="/assets/qr/MONEY.jpg"
                alt="Donate QR"
                width={150}
                height={150}
                style={{ borderRadius: '4px', display: 'block', margin: '0 auto 10px' }}
              />
              {/* Account info */}
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#111', marginBottom: '2px' }}>
                TRAN QUANG THUAN
              </div>
              <div style={{ fontSize: '12px', fontWeight: '500', color: '#333', marginBottom: '4px' }}>
                8833202549
              </div>
              <div style={{ fontSize: '9px', color: '#666', lineHeight: 1.4 }}>
                Ngân hàng TMCP Đầu tư và Phát triển Việt Nam
              </div>
            </div>
          </Panel>
 
          {/* ── Panel 2: Top ranking ── */}
          <Panel title="Top ranking (Trusted only)">
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr auto',
              fontSize: '14px', color: '#4a4e62', padding: '0 8px 6px',
              letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>
              <span>Username</span><span>Elo</span>
            </div>
            {topRanking.length === 0
              ? <div style={{ fontSize: '12px', color: '#4a4e62', padding: '10px 8px' }}>Loading...</div>
              : topRanking.map((u, i) => (
                  <RankRow
                    key={u.username}
                    rank={i + 1}
                    username={u.username}
                    valueLabel={String(u.displayElo)}
                    eloForIcon={u.displayElo}
                  />
                ))
            }
            <Link href="/leaderboard" style={{
              fontSize: '11px', color: '#534AB7', textDecoration: 'none',
              padding: '8px 8px 0', display: 'block', marginTop: '4px',
            }}>
              Full leaderboard →
            </Link>
          </Panel>
 
          {/* ── Panel 3: Top AC this month ── */}
          <Panel title={`Top AC (${monthLabel})`}>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr auto',
              fontSize: '14px', color: '#4a4e62', padding: '0 8px 6px',
              letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>
              <span>Username</span><span>Solved</span>
            </div>
            {topAC.length === 0
              ? <div style={{ fontSize: '12px', color: '#4a4e62', padding: '10px 8px' }}>Loading...</div>
              : topAC.map((u, i) => (
                  <RankRow
                    key={u.username}
                    rank={i + 1}
                    username={u.username}
                    valueLabel={String(u.count)}
                    eloForIcon={u.elo}
                  />
                ))
            }
          </Panel>
 
          {/* ── Panel 4: Active (placeholder) ── 
          <Panel title="Active">
            <div style={{
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              padding: '28px 0', gap: '8px',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2a2d3a" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 8v4l3 3"/>
              </svg>
              <div style={{ fontSize: '12px', fontWeight: '500', color: '#4a4e62' }}>Coming soon...</div>
              <div style={{ fontSize: '11px', color: '#2a2d3a', textAlign: 'center', lineHeight: 1.5 }}>
                Live active users will appear here
              </div>
            </div>
          </Panel>*/}

        </div>
        </section>
      </AnimatedContent>
    </main>
  )
}