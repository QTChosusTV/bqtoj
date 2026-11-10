// submissions/SubmissionsContent.tsx

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/utils/supabaseClient'
import styles from "./submissions.module.css"
import Image from 'next/image'
import { getDisplayedElo } from "@/utils/eloAccumulation"
import { getEloClass, getEloColor } from "@/utils/eloDisplay"
import { useAuth } from '@/context/AuthContext'

interface Problem {
  id: number
  title: string
  difficulty: number
  tags: { tagName: string }[]
  statement: string
  constrains: string
  examples: string
  created_at: string
  explaination: string
  time_out: number
}

type Submission = {
  id: number
  username: string
  problem_id: number
  title?: string | null
  language: string
  overall: string
  created_at: string
  elo?: number | null
  problem_elo?: number | null
  time?: number | null
  memory_kb?: number | null
}

function VerdictBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    'Accepted':           'bg-green-950 text-green-400 border-green-800',
    'Wrong Answer':       'bg-red-950 text-red-400 border-red-800',
    'Time Limit Exceeded':'bg-gray-900 text-gray-400 border-gray-700',
  }
  const cls = styles[status] ?? 'bg-yellow-950 text-yellow-400 border-yellow-800'
  return (
    <span className={`text-sm font-medium px-2 py-0.5 rounded border ${cls}`}>
      {status}
    </span>
  )
}

export default function SubmissionsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const page = parseInt(searchParams.get("page") || "1", 10)

  const [subs, setSubs] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const { username } = useAuth()

  useEffect(() => {
    router.refresh()
  }, [page])

  useEffect(() => {
    const loadSubs = async () => {
      setLoading(true)

      const pageSize = 20
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1

      // fetch submissions
      const { data: subsData, error } = await supabase
        .from("public_submissions")
        .select(`
          id,
          username,
          problem_id,
          language,
          overall,
          created_at,
          time,
          memory_kb,
          created_at
        `)
        .order("created_at", { ascending: false })
        .range(from, to)

      if (error) {
        console.error("Error fetching submissions:", error.message)
        setLoading(false)
        return
      }

      // fetch leaderboard elo for all usernames
      const usernames = subsData?.map(s => s.username) || []
      const eloMap: Record<string, number | null> = {}

      if (usernames.length > 0) {
        const { data: leaderboardData, error: lbError } = await supabase
          .from("leaderboard")
          .select("username, elo, history")
          .in("username", usernames)

        if (lbError) {
          console.error("Error fetching leaderboard:", lbError.message)
        } else {
          leaderboardData?.forEach(lb => {
            const contestCount = lb.history?.length ?? 0
            eloMap[lb.username] = getDisplayedElo(lb.elo, contestCount)
          })
        }
      }

      const problemIds = subsData?.map(s => s.problem_id) || []
      const titleMap: Record<number, string> = {}
      const problemEloMap: Record<number, number> = {}

      if (problemIds.length > 0) {
        const { data: problemsData, error } = await supabase
          .rpc('get_problems_by_ids', { p_ids: problemIds })

        // Cast or type it properly
        const typedProblems = problemsData as Problem[] | null

        typedProblems?.forEach(p => {
          titleMap[p.id] = p.title
          if (p.difficulty) problemEloMap[p.id] = p.difficulty
        })
      }

      const merged = (subsData || []).map(s => ({
        ...s,
        elo: eloMap[s.username] ?? null,
        title: titleMap[s.problem_id] ?? null,
        problem_elo: problemEloMap[s.problem_id] ?? null,
      }))
      

      setSubs(merged)
      setLoading(false)
    }

    loadSubs()
  }, [page])

  const verdictColor = (status: string) => {
    switch (status) {
      case 'Accepted': return 'text-green-400'
      case 'Wrong Answer': return 'text-red-400'
      case 'Time Limit Exceeded': return 'text-gray-400'
      default: return 'text-yellow-400'
    }
  }

  return (
    <main >
      <div style={{fontSize: 15}} className="p-6"> 

        <h1 className="text-2xl font-bold mb-4">Submissions (page {page})</h1>

        {loading ? (
          <p className="text-gray-400">Loading...</p>
        ) : (
          <div className="overflow-x-auto max-w-8xl mx-auto">
  
          

            <div className="flex flex-col gap-2">
              {subs.map(s => {
                const initials = s.username.slice(0, 2).toUpperCase()
                const eloClass = s.elo ? getEloClass(s.elo) : ''
                const ms = Math.floor((s.time ?? 0) * 100000) / 100
                const timeAgo = /* use a relative time helper or just the locale string */
                  new Date(s.created_at).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour12: true })

                return (
                  <div key={s.id} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-800 hover:border-gray-700 transition-colors" style={{fontSize: 14, backgroundColor: "#111111"}}>
                    {/* Avatar */}
                    <div className="relative w-9 h-9 shrink-0">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium bg-blue-950 text-blue-300">
                        {initials}
                      </div>
                    </div>

                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 text-md">
                        <Image
                          src={`/assets/ranks/${getEloClass(s.elo ?? 0)}.png`}
                          alt={getEloClass(s.elo ?? 0)}
                          width={25}
                          height={25}
                          className="shrink-0"
                        />
                        <Link href={`/user?username=${s.username}`} prefetch={false}>
                          <span className={`font-medium hover:underline cursor-pointer ${eloClass}`}>{s.username}</span>
                        </Link>
                        <span className="text-gray-600">·</span>
                        <Link href={`/problems?id=${s.problem_id}`} prefetch={false}>
                          <span
                            className="hover:underline cursor-pointer font-bold text-md"
                            style={{ color: getEloColor(s.problem_elo ?? 0) }}
                          >
                            {s.title && `${s.title}`}
                          </span>
                        </Link>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <VerdictBadge status={s.overall} />
                        <span className="text-sm px-2 py-0.5 rounded-full border border-gray-500 text-gray-100">{s.language}</span>
                        <span className="text-sm px-2 py-0.5 rounded-full border border-gray-500 text-gray-100">{timeAgo}</span>
                      </div>
                    </div>

                    {/* Performance stats */}
                    <div className="flex flex-col items-end shrink-0 gap-0.5">
                      <span className="text-sm font-medium tabular-nums text-gray-200">{s.time ? `${ms} ms` : '—'}</span>
                    </div>

                    {/* Action */}
                    {s.username === username ? (
                      <Link href={`/submission?id=${s.id}`} prefetch={false}>
                        <span className="text-xs text-blue-400 hover:underline cursor-pointer ml-2 shrink-0">View ↗</span>
                      </Link>
                    ) : (
                      <span className="text-xs text-gray-700 ml-2 shrink-0">Locked</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="flex justify-center gap-4 mt-4">
          {page > 1 && (
            <button
              onClick={() => router.push(`/submissions?page=${page - 1}`)}
              className="px-3 py-1 bg-gray-700 rounded hover:bg-gray-600"
            >
              Prev
            </button>
          )}
          <button
            onClick={() => router.push(`/submissions?page=${page + 1}`)}
            className="px-3 py-1 bg-gray-700 rounded hover:bg-gray-600"
          >
            Next
          </button>
        </div>
        
      </div>
    </main>
  )
}
