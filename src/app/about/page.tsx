'use client'

import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabaseClient'
import Link from 'next/link'
import GradientText from './GradientText/GradientText'
import AnimatedContent from '@/components/reactbits/AnimatedContent/AnimatedContent'
import CountUp from '@/components/reactbits/CountUp/CountUp'

export default function AboutPage() {

  const [submissionsCount, setSubmissionsCount] = useState<number | null>(0)
  const [problemsCount, setProblemsCount] = useState<number | null>(0)
  const [contestsCount, setContestsCount] = useState<number | null>(0)
  const [correctSubmissionsCount, setCorrectSubmissionsCount] = useState<number | null>(0)
  const [usersCount, setUsersCount] = useState<number | null>(0)
  useEffect(() => {
    const fetchSubmissionsLen = async () => {
        const { count, error } = await supabase
        .from('submissions')
        .select('*', { count: 'exact', head: true })
        setSubmissionsCount(count)
    }
    const fetchCorrectSubmissionsLen = async () => {
      const { count, error } = await supabase
        .from('submissions')
        .select('*', { count: 'exact', head: true })
        .eq('overall', 'Accepted');
        setCorrectSubmissionsCount(count)
    }
    const fetchUsersCount = async () => {
      const { count, error } = await supabase
        .from('leaderboard')
        .select('*', { count: 'exact', head: true })
        setUsersCount(count)
    }
    const fetchProblemsCount = async () => {
      const { data: count, error } = await supabase.rpc('get_problems_count')
      if (!error) setProblemsCount(count)
    }
    const fetchContestsCount = async () => {
      const { count, error } = await supabase
        .from('contests')
        .select('*', { count: 'exact', head: true })
        setContestsCount(count)
    }
    fetchUsersCount()
    fetchContestsCount()
    fetchProblemsCount()
    fetchSubmissionsLen()
    fetchCorrectSubmissionsLen()
  }, []);

  

  return (
    <main>
      <div className="p-6">
        <AnimatedContent  
          distance={50}
          direction="vertical"
          reverse={false}
          duration={0.8}
          ease="power3.out"
          initialOpacity={0.0}
          animateOpacity
          scale={1.0}
          threshold={0.2}
          delay={0.0}
        >
          <GradientText
            colors={["#b300ffff", "#ff9effff", "#b300ffff", "#ff9effff", "#b300ffff"]}
            animationSpeed={4}
            showBorder={false}
            className="text-4xl about"
          >
            About BQTOJ
          </GradientText>
        </AnimatedContent>
        <AnimatedContent  
          distance={50}
          direction="vertical"
          reverse={false}
          duration={0.8}
          ease="power3.out"
          initialOpacity={0.0}
          animateOpacity
          scale={1.0}
          threshold={0.2}
          delay={1.0}
        >
        <p className="mb-4">
          <strong>BQTOJ</strong> (BanhQuyTeam Online Judge) is a friendly and beginner-focused coding judge created by <strong>BanhQuyTeam</strong>; a group of passionate developers who want to make competitive programming more accessible and enjoyable for newcomers.
        </p>

        <p className="mb-4">
          Whether you are just getting started or sharpening your fundamentals, BQTOJ offers a curated problem set designed around your skill level. We use an <strong>Elo-based difficulty system</strong> that ensures every problem fits your growth path.
        </p>

        <div className="flex items-center justify-center">
          <span className="flex items-center justify-center gap-2">
            <GradientText colors={["#b300ffff", "#ff9effff", "#b300ffff", "#ff9effff", "#b300ffff"]} animationSpeed={4} showBorder={false} className="inline-flex items-center justify-center">
              <CountUp 
                from={0}
                to={submissionsCount ?? 0}
                duration={1}
                separator='.'
                className="text-4xl font-bold"
              >
              </CountUp>
            </GradientText>
            <span className="font-bold text-3xl whitespace-nowrap">
              submissions
            </span>
          </span>
          </div>

          <div className="flex items-center justify-center">
          <span className="flex items-center justify-center gap-2">
            <GradientText colors={["#00ff73ff", "#9effd0ff", "#00ff73ff", "#9effd0ff", "#00ff73ff"]} animationSpeed={4} showBorder={false} className="inline-flex items-center justify-center">
              <CountUp 
                from={0}
                to={correctSubmissionsCount ?? 0}
                duration={1}
                separator='.'
                className="text-5xl font-bold"
              >
              </CountUp>
            </GradientText>
            <span className="font-bold text-4xl whitespace-nowrap">
              AC submissions
            </span>
          </span>
          </div>

          <div className="flex items-center justify-center">
          <span className="flex items-center justify-center gap-2">
            <GradientText colors={["#7edbffff", "#9ef4ffff", "#7edbffff", "#9ef4ffff", "#7edbffff"]} animationSpeed={4} showBorder={false} className="inline-flex items-center justify-center">
              <CountUp 
                from={0}
                to={usersCount ?? 0}
                duration={1}
                separator='.'
                className="text-6xl font-bold"
              >
              </CountUp>
            </GradientText>
            <span className="font-bold text-5xl whitespace-nowrap">
              registered users
            </span>
          </span>
          </div>

          <div className="flex items-center justify-center">
          <span className="flex items-center justify-center gap-2">
            <GradientText colors={["#ffae00ff", "#ffdf9bff", "#ffae00ff", "#ffdf9bff", "#ffae00ff"]} animationSpeed={4} showBorder={false} className="inline-flex items-center justify-center">
              <CountUp 
                from={0}
                to={problemsCount ?? 0}
                duration={1}
                separator='.'
                className="text-5xl font-bold"
              >
              </CountUp>
            </GradientText>
            <span className="font-bold text-4xl whitespace-nowrap">
              problems
            </span>
          </span>
          </div>

          <div className="flex items-center justify-center">
          <span className="flex items-center justify-center gap-2">
            <GradientText colors={["#ff0000ff", "#ffaa9bff", "#ff0000ff", "#ffaa9bff", "#ff0000ff"]} animationSpeed={4} showBorder={false} className="inline-flex items-center justify-center">
              <CountUp 
                from={0}
                to={contestsCount ?? 0}
                duration={1}
                separator='.'
                className="text-4xl font-bold"
              >
              </CountUp>
            </GradientText>
            <span className="font-bold text-3xl whitespace-nowrap">
              contests
            </span>
          </span>
          </div>



        <h2 className="text-xl font-semibold mt-6 mb-2">ᯓ★ Built by</h2>
        <ul className="list-disc pl-6 mb-4">
          <li><strong style={{color: '#aa00aa'}}>QTChosusTV</strong> – Lead developer & system architect</li>
          <li><strong style={{color: '#55aaff'}}>Anhwaivo</strong> – Backend engineer, UI/UX designer & frontend</li>
          <li><strong style={{color: '#00aa00'}}>Sussy_fish</strong> – Problem setter</li>
        </ul>

        <h2 className="text-xl font-semibold mt-6 mb-2">ᯓ★ Mission</h2>
        <p className="mb-4">
          We want to make learning to code through contests easier, fairer, and more exciting. From training for IOI to solving your first loop problem — BQTOJ is your platform to grow and have fun while doing it.
        </p>

        <p className="mt-6">
          Try a contest, solve a problem, or just explore our community.  
          Your competitive programming journey starts here.
        </p>

        <p className="mt-8">
          <Link href="/" className="text-blue-500 hover:underline font-bold">← Back to Home</Link>
        </p>
        </AnimatedContent>
      </div>
    </main>
  )
}
