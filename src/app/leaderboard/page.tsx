'use client'

import { useAuth } from '@/context/AuthContext'
import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import styles from './leaderboard.module.css'
import './leaderboard.css'
import Link from 'next/link';
import Image from 'next/image'
import AnimatedContent from '@/components/reactbits/AnimatedContent/AnimatedContent'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getDisplayedElo } from "@/utils/eloAccumulation"
import { getEloClass, getEloColor, ELO_TIERS } from "@/utils/eloDisplay"

interface User {
  username: string
  elo: number
  rawElo: number
  history: HistoryEntry[]
  cnt: number
}

type HistoryEntry = {
  contest: string
  elo: number
}

function adjustColor(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255

  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }

  // Only shift lightness, never touch saturation
  const newL = Math.min(0.95, Math.max(0.05, l + amount / 100))

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1/6) return p + (q - p) * 6 * t
    if (t < 1/2) return q
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
    return p
  }

  const q = newL < 0.5 ? newL * (1 + s) : newL + s - newL * s
  const p = 2 * newL - q

  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0')

  return `#${toHex(hue2rgb(p, q, h + 1/3))}${toHex(hue2rgb(p, q, h))}${toHex(hue2rgb(p, q, h - 1/3))}`
}

export default function LeaderboardPage() {
  const [users, setUsers] = useState<User[]>([])
  const [tick, setTick] = useState(1)
  const { username } = useAuth()

  useEffect(() => {
    const fetchData = async () => {
      const { data, error } = await supabase
        .from('leaderboard')
        .select('username, elo, history')

      if (error) {
        console.error('Supabase fetch error:', error.message)
        return
      }

      const transformed = data?.map(u => {
        const contestCount = u.history?.length ?? 0
        const displayedElo = getDisplayedElo(u.elo, contestCount)

        return {
          ...u,
          rawElo: u.elo,
          elo: displayedElo,
          cnt: contestCount
        }
      })

      const sorted = transformed?.sort((a, b) => b.elo - a.elo)

      setUsers(sorted ?? [])

    }

    fetchData()
  }, [])

  useEffect(() => {
    if (tick >= users.length) return 

    const timer = setTimeout(() => {
      setTick(prev => Math.min(prev + 1, users.length))
    }, 100) 

    return () => clearTimeout(timer)
  }, [tick, users.length])

  const sortedTiers = ELO_TIERS.slice().sort((a, b) => a.min - b.min) // ascending: 0, 400, 800...

  const eloBins = sortedTiers.flatMap((tier, i) => {
    const min = tier.min
    const max = (sortedTiers[i + 1]?.min ?? 4000) - 1  // next tier's min - 1
    const mid = Math.floor((min + max) / 2)

    return [
      { min, max: mid, label: `${min}–${mid}`, color: adjustColor(tier.color, 0) },
      { min: mid + 1, max, label: `${mid + 1}–${max}`, color: adjustColor(tier.color, 5) },
    ]
  })

  const eloDistribution = eloBins.map(bin => {
    const count = users.filter(u => u.elo >= bin.min && u.elo <= bin.max).length;
    return {
      range: bin.label,
      minElo: bin.min,
      count,
      color: bin.color
    };
  });


  return (
    <main>

      <div style={{ width: '100%', height: 300, marginBottom: '0px', marginTop: '50px' }}>
        <ResponsiveContainer>
          <BarChart 
            data={eloDistribution} 
            margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
          >
            <XAxis 
              dataKey="range" 
              interval={0} 
              angle={-45} 
              textAnchor="end" 
              height={60} 
              tick={{ fontSize: 12, fill: '#ccc' }}
            />
            <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#ccc' }} />
            
            <Tooltip 
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div style={{
                      background: '#222',
                      padding: '5px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      boxShadow: '0 0 5px rgba(0,0,0,0.5)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: adjustColor(data.color, +15),
                    }}>
                      <Image
                        src={`/assets/ranks/${getEloClass(data.minElo)}.png`}
                        alt=""
                        width={18}
                        height={18}
                        style={{ imageRendering: 'pixelated' }}
                      />
                      {data.range}: {data.count} user{data.count !== 1 ? 's' : ''}
                    </div>
                  );
                }
                return null;
              }}
            />

            <Bar
              dataKey="count"
              shape={(props: any) => {
                const { x, y, width, height, index } = props
                const isUpper = index % 2 === 1  // upper halves are odd indexes
                const barWidth = isUpper ? width : width * 0.6
                const xOffset = (width - barWidth) / 2
                return (
                  <rect
                    x={x + xOffset}
                    y={y}
                    width={barWidth}
                    height={height}
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

      
      <div style={{ padding: '20px', marginTop: '-40px' }}>
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
          <table id="leaderboard" className={styles.sTable}>
            <thead>
              <tr>
                <th style={{ textAlign: 'center' }}>Rank</th>
                <th style={{ paddingLeft: '25px' }}>Username</th>
                <th style={{ textAlign: 'center' }} className="w-15">Contests</th>
                <th style={{ textAlign: 'center' }}>Elo</th>
              </tr>
            </thead>
            <tbody>
              {users.slice(0, tick).map((user, index) => {
                const rank = index + 1
                const eloClass = getEloClass(user.elo)
                const top100Class = index < 100 ? 'elo-top-100' : ''
                const usernameClassList = `${eloClass} ${top100Class}`
                const iconSrc = `/assets/ranks/${eloClass}.png`

                return (
                  <tr key={user.username}>
                    <td style={{ textAlign: 'center', width: '10  0px', marginLeft: '50px', marginRight: '50px'}}>{rank}</td>
                    <td className={usernameClassList}>
                      <Link
                        href={`/user/${encodeURIComponent(user.username)}`}
                        className={usernameClassList}
                        style={{ display: 'flex', alignItems: 'center' }}
                        prefetch={false}
                      >
                        <Image
                          src={iconSrc}
                          alt={eloClass}
                          style={{
                            marginRight: '15px',
                          }}
                          width='80'
                          height='80'
                        />
                        <strong style={{"fontSize": "16px"}}>{user.username}</strong>
                      </Link>
                    </td>
                    <td style={{ textAlign: 'center' }} className={ELO_TIERS[Math.max(13-user.cnt, 0)].class}>
                      <span className="flex justify-center items-center">
                        <strong className="mr-2">{user.cnt}</strong> 
                        {(user.cnt < 5)? 
                          <Image src={`/assets/progress-bar/progress-${Math.min(user.cnt, 5)}.png`} alt="" title="Users has to do 5 contests to get thier true skill rating."
                            width="30"
                            height="30"
                            className={`recor hue-${(Math.min(user.cnt, 5) + 2)*30}`}
                          ></Image>
                          : 
                          <p title="Users has to do 5 contests to get thier true skill rating.">✅</p>
                        }
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }} className={getEloClass(user.elo)}>
                      {user.elo}
                    </td>
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
