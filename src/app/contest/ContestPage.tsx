// ContestPage.tsx

'use client'
export const dynamic = 'force-dynamic'


import { usePathname } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import Link from 'next/link'
import AnimatedContent from '@/components/reactbits/AnimatedContent/AnimatedContent'
import MarkdownRenderer from "@/components/renderer/MarkdownRenderer"
import styles from "./ct.module.css"
import "@/components/renderer/MarkdownRenderer.css";

interface Contest {
  id: number
  name: string | null
  time_start: string | null
  time_end: string | null
  elo_min: number | null
  elo_max: number | null
  link: string | null
  problems: any[]
  descriptions: string
}

export default function ContestPage() {
  const searchParams = useSearchParams()
  const contestId = searchParams.get('id')
  const contestIdNum = contestId ? parseInt(contestId, 10) : null

  const [contest, setContest] = useState<Contest | null>(null)
  const [currUser, setCurrUser] = useState<any>(null)
  const { username } = useAuth()
  const [tick, setTick] = useState(0)
  const router = useRouter()
  
  const pathname = usePathname()
  

  useEffect(() => {
    const interval = setInterval(() => setTick(prev => prev + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: userData, error } = await supabase
        .from("users")
        .select("id, username, current_contest_id")
        .eq("email", user.email)
        .single()
      if (error) console.error("Error fetching user:", error)

      if (!userData) {
        console.error("No user found in database")
        return
      }

      setCurrUser(userData)
      //console.log("Auth user.id:", user.id)
      //console.log("Fetched userData:", userData)
    }
    fetchUser()
  }, [])



  useEffect(() => {
    if (!contestIdNum) return

    const fetchContest = async () => {
      const { data, error } = await supabase
        .from('contests')
        .select('id, time_start, time_end, elo_min, elo_max, name, link, descriptions')
        .eq('id', contestIdNum)
        .single()

      if (!error && data) {
        setContest({
          ...data,
          id: Number(data.id),
        } as Contest)
      } else {
        console.error('Error fetching contest:', error)
      }
    }

    fetchContest()
  }, [contestIdNum])

  if (!contestIdNum) {
    return <main className="p-6">No contest ID provided.</main>
  }

  if (!contest) {
    return <main className="p-6">Loading contest...</main>
  }

  const handleClick = async () => {
    try {
      if (!currUser || !contest) return

      const now = Date.now()
      const timeStart = contest.time_start ? new Date(contest.time_start).getTime() : 0
      const timeEnd = contest.time_end ? new Date(contest.time_end).getTime() : 0

      const contestIdSafe = Number(contest.id)
      if (!contestIdSafe) {
        console.error('Invalid contest id:', contest?.id)
        return
      }

      // console.log('currUser before update:', currUser)
      // console.log('contest before update:', contest)
      // console.log('contest id update:', contestIdSafe)

      const { data: updatedUser, error } = await supabase
        .from('users')
        .update({ current_contest_id: contestIdSafe })
        .eq('id', currUser.id)  
        .select()
        .single()

      if (error) {
        console.error('Error updating current_contest_id:', error)
        return
      }

      setCurrUser((prev: any) => ({ ...(prev ?? {}), ...updatedUser }))

      if (now >= timeStart && now <= timeEnd) {
        router.push('/contest-problemset')
      } else {
        // ('Registered for contest', contestIdSafe)
      }
    } catch (err) {
      console.error('handleClick error', err)
    }
  }

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

  const countdownText = () => {
    if (!contest) return ""
    const now = Date.now()
    const start = contest.time_start ? new Date(contest.time_start).getTime() : 0
    const end = contest.time_end ? new Date(contest.time_end).getTime() : 0

    if (now < start) return `Starts in: ${formatTimeLeft(contest.time_start)}`
    else if (now >= start && now <= end) return `Ends in: ${formatTimeLeft(contest.time_end)}`
    else return "Contest ended"
  }

  const fetchSubmissions = async (username: string, contestId: number | null) => {
    let query = supabase
      .from("submissions")
      .select("problem_id")
      .eq("username", username)
      .eq("overall", "Accepted")

    if (contestId === null || contestId === 0) {
      query = query.is("contest_id", null)
    } else {
      query = query.eq("contest_id", contestId)
    }

    const { data, error } = await query
    if (error) {
      console.error("Error fetching submissions:", error)
    } else {
      // console.log("Fetched submissions:", data)
    }
  }




  const now = Date.now()
  const timeStart = contest.time_start ? new Date(contest.time_start).getTime() : 0
  const timeEnd = contest.time_end ? new Date(contest.time_end).getTime() : 0

  let buttonText: string | null = null
  if (now < timeStart) buttonText = "Register"
  else if (now >= timeStart && now <= timeEnd) buttonText = "Join Contest"

  return (
    <main className="h-screen flex flex-col"> 

      <div className="flex flex-1">
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

        

          <section className="flex-1 p-8 overflow-y-auto">
            <AnimatedContent
              distance={50}
              direction="vertical"
              duration={0.8}
              ease="power3.out"
              initialOpacity={0.0}
              animateOpacity
            >
              <h1 className="text-2xl font-bold mb-2">{contest.name}</h1>
              <p className="text-gray-400 mb-4">
                {contest.time_start && <>Start: {new Date(contest.time_start).toLocaleString()} </>}
                {contest.time_end && <>| End: {new Date(contest.time_end).toLocaleString()}</>}
              </p>

              <p className="text-yellow-400 mb-4 font-semibold">{countdownText()}</p>

              <p className="mb-4 text-gray-300">
                Elo range: {contest.elo_min ?? '-'} – {contest.elo_max ?? '-'}
              </p>

              {buttonText && (
                <button
                  onClick={currUser?.current_contest_id === contest.id ? undefined : handleClick}
                  disabled={currUser?.current_contest_id === contest.id}
                  className={`mt-6 px-4 py-2 rounded text-white ${
                    currUser?.current_contest_id === contest.id
                      ? "bg-gray-900 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  {now < timeStart
                    ? currUser?.current_contest_id === contest.id
                      ? "Registered ✅"
                      : "Register"
                    : now >= timeStart && now <= timeEnd
                    ? currUser?.current_contest_id === contest.id
                      ? "Joined ✅"
                      : "Join Contest"
                    : null}
                </button>
              )}

              <MarkdownRenderer content={contest.descriptions} className="mt-10" />
            </AnimatedContent>
          </section>
      </div>
    </main>
  )
}