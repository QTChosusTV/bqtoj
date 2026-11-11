// ContestStandingPage.tsx

'use client'
export const dynamic = 'force-dynamic'

import { usePathname } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import './cstd.css'
import styles from './cstd.module.css'
import Link from 'next/link'
import Image from 'next/image'
import AnimatedContent from '@/components/reactbits/AnimatedContent/AnimatedContent'
import { getEloClass, getEloColor, getEloIcon } from "@/utils/eloDisplay"
import { getDisplayedElo } from '@/utils/eloAccumulation'

interface Standing {
  id: string
  user_id: string
  contest_id: string
  score: number
  penalty: number
  problems: Record<string, any>
  pi: number
  delta: number
  contest_count: number
  new_display_elo: number
  old_display_elo: number
  isRated: boolean,
  rank: number
}

interface Contest {
  id: number
  name: string | null
  time_start: string | null
  time_end: string | null
  elo_min: number | null
  elo_max: number | null
  link: string | null
  problems: { pid: number; pname: string; score: number }[]
  descriptions: string
  format: string
}

function formatPenalty(seconds: number): string {
  if (!seconds || seconds <= 0) return '00:00:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return [h, m, s].map((v) => v.toString().padStart(2, '0')).join(':')
}


export default function ContestStandingPage() {
  const searchParams = useSearchParams()
  const contestId = Number(searchParams.get('id'))
  const [standings, setStandings] = useState<Standing[]>([])
  const [problems, setProblems] = useState<{ pid: string; pname: string; score: number }[]>([])
  const [eloMap, setEloMap] = useState<Record<string, number>>({})
  const { username } = useAuth()
  const [tick, setTick] = useState(0)
  const [currUser, setCurrUser] = useState<any>(null);
  const [contest, setContest] = useState<Contest | null>(null);
  const [ratedOnly, setRatedOnly] = useState(false); // toggle filter
  const debuggg = useState(false);
  const pathname = usePathname()
  
  useEffect(() => {
    if (!contestId) return;
    const fetchContest = async () => {
      const { data } = await supabase
        .from('contests')
        .select('id, name, time_start, time_end, elo_min, elo_max, link, problems, descriptions, format')
        .eq('id', contestId)
        .single();
      if (data) setContest(data);
    };
    fetchContest();
  }, [contestId]);
  
  
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
  
      const { data: userData } = await supabase
        .from('users')
        .select('id, username, current_contest_id')
        .eq('id', user.id)
        .single();
  
      if (!userData) return;
  
      setCurrUser(userData);
    };
    fetchUser();
  }, []);
  
  useEffect(() => {
    const interval = setInterval(() => setTick(prev => prev + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!contestId || !contest) return
    const fetchStanding = async () => {
      const { data: leaderboard } = await supabase
        .from('leaderboard')
        .select('username, elo, history')

      const eloObj: Record<string, number> = {}

      leaderboard?.forEach((entry) => {
        eloObj[entry.username] = entry.elo && entry.elo !== 0 ? entry.elo : 1500
      })

      setEloMap(eloObj)

      const { data: contestData } = await supabase
        .from('contests')
        .select('problems')
        .eq('id', contestId)
        .single()

      const { data: standingData } = await supabase
        .from('contest_standing')
        .select('*')
        .eq('contest_id', contestId)


      const sorted = (standingData ?? []).sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        return a.penalty - b.penalty
      })


      const participants = (standingData ?? []).map((s, idx) => ({
        user_id: s.user_id,
        elo: eloObj[s.user_id] || 0,  // fallback if missing
        rank: idx + 1,
        score: s.score,
        penalty: s.penalty
      }));

      const K = 100;
      const SCORE_BONUS_FACTOR = 12.5 * (6.0 - 2.0); // since DIV = 2.0f
      const MAX_RATING_CHANGE = 500.0;
      const MAX_SCORE = (contestData?.problems ?? []).length;

      const enriched = (standingData ?? []).map((s) => {
      const elo = eloObj[s.user_id] ?? 1500;
      const contestCount = (leaderboard?.find(u => u.username === s.user_id)?.history?.length) ?? 0;
      const oldEloDisplay = getDisplayedElo(elo, contestCount);
      const isRated = contest ? oldEloDisplay >= (contest.elo_min ?? 0) && oldEloDisplay <= (contest.elo_max ?? 4000) : true;

      if (!isRated) {
        return { ...s, pi: 0, delta: 0, contest_count: contestCount, new_display_elo: oldEloDisplay, old_display_elo: oldEloDisplay, isRated };
      }

      const ratedParticipants = (standingData ?? [])
        .map((p) => ({
          user_id: p.user_id,
          elo: eloObj[p.user_id] ?? 1500,
          score: p.score,
          penalty: p.penalty,
        }))
        .filter(p => {
          const disp = getDisplayedElo(p.elo, (leaderboard?.find(u => u.username === p.user_id)?.history?.length) ?? 0);
          return contest ? disp >= (contest.elo_min ?? 0) && disp <= (contest.elo_max ?? 4000) : true;
        })
        .sort((a, b) => b.score - a.score || a.penalty - b.penalty);

        // console.log("=== Rated Participants ===");
          ratedParticipants.forEach((p, idx) => {
            const disp = getDisplayedElo(
              p.elo,
              (leaderboard?.find(u => u.username === p.user_id)?.history?.length) ?? 0
            );
            // console.log(idx + 1, p.user_id, "elo:", p.elo, "disp:", disp, "score:", p.score);
          });

      const rank = ratedParticipants.findIndex(rp => rp.user_id === s.user_id) + 1;
      const performance = computePerformance({ user_id: s.user_id, elo, rank }, ratedParticipants);

      

      // polynomial factor f(o)
      let f = 0.5375590444025147 
       - 1.609673516547565e-4 * elo 
       + 6.436497743378832e-9 * elo * elo;
      if (ratedParticipants.length > 1) f *= Math.log10(Math.sqrt(ratedParticipants.length));

      const newElo = Math.round(Math.max(0, Math.min(4000, elo + (performance - elo) * f)));
      const newEloDisplay = getDisplayedElo(newElo, contestCount + 1);
      const delta = Math.round(newEloDisplay - oldEloDisplay);

      return {
        ...s,
        pi: performance,
        delta,
        contest_count: contestCount,
        new_display_elo: newEloDisplay,
        old_display_elo: oldEloDisplay,
        isRated,
        rank
      };
      
    });
    setStandings(enriched.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.penalty - b.penalty;
    }));
    const startMs = contest?.time_start ? new Date(contest.time_start).getTime() : 0
    setProblems(Date.now() >= startMs ? (contestData?.problems || []) : [])
  }
  fetchStanding()
}, [contestId, contest])

  const now = Date.now()
  const timeStart = contest?.time_start ? new Date(contest.time_start).getTime() : 0
  const timeEnd = contest?.time_end ? new Date(contest.time_end).getTime() : 0

  const formatTimeLeft = (toTime: string | null) => {
    if (!toTime) return ''
    const ms = new Date(toTime).getTime() - Date.now()
    if (ms <= 0) return '0s'
    const s = Math.floor(ms / 1000)
    const m = Math.floor(s / 60)
    const h = Math.floor(m / 60)
    const d = Math.floor(h / 24)
    return `${d > 0 ? `${d}d ` : ''}${h % 24}h ${m % 60}m ${s % 60}s`
  }

  function getSolveTimeGradient(timeStr: string, contestStart: string | null, contestEnd: string | null): string {
    if (!timeStr || !contestStart || !contestEnd) return "gray"

    const start = new Date(contestStart).getTime()
    const end = new Date(contestEnd).getTime()
    const solve = new Date(timeStr).getTime()

    if (end <= start) return "gray"

    // ratio: 0 = start, 1 = end
    const ratio = Math.min(1, Math.max(0, (solve - start) / (end - start)))

    // Hue 120 (green) → 0 (red)
    const hue = 120 - ratio * 120

    return `hsl(${hue}, 100%, 50%)`
  }

  function getScoreGradient(userScore: number, fullScore: number): string {
    if (fullScore <= 0) return "gray";
    const a = Math.min(1, Math.max(0, userScore / fullScore));
    const r = Math.min(Math.round(500 * (1 - a)), 255);
    const g = Math.min(Math.round(500 * (a)), 255);
    return `rgb(${r}, ${g}, 0)`;
  }

  const countdownText = () => {
    if (!contest) return ''
    const now = Date.now()
    const start = contest.time_start ? new Date(contest.time_start).getTime() : 0
    const end = contest.time_end ? new Date(contest.time_end).getTime() : 0
    if (now < start) return `Starts in: ${formatTimeLeft(contest.time_start)}`
    else if (now >= start && now <= end) return `Ends in: ${formatTimeLeft(contest.time_end)}`
    else return 'Contest ended'
  }

  function expectedProbability(ratingA: number, ratingB: number): number {
    return 1.0 / (1.0 + Math.pow(10.0, (ratingB - ratingA) / 400.0));
  }

  function computeSeed(R: number, me: { user_id: string; elo: number }, participants: { user_id: string; elo: number }[]): number {
    let seed = 1.0;
    for (const other of participants) {
      if (other.user_id !== me.user_id) {
        seed += 1.0 / (1.0 + Math.pow(10.0, (other.elo - R) / 400.0));
      }
    }
    return seed;
  }

  function computePerformance(
    me: { user_id: string; elo: number; rank: number },
    participants: { user_id: string; elo: number }[]
  ): number {
    const actualSeed = participants.length + 1 - me.rank;
    const target = actualSeed;

    let lo = 0.0, hi = 4000.0;
    const seedLo = computeSeed(lo, me, participants);
    const seedHi = computeSeed(hi, me, participants);

    if (target >= seedHi) return hi;
    if (target <= seedLo) return lo;

    for (let it = 0; it < 40; ++it) {
      const mid = (lo + hi) / 2.0;
      const seed = computeSeed(mid, me, participants);
      if (seed > target) hi = mid;
      else lo = mid;
    }
    return (lo + hi) / 2.0;
  }

  function formatSolveTime(timeStr: string, contestStart: string | null): string {
    if (!timeStr || !contestStart) return ""
    const solveTime = new Date(timeStr).getTime()
    const startTime = new Date(contestStart).getTime()
    const diffSeconds = Math.floor((solveTime - startTime) / 1000)
    return formatPenalty(diffSeconds)  // you already have formatPenalty
  }

  return (
    <main className="min-h-screen flex">
      <aside className="w-40 p-4 flex flex-col" style={{ backgroundColor: '#2e2e2e' }}>
        <h2 className="text-lg font-bold mb-4">Contest</h2>
        <Link
          href={`/contest?id=${contestId}`}
          className={styles.cpButton + (pathname === '/contest' ? ' ' + styles.cpButtonActive : '')}
          prefetch={false}
        >
          Info
        </Link>
        {currUser?.current_contest_id !== 0 && (timeStart <= now) && (now <= timeEnd) && (
          <Link
            href="/contest-problemset"
            className={styles.cpButton + (pathname === '/contest-problemset' ? ' ' + styles.cpButtonActive : '')}
            prefetch={false}
          >
            Problems
          </Link>
        )}
        {contest && (
          <Link
            href={`/contest-standing?id=${contest.id}`}
            className={styles.cpButton + (pathname === '/contest-standing' ? ' ' + styles.cpButtonActive : '')}
            prefetch={false}
          >
            Standing
          </Link>
        )}
      </aside>

      {/* Main content */}
      <div className="flex-1 p-6">

        <AnimatedContent
          distance={50}
          direction="vertical"
          duration={0.8}
          ease="power3.out"
          initialOpacity={0.0}
          animateOpacity
        >
          
          <p className="text-yellow-400 mb-4 font-semibold">{countdownText()}</p>
          <div className="flex gap-2 mb-4">
            <button
              className={`px-3 py-1 rounded ${!ratedOnly ? 'bg-yellow-400 text-black' : 'bg-gray-700 text-white'}`}
              onClick={() => setRatedOnly(false)}
            >
              All
            </button>
            <button
              className={`px-3 py-1 rounded ${ratedOnly ? 'bg-yellow-400 text-black' : 'bg-gray-700 text-white'}`}
              onClick={() => setRatedOnly(true)}
            >
              Rated only
            </button>
          </div>
          <table className="w-full border-collapse text-xs table-auto text-center align-middle" style={{ backgroundColor: '#2a2a2a' }}>
            <thead className="bg-gray-700 text-white">
              <tr className={styles.cspTable}>
                <th className={"px-4 py-2 text-center border"}>Rank</th>
                <th className={"px-4 py-2 text-center border"}>User</th>
                {problems.map((p, idx) => (
                  <th key={idx} className="px-4 py-2 text-center border">
                    <div className="flex flex-col">
                      <Link href={`/problems?id=${p.pid}`} className="hover:underline text-xl">{p.pname}</Link>
                      {p.score !== undefined && (
                        <span className="text-[10px] text-yellow-300 italic">
                          ({p.score})
                        </span>
                      )}
                    </div>
                  </th>
                ))}

                <th className="px-4 py-2 text-center border">Score</th>
                <th className="px-4 py-2 text-center border">Penalty</th>
                  {(now <= timeEnd) && (
                    <>
                      <th className="px-4 py-2 text-center border">Π</th>
                      <th className="px-4 py-2 text-center border">Δ</th>
                      <th className="px-4 py-2 text-center border">⮭</th>
                    </>
                  )} 
                
              </tr>
            </thead>
            <tbody>
              {standings.map((s, index) => {
                if (ratedOnly && !s.isRated) return null;
                return (
                  <tr
                    key={s.id}
                    className={styles.cspTable + " " + (s.user_id === username
                      ? 'bg-green-800 font-bold'
                      : 'bg-black-900')} 
                  >
                    {(
                    <>
                      <td className="px-4 py-2 text-center border">
                        {s.isRated ? (
                          <span>
                            {s.rank}
                            <span className="text-white/30 text-[11px] ml-1">({index + 1})</span>
                          </span>
                        ) : (
                          <span className="text-white/30">*{index + 1}</span>
                        )}
                      </td>
                      <td
                        className={`px-4 py-2 text-center border font-bold ${getEloClass(
                          getDisplayedElo(eloMap[s.user_id] ?? 1500, s.contest_count ?? 0)
                        )}`}
                      >
                        <Link
                          href={`/user?username=${encodeURIComponent(s.user_id)}`}
                          className="no-underline hover:underline text-center flex items-center"
                          prefetch={false}
                        >
                          {s.isRated ? '' : '* '} 
                          {<Image
                            src={getEloIcon(getDisplayedElo(eloMap[s.user_id] ?? 1500, s.contest_count ?? 0))}
                            alt={getEloClass(getDisplayedElo(eloMap[s.user_id] ?? 1500, s.contest_count ?? 0))}  
                            width='30'
                            height='30'
                            className='mr-1 filter saturate-150'
                          />}
                          <div className="drop-shadow-[0_5px_15px_rgba(0,0,0,0.5)] filter saturate-150">{s.user_id}</div>
                        </Link>
                      </td>
                    </>
                    )}
                    {problems.map((p, idx) => {
                      const info = s.problems?.[p.pid]
                      const isFullScore = info?.score !== undefined && info.score === (p.score ?? 100)
                      const colScore = p.score / (isFullScore ? 1 : 1.4)

                      let color = "white"

                      if (info?.score !== undefined) {
                        color = getScoreGradient(info.score, (p.score ?? 100) * 0.75)
                      } else if (info?.verdict === 'AC') {
                        color = "green"
                      } else if (info?.tries > 0) {
                        color = "red"
                      }

                      return (
                        <td
                          key={idx}
                          style={{ color }}
                          className="px-4 py-2 text-center border"
                        >
                          {info?.tries > 0 ? (
                            <div className="flex flex-col items-center">
                              <span className={isFullScore ? "font-bold italic" : "font-medium text-sm italic"}>
                                {(() => {
                                  if (info?.verdict === "AC")
                                    return "+" + ((info?.tries ?? 1) > 1 ? info.tries - 1 : "")
                                  if (info?.score !== undefined && info.score > 0)
                                    return "" + Math.round(info.score)
                                  if (info?.tries)
                                    return "-" + info.tries
                                  return ""
                                })()}
                              </span>
                              {(info?.verdict === 'AC' || (info?.score !== undefined && info.score > 0)) && (
                                <span
                                  className="text-xs"
                                  style={{ color: getSolveTimeGradient(info.time, contest?.time_start ?? null, contest?.time_end ?? null) }}
                                >
                                  <strong>{formatSolveTime(info.time, contest?.time_start ?? null)}</strong>
                                </span>
                              )}
                            </div>
                          ) : ''}
                        </td>
                      )
                    })}
                    <td className="px-4 py-2 text-center border text-white">
                      <strong>{s.score}</strong>
                    </td>
                    <td className="px-1 py-2 text-center border text-yellow-400">
                      {formatPenalty(s.penalty)}
                    </td>
                    {(now <= timeEnd) && (
                      <>
                        <td className={"px-1 py-1 text-center border text-blue-400 " + getEloClass(s.pi)} style={{fontFamily: "Oswald"}}>
                          {(!s.isRated) ? '' : (Math.round(s.pi ?? 0) >= 4000 ? '∞' : Math.round(s.pi ?? 0))}
                        </td>
                        <td style={{fontFamily: "Oswald"}} className={`px-4 py-2 text-center border ${s.delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {(!s.isRated) ? '' : (s.delta > 0 ? '+' : '') + (s.delta ?? 0)}
                        </td>
                        <td className={`px-2 py-1 text-center border`}>
                          <span style={{ fontFamily: "Oswald" }} className={getEloClass(s.old_display_elo)}>
                            {(!s.isRated) ? '' : (s.old_display_elo)}
                          </span>
                          {!s.isRated ? '' : " → "}
                          <span style={{ fontFamily: "Oswald" }} className={getEloClass(s.new_display_elo)}>
                            {(!s.isRated) ? '' : (s.new_display_elo)}
                          </span>
                        </td>
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </AnimatedContent>
      </div>
    </main>
  )
}