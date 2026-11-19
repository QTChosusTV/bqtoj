'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Check, Search } from 'lucide-react'

import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/utils/supabaseClient'
import { getDisplayedElo } from '@/utils/eloAccumulation'
import { getEloClass, getEloColor, ELO_TIERS } from '@/utils/eloDisplay'
import UserAvatar from '@/components/UserAvatar'
import './leaderboard.css'

type HistoryEntry = {
  contest?: string
  name?: string
  elo: number
}

interface LeaderboardUser {
  rank: number
  username: string
  elo: number
  rawElo: number
  history: HistoryEntry[]
  cnt: number
  avatarUrl: string
}

function adjustColor(hex: string, amount: number): string {
  if (!hex.startsWith('#') || hex.length !== 7) return hex

  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / d + 2) / 6
        break
      case b:
        h = ((r - g) / d + 4) / 6
        break
    }
  }

  const newL = Math.min(0.95, Math.max(0.05, l + amount / 100))

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }

  const q = newL < 0.5 ? newL * (1 + s) : newL + s - newL * s
  const p = 2 * newL - q

  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0')
  return `#${toHex(hue2rgb(p, q, h + 1 / 3))}${toHex(hue2rgb(p, q, h))}${toHex(hue2rgb(p, q, h - 1 / 3))}`
}

function CalibrationIndicator({ count }: { count: number }) {
  if (count >= 5) {
    return (
      <span
        title="Rating calibrated (5+ contests completed)"
        className="inline-flex items-center gap-1.5 text-zinc-200 tabular-nums"
      >
        <strong className="font-semibold">{count}</strong>
        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
      </span>
    )
  }

  return (
    <span
      title={`Probationary rating: complete ${5 - count} more contest${5 - count === 1 ? '' : 's'} for full rating`}
      className="inline-flex items-center gap-2 text-zinc-300 tabular-nums"
    >
      <strong className="font-semibold">{count}</strong>
      <span className="inline-flex items-center gap-0.5" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((slot) => (
          <span
            key={slot}
            className={`w-1.5 h-3 rounded-[2px] ${
              slot < count ? 'bg-amber-400' : 'bg-zinc-800'
            }`}
          />
        ))}
      </span>
    </span>
  )
}

export default function LeaderboardPage() {
  const { username: currentUsername } = useAuth()
  const [users, setUsers] = useState<LeaderboardUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterMode, setFilterMode] = useState<'all' | 'calibrated'>('all')

  useEffect(() => {
    let active = true

    async function fetchData() {
      setLoading(true)
      const [lbRes, usersRes] = await Promise.all([
        supabase.from('leaderboard').select('username, elo, history'),
        supabase.from('public_users').select('username, avatar_url'),
      ])

      if (!active) return

      if (lbRes.error) {
        console.error('Supabase fetch error:', lbRes.error.message)
        setLoading(false)
        return
      }

      const avatarMap = new Map<string, string>()
      usersRes.data?.forEach((u) => {
        if (u.username && u.avatar_url) {
          avatarMap.set(u.username, u.avatar_url)
        }
      })

      const sorted = (lbRes.data ?? [])
        .map((u) => {
          const history = (u.history ?? []) as HistoryEntry[]
          const cnt = history.length
          const displayedElo = getDisplayedElo(u.elo, cnt)

          return {
            username: u.username,
            rawElo: u.elo,
            elo: displayedElo,
            history,
            cnt,
            avatarUrl: avatarMap.get(u.username) ?? '',
          }
        })
        .sort((a, b) => b.elo - a.elo || b.cnt - a.cnt)
        .map((u, idx) => ({ ...u, rank: idx + 1 }))

      setUsers(sorted)
      setLoading(false)
    }

    fetchData()
    return () => {
      active = false
    }
  }, [])

  const eloDistribution = useMemo(() => {
    const sortedTiers = ELO_TIERS.slice().sort((a, b) => a.min - b.min)
    const bins = sortedTiers.flatMap((tier, i) => {
      const min = tier.min
      const max = (sortedTiers[i + 1]?.min ?? 4000) - 1
      const mid = Math.floor((min + max) / 2)

      return [
        { min, max: mid, label: `${min}–${mid}`, color: adjustColor(tier.color, 0) },
        { min: mid + 1, max, label: `${mid + 1}–${max}`, color: adjustColor(tier.color, 5) },
      ]
    })

    return bins.map((bin) => ({
      range: bin.label,
      minElo: bin.min,
      count: users.filter((u) => u.elo >= bin.min && u.elo <= bin.max).length,
      color: bin.color,
    }))
  }, [users])

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter((u) => {
      if (filterMode === 'calibrated' && u.cnt < 5) return false
      if (q && !u.username.toLowerCase().includes(q)) return false
      return true
    })
  }, [users, search, filterMode])

  const topThree = users.slice(0, 3)
  const myEntry = useMemo(
    () => (currentUsername ? users.find((u) => u.username === currentUsername) ?? null : null),
    [users, currentUsername]
  )

  return (
    <main className="max-w-7xl mx-auto px-5 py-6 text-zinc-100 space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50">
            Leaderboard
          </h1>
          <p className="mt-1 text-sm text-zinc-400 tabular-nums">
            {users.length} ranked {users.length === 1 ? 'competitor' : 'competitors'} · 5 contests required for full rating calibration
          </p>
        </div>

        {/* Search & Filter Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search handle..."
              aria-label="Search handle"
              className="w-52 pl-9 pr-3 py-1.5 text-sm rounded-md bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500"
            />
          </div>

          <div className="inline-flex rounded-md border border-zinc-800 overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 transition-colors duration-150 motion-reduce:transition-none cursor-pointer ${
                filterMode === 'all'
                  ? 'bg-zinc-800 text-zinc-100 font-medium'
                  : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('calibrated')}
              className={`px-3 py-1.5 border-l border-zinc-800 transition-colors duration-150 motion-reduce:transition-none cursor-pointer ${
                filterMode === 'calibrated'
                  ? 'bg-zinc-800 text-zinc-100 font-medium'
                  : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Calibrated (5+)
            </button>
          </div>
        </div>
      </header>

      {/* Top 70% / 30% Band: Distribution Chart + Top 3 / Your Standing */}
      <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] gap-5 items-stretch">
        {/* Left 70%: Elo Distribution */}
        <div className="bg-[#111111] border border-zinc-800 rounded-lg p-5 flex flex-col">
          <div className="flex items-baseline justify-between gap-2 mb-3">
            <h2 className="text-base font-semibold text-zinc-100">Rating Distribution</h2>
            <span className="text-xs text-zinc-400">Split by lower / upper tier halves</span>
          </div>

          <div className="w-full h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={eloDistribution} margin={{ top: 8, right: 12, left: -18, bottom: 10 }}>
                <XAxis
                  dataKey="range"
                  interval={1}
                  angle={-45}
                  textAnchor="end"
                  height={56}
                  tick={{ fontSize: 11, fill: '#a1a1aa' }}
                  axisLine={{ stroke: '#27272a' }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#a1a1aa' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload
                      return (
                        <div className="bg-zinc-950 border border-zinc-700 rounded-md px-2.5 py-1.5 text-xs flex items-center gap-2 shadow-sm">
                          <Image
                            src={`/assets/ranks/${getEloClass(data.minElo)}.png`}
                            alt=""
                            width={16}
                            height={16}
                            style={{ imageRendering: 'pixelated' }}
                          />
                          <span style={{ color: adjustColor(data.color, 15) }} className="font-medium tabular-nums">
                            {data.range}: {data.count} user{data.count !== 1 ? 's' : ''}
                          </span>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Bar
                  dataKey="count"
                  shape={(props: { x?: number; y?: number; width?: number; height?: number; index?: number }) => {
                    const { x = 0, y = 0, width = 0, height = 0, index = 0 } = props
                    if (height <= 0 || width <= 0) return <g />
                    const isUpper = index % 2 === 1
                    const barWidth = isUpper ? width : width * 0.65
                    const xOffset = (width - barWidth) / 2
                    return (
                      <rect
                        x={x + xOffset}
                        y={y}
                        width={barWidth}
                        height={height}
                        rx={2}
                        fill={eloDistribution[index]?.color}
                      />
                    )
                  }}
                >
                  {eloDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right 30%: Top 3 & Your Standing */}
        <aside className="bg-[#111111] border border-zinc-800 rounded-lg p-5 flex flex-col justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-100 mb-3">Top Ranked</h2>

            {loading ? (
              <p className="text-sm text-zinc-400">Loading rankings...</p>
            ) : topThree.length === 0 ? (
              <p className="text-sm text-zinc-400">No ranked users yet.</p>
            ) : (
              <div className="space-y-2.5">
                {topThree.map((u) => {
                  const eloClass = getEloClass(u.elo)
                  const rankAccent =
                    u.rank === 1
                      ? 'text-yellow-400'
                      : u.rank === 2
                      ? 'text-zinc-200'
                      : 'text-amber-500'

                  return (
                    <Link
                      key={u.username}
                      href={`/user/${encodeURIComponent(u.username)}`}
                      prefetch={false}
                      className="flex items-center justify-between gap-3 p-2.5 rounded-md bg-zinc-950 border border-zinc-800 hover:border-zinc-700 transition-colors duration-150 motion-reduce:transition-none"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`w-6 text-sm font-bold tabular-nums shrink-0 ${rankAccent}`}>
                          #{u.rank}
                        </span>
                        <UserAvatar username={u.username} avatarUrl={u.avatarUrl} size={32} />
                        <div className="min-w-0">
                          <div className={`text-sm font-semibold truncate ${eloClass}`}>
                            {u.username}
                          </div>
                          <div className="text-xs text-zinc-400 tabular-nums">
                            {u.cnt} contest{u.cnt === 1 ? '' : 's'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Image
                          src={`/assets/ranks/${eloClass}.png`}
                          alt={eloClass}
                          width={18}
                          height={18}
                        />
                        <span
                          className="text-sm font-bold tabular-nums"
                          style={{ color: getEloColor(u.elo) }}
                        >
                          {u.elo}
                        </span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          {myEntry && (
            <div className="pt-3 border-t border-zinc-800">
              <div className="text-xs text-zinc-400 mb-1.5">Your Standing</div>
              <Link
                href={`/user/${encodeURIComponent(myEntry.username)}`}
                prefetch={false}
                className="flex items-center justify-between gap-2 text-sm hover:underline"
              >
                <span className="font-semibold text-zinc-100 tabular-nums">
                  #{myEntry.rank}{' '}
                  <span className={getEloClass(myEntry.elo)}>{myEntry.username}</span>
                </span>
                <span
                  className="font-bold tabular-nums"
                  style={{ color: getEloColor(myEntry.elo) }}
                >
                  {myEntry.elo}
                </span>
              </Link>
            </div>
          )}
        </aside>
      </section>

      {/* Main Standings Table */}
      <section className="bg-[#111111] border border-zinc-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table id="leaderboard" className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/70 text-xs uppercase tracking-wider text-zinc-400">
                <th className="py-3 px-4 font-medium w-20 text-center">Rank</th>
                <th className="py-3 px-4 font-medium">Competitor</th>
                <th className="py-3 px-4 font-medium w-40 text-center">Contests</th>
                <th className="py-3 px-5 font-medium w-28 text-right">Elo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80">
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-zinc-400">
                    Loading leaderboard...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-zinc-400">
                    No matching competitors found.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user, idx) => {
                  const eloClass = getEloClass(user.elo)
                  const top100Class = user.rank <= 100 ? 'elo-top-100' : ''
                  const isMe = currentUsername === user.username
                  const rankTone =
                    user.rank === 1
                      ? 'text-yellow-400 font-bold'
                      : user.rank === 2
                      ? 'text-zinc-200 font-bold'
                      : user.rank === 3
                      ? 'text-amber-500 font-bold'
                      : 'text-zinc-400'

                  return (
                    <tr
                      key={user.username}
                      style={{ animationDelay: `${Math.min(idx, 15) * 40}ms` }}
                      className={`lb-row-enter transition-colors duration-150 motion-reduce:transition-none ${
                        isMe ? 'bg-zinc-900/80' : 'hover:bg-zinc-900/50'
                      }`}
                    >
                      <td className={`py-2.5 px-4 text-center tabular-nums ${rankTone}`}>
                        #{user.rank}
                      </td>

                      <td className="py-2.5 px-4">
                        <Link
                          href={`/user/${encodeURIComponent(user.username)}`}
                          prefetch={false}
                          className="inline-flex items-center gap-3 group"
                        >
                          <UserAvatar
                            username={user.username}
                            avatarUrl={user.avatarUrl}
                            size={34}
                          />
                          <Image
                            src={`/assets/ranks/${eloClass}.png`}
                            alt={eloClass}
                            width={22}
                            height={22}
                            className="shrink-0"
                          />
                          <strong
                            className={`text-[15px] font-semibold group-hover:underline ${eloClass} ${top100Class}`}
                          >
                            {user.username}
                          </strong>
                          {isMe && (
                            <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300">
                              You
                            </span>
                          )}
                        </Link>
                      </td>

                      <td className="py-2.5 px-4 text-center">
                        <CalibrationIndicator count={user.cnt} />
                      </td>

                      <td
                        className={`py-2.5 px-5 text-right font-bold tabular-nums text-[15px] ${eloClass}`}
                      >
                        {user.elo}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}