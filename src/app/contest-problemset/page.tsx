// ContestProblemSet.tsx

'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import Link from 'next/link'
import './cpls.css'
import styles from './cpls.module.css'
import AnimatedContent from '@/components/reactbits/AnimatedContent/AnimatedContent'
import { getEloClass, getEloColor } from "@/utils/eloDisplay"
import { useAuth } from '@/context/AuthContext'

interface Problem {
  id: number
  title: string
  difficulty: number
  pname: string
  tags: { tagName: string }[]
  created_at: string
}

interface DatabaseProblem {
  id: number
  title: string
  difficulty: number
  tags: { tagName: string }[]
  created_at: string
}


interface Contest {
  id: number
  name: string | null
  time_start: string | null
  time_end: string | null
  elo_min: number | null
  elo_max: number | null
  link: string | null
  problems: { pid: number; pname: string }[]
  descriptions: string
}

export default function ContestProblemset() {
  const { username } = useAuth()
  const [contestId, setContestId] = useState<number | null>(null)
  const [contestProblems, setContestProblems] = useState<Problem[]>([])
  const [solvedProblems, setSolvedProblems] = useState<Set<number>>(new Set())
  const [tick, setTick] = useState(0)
  const [currUser, setCurrUser] = useState<any>(null);
  const [contest, setContest] = useState<Contest | null>(null);
  
  const pathname = usePathname()
  

  useEffect(() => {
    if (!contestId) return;
    const fetchContest = async () => {
      const { data } = await supabase
        .from('contests')
        .select('id, name, time_start, time_end, elo_min, elo_max, link, problems, descriptions')
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
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: userData } = await supabase
        .from('users')
        .select('username, current_contest_id')
        .eq('id', user.id)
        .single()

      if (!userData || !userData.current_contest_id || userData.current_contest_id === 0) return

      setContestId(userData.current_contest_id)

      const { data: contestData } = await supabase
        .from('contests')
        .select('problems, id, time_start, time_end, elo_min, elo_max, name, link, descriptions')
        .eq('id', userData.current_contest_id)
        .single()

      if (!contestData) return
      setContest(contestData)

      // Do NOT fetch problem details if the contest hasn't started yet
      const startMs = contestData.time_start ? new Date(contestData.time_start).getTime() : 0
      if (Date.now() < startMs || !contestData.problems) return

      const problemIds = contestData.problems.map((p: any) => p.pid)

      const { data: problems } = await supabase
        .from('problems')
        .select('id, title, difficulty, tags, created_at')
        .in('id', problemIds)

      if (!problems) return

      const ordered = contestData.problems
        .map((contestProblem: { pid: number; pname: string }) => {
          const problem = problems.find((p: DatabaseProblem) => p.id === contestProblem.pid)
          if (problem) {
            return {
              ...problem,
              pname: contestProblem.pname
            } as Problem
          }
          return null
        })
        .filter(Boolean) as Problem[]

      setContestProblems(ordered)
    }

    init()
  }, [])

  useEffect(() => {
    if (!username || !contestId) return;

    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('submissions')
        .select('problem_id')
        .eq('username', username)
        .eq('overall', 'Accepted')
        .eq('contest_id', contestId);

      if (data) setSolvedProblems(new Set(data.map(d => d.problem_id)));
    }, 500); 

    return () => clearTimeout(timer); 
  }, [username, contestId]);


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

  const countdownText = () => {
    if (!contest) return ''
    const now = Date.now()
    const start = contest.time_start ? new Date(contest.time_start).getTime() : 0
    const end = contest.time_end ? new Date(contest.time_end).getTime() : 0
    if (now < start) return `Starts in: ${formatTimeLeft(contest.time_start)}`
    else if (now >= start && now <= end) return `Ends in: ${formatTimeLeft(contest.time_end)}`
    else return 'Contest ended'
  }

  



  return (
    <main className="flex min-h-screen" style={{margin: 0}}>
        
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

        
        <div className="flex-1 mr-6 mt-6 ml-6">
          {contestId && (now >= timeStart) ? (
            <div>
              <AnimatedContent
                distance={50}
                direction="vertical"
                duration={0.8}
                ease="power3.out"
                initialOpacity={0.0}
                animateOpacity
              >
                <h2 className="text-lg font-bold mb-4">Contest Problems</h2>
                <p className="text-yellow-400 mb-4 font-semibold">{countdownText()}</p>
                <table id="problemlist" className={styles.cplsTable}>
                  <thead>
                    <tr>
                      <th>Problem</th>
                      <th>Title</th>
                      <th>Est. Elo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contestProblems.map(problem => (
                      <tr key={problem.id}>
                        <td>{problem.pname}</td>
                        <td className={getEloClass(problem.difficulty)}>
                          <strong>
                            <Link href={`/problems?id=${encodeURIComponent(problem.id)}`} prefetch={false}>
                              {solvedProblems.has(problem.id) && "✅"} {problem.title}
                            </Link>
                          </strong>
                        </td>
                        <td className={getEloClass(problem.difficulty)}>{problem.difficulty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </AnimatedContent>
            </div>
          ) : (
            <p className="p-6 text-red-400">You are not in a contest / Problem are being loaded / Contest has not started</p>
          )}
        </div>
    </main>
  )
}
