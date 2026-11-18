'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import { useAuth } from '@/context/AuthContext'
import { getDisplayedElo } from '@/utils/eloAccumulation'
import { getEloClass } from '@/utils/eloDisplay'
import Link from 'next/link'

interface ContestInfo {
  id: number
  name: string | null
  time_end: string | null
  elo_min: number | null
  elo_max: number | null
  link: string | null
}

export default function ContestBanner() {
  const { username, currentContestId } = useAuth()
  const [contest, setContest] = useState<ContestInfo | null>(null)
  const [ratedRank, setRatedRank] = useState<number | null>(null)
  const [totalRated, setTotalRated] = useState<number>(0)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!currentContestId || currentContestId === 0) {
      setContest(null)
      return
    }
    const fetchContest = async () => {
      const { data } = await supabase
        .from('contests')
        .select('id, name, time_end, elo_min, elo_max, link')
        .eq('id', currentContestId)
        .single()
      if (data) setContest(data)
    }
    fetchContest()
  }, [currentContestId])

  useEffect(() => {
    if (!contest || !username) return
    const fetchRank = async () => {
      const { data: standingData } = await supabase
        .from('contest_standing')
        .select('user_id, score, penalty')
        .eq('contest_id', contest.id)

      if (!standingData) return

      const userIds = standingData.map(s => s.user_id)
      const { data: leaderboard } = await supabase
        .from('leaderboard')
        .select('username, elo, history')
        .in('username', userIds)

      const eloMap: Record<string, number> = {}
      const contestCountMap: Record<string, number> = {}
      leaderboard?.forEach(u => {
        eloMap[u.username] = u.elo ?? 1500
        contestCountMap[u.username] = u.history?.length ?? 0
      })

      const rated = standingData
        .map(s => {
          const elo = eloMap[s.user_id] ?? 1500
          const contestCount = contestCountMap[s.user_id] ?? 0
          const disp = getDisplayedElo(elo, contestCount)
          const isRated = disp >= (contest.elo_min ?? 0) && disp <= (contest.elo_max ?? 4000)
          return { ...s, isRated }
        })
        .filter(s => s.isRated)
        .sort((a, b) => b.score - a.score || a.penalty - b.penalty)

      const myRank = rated.findIndex(s => s.user_id === username) + 1
      setRatedRank(myRank > 0 ? myRank : null)
      setTotalRated(rated.length)
    }
    fetchRank()
  }, [contest, username])

  if (!currentContestId || currentContestId === 0 || !contest) return null

  const formatTimeLeft = (toTime: string | null) => {
    if (!toTime) return ''
    const ms = new Date(toTime).getTime() - Date.now()
    if (ms <= 0) return 'Ended'
    const s = Math.floor(ms / 1000)
    const m = Math.floor(s / 60)
    const h = Math.floor(m / 60)
    const d = Math.floor(h / 24)
    return `${d > 0 ? `${d}d ` : ''}${h % 24}h ${m % 60}m ${s % 60}s`
  }

  const timeLeft = formatTimeLeft(contest.time_end)
  const ended = contest.time_end ? new Date(contest.time_end).getTime() <= Date.now() : false

  return (
    <div
      style={{
        backgroundColor: '#222b21',
        borderBottom: '1px solid #444',
        borderTop: '1px solid #333',
      }}
      className="px-4 py-5 flex items-center gap-4 text-sm flex-wrap"
    >
      {/* Pulse indicator */}
      <span className="relative flex h-2 w-2">
        {!ended && (
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
            style={{ backgroundColor: '#22c55e' }}
          />
        )}
        <span
          className="relative inline-flex rounded-full h-2 w-2"
          style={{ backgroundColor: ended ? '#ef4444' : '#22c55e' }}
        />
      </span>

      {/* Contest name */}
      <Link
        href={contest.link ?? `/contest-standing/${contest.id}`}
        className="font-semibold text-blue-300 hover:underline"
        prefetch={false}
      >
        {contest.name ?? 'Contest'}
      </Link>

      {/* Separator */}
      <span className="text-neutral-600">|</span>

      {/* Time remaining */}
      <span className={ended ? 'text-red-400' : 'text-green-400'}>
        {ended ? 'Ended' : `⏱ ${timeLeft}`}
      </span>

      {/* Separator */}
      <span className="text-neutral-600">|</span>

      {/* Rated standing */}
      {ratedRank !== null ? (
        <span className="text-neutral-300">
          Rated rank:{' '}
          <strong className="text-white">#{ratedRank}</strong>
          <span className="text-neutral-500"> / {totalRated}</span>
        </span>
      ) : (
        <span className="text-neutral-500 italic">Unranked</span>
      )}

      {/* View standing link */}
      <Link
        href={`/contest-standing/${contest.id}`}
        className="ml-auto text-xs text-neutral-400 hover:text-white hover:underline"
        prefetch={false}
      >
        View standing →
      </Link>

      {/* Force re-render each second for countdown */}
      {tick > 0 && null}
    </div>
  )
}
