'use client';
import { getEloClass, getEloColor } from "@/utils/eloDisplay"
import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabaseClient';
import { getDisplayedElo } from "@/utils/eloAccumulation"
import MarkdownRenderer from "@/components/renderer/MarkdownRenderer";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  TimeScale,
  Filler,
  TooltipItem
} from "chart.js";
import dynamic from 'next/dynamic';
import type { ChartOptions } from 'chart.js';
import './user.css';
import styles from './user.module.css';
import type { Chart } from 'chart.js';
import Image from 'next/image'
import parse from 'color-parse';
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import remarkBreaks from "remark-breaks";
import zoomPlugin from 'chartjs-plugin-zoom';
import { useSearchParams, useRouter } from 'next/navigation';

import 'chartjs-adapter-date-fns';
import "katex/dist/katex.min.css";
import Link from "next/link";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';


  interface Contest {
    contestId: number;
    name: string;
    date: string;
    rank: number;
    elo: number;
  }

  type EloEstimate = {
    elo: number
    sd: number
  }


  const Line = dynamic(
    () => import('react-chartjs-2').then(m => m.Line),
    { ssr: false }
  );

  function estimateUserElo(
    solvedElos: number[],
    priorMean = 800,
    priorSd = 300,
    scale = 400,
    maxIter = 200,
    tol = 1e-7
  ): EloEstimate {
    if (!solvedElos || solvedElos.length === 0) {
      throw new Error("solvedElos must be a non-empty array")
    }

    const ln10 = Math.log(10)
    let theta = solvedElos.reduce((a, b) => a + b, 0) / solvedElos.length // initial guess

    let h = -1 / (priorSd * priorSd)

    for (let it = 0; it < maxIter; it++) {
      let gLike = 0
      let hLike = 0

      for (const beta of solvedElos) {
        const t = Math.pow(10, (beta - theta) / scale)
        const p = 1 / (1 + t)
        gLike += (ln10 / scale) * (1 - p)
        hLike += -Math.pow(ln10 / scale, 2) * p * (1 - p)
      }

      const gPrior = -(theta - priorMean) / (priorSd * priorSd)
      const hPrior = -1 / (priorSd * priorSd)

      const g = gLike + gPrior
      h = hLike + hPrior

      const step = g / h
      const thetaNew = theta - step

      if (Math.abs(thetaNew - theta) < tol) {
        theta = thetaNew
        break
      }
      theta = thetaNew
    }

    const postVar = -1 / h
    const postSd = Math.sqrt(Math.max(postVar, 0))

    return { elo: theta, sd: postSd }
  }

  

  const gradientBackgroundPlugin = {
    id: "gradientBackground",
    beforeDraw(chart: Chart) {
      const { ctx, chartArea: { top, bottom, left, right }, scales: { y } } = chart;
      const gradient = ctx.createLinearGradient(0, bottom, 0, top);
      const chartYMin = y.min;
      const chartYMax = y.max;
      const yRange = chartYMax - chartYMin;

      const transitionWidth = 26;
      const eloRanges = [
        { start: 0, end: 400, color: "#ffffff" },
        { start: 400, end: 800-transitionWidth/2, color: "#aaaaaa" },
        { start: 800, end: 1200-transitionWidth/2, color: "#aa5500" },
        { start: 1200, end: 1400-transitionWidth/2, color: "#00aa00" },
        { start: 1400, end: 1500-transitionWidth/2, color: "#00aaaa" },
        { start: 1500, end: 1600-transitionWidth/2, color: "#4bdbff" },
        { start: 1600, end: 1750-transitionWidth/2, color: "#55aaff" },
        { start: 1750, end: 1900-transitionWidth/2, color: "#7900fa" },
        { start: 1900, end: 2100-transitionWidth/2, color: "#aa00aa" },
        { start: 2100, end: 2300-transitionWidth/2, color: "#fbff00" },
        { start: 2300, end: 2500-transitionWidth/2, color: "#ffaa00" },
        { start: 2500, end: 2700-transitionWidth/2, color: "#ff7575" },
        { start: 2700, end: 3000-transitionWidth/2, color: "#ff0000" },
        { start: 3000, end: 9999999, color: "#8b0000" }
      ];

      const points: { elo: number, color: string }[] = [];

      eloRanges.forEach((range, index) => {
        if (range.end < chartYMin || range.start > chartYMax) return;

        const prev = eloRanges[index - 1];
        const next = eloRanges[index + 1];

        let bandStart = Math.max(chartYMin, range.start);
        const bandEnd = Math.min(chartYMax, range.end);

        if (prev && bandStart === range.start) {
          const ts = Math.max(chartYMin, range.start - transitionWidth / 2);
          const te = Math.min(chartYMax, range.start + transitionWidth / 2);
          points.push({ elo: ts, color: prev.color });
          points.push({ elo: te, color: range.color });
          bandStart = te;
        }

        points.push({ elo: bandStart, color: range.color });
        points.push({ elo: bandEnd, color: range.color });

        if (next && bandEnd === range.end) {
          const ts = Math.max(chartYMin, range.end - transitionWidth / 2);
          const te = Math.min(chartYMax, range.end + transitionWidth / 2);
          points.push({ elo: ts, color: range.color });
          points.push({ elo: te, color: next.color });
        }
      });

      points.sort((a, b) => a.elo - b.elo);
      points.forEach(({ elo, color }) => {
        const pos = (elo - chartYMin) / yRange;
        if (pos >= 0 && pos <= 1) gradient.addColorStop(pos, color);
      });

      ctx.save();
      ctx.fillStyle = gradient;
      ctx.fillRect(left, top, right - left, bottom - top);
      ctx.restore();
    }
  };



    const getEloTitle = (elo: number) => {
      if (elo >= 3000) return 'Legendary master'
      if (elo >= 2700) return 'Grandmaster'
      if (elo >= 2500) return 'International master'
      if (elo >= 2300) return 'National master'
      if (elo >= 2100) return 'Master'
      if (elo >= 1900) return 'Candidate master'
      if (elo >= 1750) return 'Semi master'
      if (elo >= 1600) return 'Expert'
      if (elo >= 1500) return 'Semi expert'
      if (elo >= 1400) return 'Specialist'
      if (elo >= 1200) return 'Pupil'
      if (elo >= 800) return 'Newbie'
      if (elo >= 400) return 'Beginner'
      if (elo > 0) return 'Initiate'
      return 'Unranked'
    }

  const getCFEloColor = (elo: number) => {
    if (elo >= 3000) return '#8b0000';
    if (elo >= 2600) return '#ff0000';
    if (elo >= 2400) return '#ff7575';
    if (elo >= 2300) return '#ffcc44';
    if (elo >= 2100) return '#ffee99';
    if (elo >= 1900) return '#aa00aa';
    if (elo >= 1600) return '#55aaff';
    if (elo >= 1400) return '#00aaaa';
    if (elo >= 1200) return '#00aa00';
    if (elo >= 800) return '#aaaaaa';
    return '#ffffff';
  };


  type Solved = { id: number; elo: number };

  const getRatingChangeColor = (ratingChange: number) => {
    const maxChange = 500;
    const absChange = Math.abs(ratingChange);
    const lightness = 70 - (absChange / maxChange) * 40;
    const clampedLightness = Math.max(30, Math.min(70, lightness));
    return ratingChange >= 0
      ? `hsl(120, 100%, ${clampedLightness}%)`
      : `hsl(0, 100%, ${clampedLightness}%)`;
  };

  export default function UserPage() {
    const [username, setUsername] = useState('');
    const [contestHistory, setHistory] = useState<Contest[]>([]);
    const [elo, setElo] = useState(0);
    const [solvedProblems, setSolvedProblems] = useState<Set<number>>(new Set())
    const [solvedElos, setSolvedElos] = useState<Solved[]>([]);
    const [userElo, setUserElo] = useState<number | null>(null);
    const [handle, setHandle] = useState('');
    const [cfElo, setCFElo] = useState('');
    const [desc, setDesc] = useState('');
    const [yBounds, setYBounds] = useState<{ min: number; max: number } | null>(null);

    const searchParams = useSearchParams();
    const router = useRouter();

    useEffect(() => {
      (async () => {
        const zoomPlugin = (await import('chartjs-plugin-zoom')).default;
        ChartJS.register(
          LineElement,
          PointElement,
          CategoryScale,
          LinearScale,
          Tooltip,
          Legend,
          Filler,
          TimeScale,
          zoomPlugin,
          gradientBackgroundPlugin
        );
      })();
    }, []);


    useEffect(() => {
      if (!contestHistory.length) return;
      if (yBounds !== null) return; // 🔒 already locked

      const eloValues = contestHistory.map(c => c.elo);
      const padding = contestHistory.length === 1 ? 250 : 100;

      const minElo = Math.min(...eloValues);
      const maxElo = Math.max(...eloValues);

      setYBounds({
        min: Math.max(0, Math.floor((minElo - padding) / 10) * 10),
        max: Math.ceil((maxElo + padding) / 10) * 10,
      });
    }, [contestHistory, yBounds]);


    const options: ChartOptions<'line'> = {
      responsive: true,
      layout: { padding: 10 },
      animation: false,

      onHover: (event, elements) => {
        const target = event?.native?.target as HTMLElement | undefined;
        if (!target) return;

        target.style.cursor = elements.length ? 'pointer' : 'default';
      },

      onClick: (event, elements, chart) => {
        if (!elements.length) return;

        const pointIndex = elements[0].index;
        const contest = contestHistory[pointIndex];
        if (!contest) return;
          router.push(`/contest?id=${contest.contestId}`);
        },

        plugins: {
          legend: {
            labels: { color: '#ffffff' },
          },

          tooltip: {
            callbacks: {
              label: (ctx: TooltipItem<'line'>) => {
                const c = contestHistory[ctx.dataIndex];
                if (!c) return '';
                return [
                  `Contest: ${c.name}`,
                  `Date: ${c.date}`,
                  `Rank: ${c.rank}`,
                  `Elo: ${c.elo}`,
                ];
              },
            },
          },

          zoom: {
            
            pan: {
              enabled: true,
              mode: 'x', // move left/right
              modifierKey: 'shift', // prevent accidental pan
            },
            zoom: {
              wheel: {
                enabled: true,
              },
              pinch: {
                enabled: true, // touchpad / mobile
              },
              mode: 'x', // zoom on time axis
            },
            limits: {
              x: { min: 'original', max: 'original' },
              y: { min: 'original', max: 'original' },
            },
          },
        },

        scales: {
          x: {
            type: 'time',
            time: {
              unit: 'day',
              tooltipFormat: 'yyyy-MM-dd',
              displayFormats: {
                day: 'yyyy-MM-dd',
                month: 'yyyy-MM',
                year: 'yyyy',
              },
            },
            ticks: {
              display: true,
              autoSkip: true,
              maxRotation: 0,
              minRotation: 0,
            },
            grid: { color: '#666666' },
            title: { display: false },
          },

          y: {
            grid: { color: '#444444' },
            min: yBounds?.min,
            max: yBounds?.max,
          },
        },
    };

    useEffect(() => {
      const uname = searchParams.get('username');
      if (!uname) return;
      setUsername(uname);

      const fetchHistory = async () => {
        const { data } = await supabase
          .from('leaderboard')
          .select('elo, history')
          .eq('username', uname)
          .maybeSingle();

      
        // console.log(data)

        if (data && data.history) {
          const rawHistory = data.history as Contest[]

          const displayedHistory = rawHistory.map((c, i) => ({
            ...c,
            rawElo: c.elo, // preserve original 
            elo: getDisplayedElo(c.elo, i + 1), // 👈 overwrite ONLY locally
          }))

          setHistory(displayedHistory)
          setElo(displayedHistory.at(-1)?.elo ?? 0)
        }
      };

      const fetchDesc = async () => {
        const { data: descData } = await supabase
          .from('public_users')
          .select('desc')
          .eq('username', uname)
          .single();

          setDesc(descData?.desc ?? '');
      };

      const fetchCodeforcesRating = async () => {
        const { data } = await supabase
          .from('public_users')
          .select('codeforces_handle')
          .eq('username', uname)
          .maybeSingle();

        if (!data?.codeforces_handle) {
          setHandle('');
          setCFElo('Unrated');
          return;
        }

        setHandle(data.codeforces_handle);

        try {
          const res = await fetch(
            `https://codeforces.com/api/user.info?handles=${encodeURIComponent(data.codeforces_handle)}`
          );
          const json = await res.json();

          if (json.status === "OK" && json.result.length > 0) {
            const userInfo = json.result[0];
            setCFElo(userInfo.rating || "Unrated");
          } else {
            setCFElo("Unrated");
          }
        } catch (err) {
          console.error("Error fetching CF rating:", err);
          setCFElo("Error");
        }
      };

      fetchHistory();
      fetchCodeforcesRating();
      fetchDesc();
    }, [searchParams]);

    useEffect(() => {
      const fetchSolved = async () => {
        if (!username) return;

        // Query public_submissions so solved problems load for ANY user profile
        const { data: subs } = await supabase
          .from("public_submissions")
          .select("problem_id")
          .eq("username", username)
          .eq("overall", "Accepted")
          .lt('problem_id', 1_000_000_000);

        const { data: probs } = await supabase
          .from("problems")
          .select("id, difficulty");

        if (subs && probs) {
          const solved = [...new Set(subs.map((s) => s.problem_id))]
            .map((id) => ({
              id,
              elo: probs.find((p) => p.id === id)?.difficulty ?? 0,
            }))
            .sort((a, b) => a.elo - b.elo);

          setSolvedProblems(new Set(solved.map((s) => s.id)));
          setSolvedElos(solved);

          if (solved.length > 0) {
            try {
              const estimate = estimateUserElo(solved.map(s => s.elo));
              setUserElo(Math.round(estimate.elo + estimate.sd));
            } catch (err) {
              console.error("Elo estimation failed:", err);
            }
          } else {
            setUserElo(null);
          }
        }
      };

      fetchSolved();
    }, [username]);

      // const labels = history.map(c => `${c.name} (#${c.contestId})`);
      
      const data = contestHistory.map(c => c.elo);
      const pointColors = data.map(getEloColor);
      const eloValues = contestHistory.map(c => c.elo);
      const minElo = Math.min(...eloValues);
      const maxElo = Math.max(...eloValues);
      const padding = contestHistory.length === 1   ? 250 : 100;

      const yMin = Math.max(0, Math.floor((minElo - padding) / 10) * 10);
      const yMax = Math.ceil((maxElo + padding) / 10) * 10;

      const stepSizeChart = Math.ceil((yMax - yMin) / 100) * 10;

      // console.log("Calculated step:", stepSizeChart, " with 2 val(s): ", yMin, ", ", yMax);

      const chartData = {
        datasets: [
          {
            label: "Elo Rating",
            data: contestHistory.map(c => ({
              x: c.date,
              y: c.elo,
            })),
            borderColor: '#dda600ff',
            backgroundColor: 'rgba(255,255,255,0.9)',
            pointBackgroundColor: pointColors,
            pointBorderColor: "#b28500ff",
            pointBorderWidth: 2,
            pointRadius: 5,
            pointHoverRadius: 6,
            tension: 0.0,
            fill: false,
          }
        ]
      };

    const eloClass = getEloClass(elo);
    
    // inside UserPage component, after solvedElos is set
    const eloBins: { min: number; max: number; label: string }[] = [];
    for (let start = 400; start <= 3000; start += 50) {
      eloBins.push({ min: start, max: start + 49, label: `${start}` }); // show only start
    }

    const eloDistribution = eloBins.map(bin => {
      const count = solvedElos.filter(s => s.elo >= bin.min && s.elo <= bin.max).length;
      return {
        range: bin.label,
        count,
        color: getEloColor(bin.min),
      };
    });

    return (
      <div style={{padding: '20px', overflowX: 'hidden', maxWidth: '100%'}}>
        <div style={{
          alignItems: 'center',
          gap: '10px',
          marginBottom: '20px'
        }}>

          <div style={{display: 'flex'}}>
            <Image
              src={`/assets/ranks/${eloClass}.png`}
              alt={eloClass}
              style={{
                verticalAlign: 'middle'
              }}
              width='80'
              height='80'
            />
            <h1
              id="userTitle"
              className={eloClass}
              style={{
                fontSize: '26px',
                fontWeight: 'bold',
                margin: 0,
                marginTop: '17px',
                marginLeft: '10px'
              }}
            >
              {username} ({elo})
            </h1>
          </div>

          <h2
            id="userTitle"
            className={eloClass}
            style={{
              fontSize: '16px',
              fontWeight: 'bold',
              marginLeft: '90px',
              marginTop: '-15px',
              marginBottom: '35px'
            }}
          >
            {getEloTitle(elo)}
          </h2>

        </div>

        <MarkdownRenderer content={desc} />

        <table id="history" className={styles.urTable} style={{width: '100%'}}>
          <thead>
            <tr>
                <th style={{ width: '28%' }}>Name</th>
                <th style={{ width: '12%' }}>Date</th>
                <th style={{ width: '10%' }}>Rank</th>
                <th style={{ width: '10%' }}>Elo</th>
                <th style={{ width: '40%' }}>Change</th>
            </tr>
          </thead>
          <tbody className={styles.contestList}>
            {contestHistory.map((c, i) => {
              const prevElo = i > 0 ? contestHistory[i - 1].elo : null;
              const change = prevElo === null ? c.elo : c.elo - prevElo;
              const color = getRatingChangeColor(change);
              return (
                <tr key={c.contestId}>
                  <td className="hover:underline">
                    <Link href={`/contest?id=${encodeURIComponent(c.contestId)}`} prefetch={false}>{c.name}</Link>
                  </td>
                  <td>{c.date}</td>
                  <td>
                    {c.rank === 1 ? `#${c.rank} 🥇` : c.rank === 2 ? `#${c.rank} 🥈` : c.rank === 3 ? `#${c.rank} 🥉` : c.rank <= 10 ? `#${c.rank} 🏅` : `#${c.rank}`}
                  </td>
                  <td className={getEloClass(c.elo)}><strong>{c.elo}</strong></td>
                  <td className="font-bold" style={{color, fontSize: '16px'}}>
                    {change >= 0 ? `+${change}` : change}
                    {getEloClass(c.elo) !== getEloClass(prevElo ?? 0) && (
                      <span style={{ marginLeft: '6px', fontSize: '14px', opacity: 0.85, display: "flex", alignItems: "center"}}>
                        <Image
                          src={`/assets/ranks/${getEloClass(prevElo ?? 0)}.png`}
                          alt={getEloClass(prevElo ?? 0)}
                          style={{
                            verticalAlign: 'middle'
                          }}
                          width='24'
                          height='24'
                        />
                        <span className={getEloClass(prevElo ?? 0)}>{getEloTitle(prevElo ?? 0)}</span>
                        <div className="ml-1 mr-0.5 text-white">{" → "}</div>
                        <Image
                          src={`/assets/ranks/${getEloClass(c.elo ?? 0)}.png`}
                          alt={getEloClass(c.elo ?? 0)}
                          style={{
                            verticalAlign: 'middle'
                          }}
                          width='24'
                          height='24'
                        />
                        <span className={getEloClass(c.elo)}>{getEloTitle(c.elo)}</span>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <p style={{marginTop: 30, fontSize: 20}}>Codeforces rating: <strong style={{color: getCFEloColor(Number(cfElo))}}>{handle} ({cfElo})</strong></p>

          <div style={{ marginTop: '20px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                maxWidth: '220px',
                marginBottom: '10px',
              }}
            >
              <h3 style={{ margin: 0, marginRight: '10px' }}>Current rank:</h3>
              <Image
                src={`/assets/ranks/${getEloClass(elo)}.png`}
                alt={`Current rank ${elo}`}
                style={{ transform: 'translateY(-2px)' }}
                width='80'
                height='80'
              />
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                maxWidth: '220px',
                marginTop: '8px',
              }}
            >
              <h3 style={{ margin: 0, marginRight: '10px' }}>Peak rank:</h3>
              <Image
                src={`/assets/ranks/${getEloClass(maxElo)}.png`}
                alt={`Peak rank ${maxElo}`}
                style={{transform: 'translateY(-2px)'}}
                width='80'
                height='80'
              />
            </div>
          </div>

        {contestHistory.length > 0 && (
          <Line
            data={chartData}
            options={options}
          />
        )}

        <div style={{ marginTop: "30px" }}>
          <h2 style={{ marginBottom: "10px" }}>Solved Problems (Estimate Problem Solving Elo: {userElo})</h2>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            {solvedElos.map(({ id, elo }) => (
            <Link
              href={`/problems?id=${id}`}
              key={id}
              style={{
                padding: "8px 14px",
                borderRadius: "12px",
                backgroundColor: getEloColor(elo),
                color: "#000",
                fontWeight: "bold",
                fontSize: "14px",
                cursor: "pointer",
                boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
              }}  
              onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
              onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
            >
              #{id} <span style={{ opacity: 0.85 }}>({elo})</span>
            </Link>
          ))}

          <div style={{ width: '100%', maxWidth: '100%', height: 300, marginTop: '30px', overflowX: 'hidden' }}>
            <h3>Solved Elo Distribution</h3>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={eloDistribution} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <XAxis dataKey="range" interval={0} angle={-45} textAnchor="end" height={60} tick={{ fontSize: 12, fill: '#fff' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#fff' }} />
                <Bar dataKey="count">
                  {eloDistribution.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>


          </div>
        </div>

      </div>

      
    );
  }