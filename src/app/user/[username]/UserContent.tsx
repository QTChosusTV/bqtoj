'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
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
  TooltipItem,
} from 'chart.js';
import type { ChartOptions, Chart } from 'chart.js';
import 'chartjs-adapter-date-fns';
import 'katex/dist/katex.min.css';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip as RechartsTooltip } from 'recharts';
import { ArrowRight, ExternalLink, Settings } from 'lucide-react';

import { supabase } from '@/utils/supabaseClient';
import { getDisplayedElo } from '@/utils/eloAccumulation';
import { getEloClass, getEloColor } from '@/utils/eloDisplay';
import { useAuth } from '@/context/AuthContext';
import MarkdownRenderer from '@/components/renderer/MarkdownRenderer';
import UserAvatar from '@/components/UserAvatar';
import './user.css';

interface Contest {
  contestId: number;
  name: string;
  date: string;
  rank: number;
  elo: number;
}

type EloEstimate = {
  elo: number;
  sd: number;
};

type Solved = { id: number; elo: number };

const Line = dynamic(() => import('react-chartjs-2').then((m) => m.Line), {
  ssr: false,
});

function estimateUserElo(
  solvedElos: number[],
  priorMean = 800,
  priorSd = 300,
  scale = 400,
  maxIter = 200,
  tol = 1e-7
): EloEstimate {
  if (!solvedElos || solvedElos.length === 0) {
    throw new Error('solvedElos must be a non-empty array');
  }

  const ln10 = Math.log(10);
  let theta = solvedElos.reduce((a, b) => a + b, 0) / solvedElos.length;
  let h = -1 / (priorSd * priorSd);

  for (let it = 0; it < maxIter; it++) {
    let gLike = 0;
    let hLike = 0;

    for (const beta of solvedElos) {
      const t = Math.pow(10, (beta - theta) / scale);
      const p = 1 / (1 + t);
      gLike += (ln10 / scale) * (1 - p);
      hLike += -Math.pow(ln10 / scale, 2) * p * (1 - p);
    }

    const gPrior = -(theta - priorMean) / (priorSd * priorSd);
    const hPrior = -1 / (priorSd * priorSd);

    const g = gLike + gPrior;
    h = hLike + hPrior;

    const step = g / h;
    const thetaNew = theta - step;

    if (Math.abs(thetaNew - theta) < tol) {
      theta = thetaNew;
      break;
    }
    theta = thetaNew;
  }

  const postVar = -1 / h;
  const postSd = Math.sqrt(Math.max(postVar, 0));
  return { elo: theta, sd: postSd };
}

const gradientBackgroundPlugin = {
  id: 'gradientBackground',
  beforeDraw(chart: Chart) {
    const {
      ctx,
      chartArea: { top, bottom, left, right },
      scales: { y },
    } = chart;
    const gradient = ctx.createLinearGradient(0, bottom, 0, top);
    const chartYMin = y.min;
    const chartYMax = y.max;
    const yRange = chartYMax - chartYMin;
    if (yRange <= 0) return;

    const transitionWidth = 26;
    const eloRanges = [
      { start: 0, end: 400, color: '#ffffff' },
      { start: 400, end: 800 - transitionWidth / 2, color: '#aaaaaa' },
      { start: 800, end: 1200 - transitionWidth / 2, color: '#aa5500' },
      { start: 1200, end: 1400 - transitionWidth / 2, color: '#00aa00' },
      { start: 1400, end: 1500 - transitionWidth / 2, color: '#00aaaa' },
      { start: 1500, end: 1600 - transitionWidth / 2, color: '#4bdbff' },
      { start: 1600, end: 1750 - transitionWidth / 2, color: '#55aaff' },
      { start: 1750, end: 1900 - transitionWidth / 2, color: '#7900fa' },
      { start: 1900, end: 2100 - transitionWidth / 2, color: '#aa00aa' },
      { start: 2100, end: 2300 - transitionWidth / 2, color: '#fbff00' },
      { start: 2300, end: 2500 - transitionWidth / 2, color: '#ffaa00' },
      { start: 2500, end: 2700 - transitionWidth / 2, color: '#ff7575' },
      { start: 2700, end: 3000 - transitionWidth / 2, color: '#ff0000' },
      { start: 3000, end: 9999999, color: '#8b0000' },
    ];

    const points: { elo: number; color: string }[] = [];

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
  },
};

const getEloTitle = (elo: number) => {
  if (elo >= 3000) return 'Legendary master';
  if (elo >= 2700) return 'Grandmaster';
  if (elo >= 2500) return 'International master';
  if (elo >= 2300) return 'National master';
  if (elo >= 2100) return 'Master';
  if (elo >= 1900) return 'Candidate master';
  if (elo >= 1750) return 'Semi master';
  if (elo >= 1600) return 'Expert';
  if (elo >= 1500) return 'Semi expert';
  if (elo >= 1400) return 'Specialist';
  if (elo >= 1200) return 'Pupil';
  if (elo >= 800) return 'Newbie';
  if (elo >= 400) return 'Beginner';
  if (elo > 0) return 'Initiate';
  return 'Unranked';
};

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
  return '#e4e4e7';
};

const getRatingChangeColor = (ratingChange: number) => {
  const maxChange = 500;
  const absChange = Math.abs(ratingChange);
  const lightness = 70 - (absChange / maxChange) * 40;
  const clampedLightness = Math.max(35, Math.min(70, lightness));
  return ratingChange >= 0
    ? `hsl(135, 75%, ${clampedLightness}%)`
    : `hsl(0, 80%, ${clampedLightness}%)`;
};

function getChipTextColor(hex: string): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return '#000000';
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.52 ? '#09090b' : '#fafafa';
}

export default function UserPage() {
  const { username: paramUsername } = useParams<{ username: string }>();
  const { username: loggedInUsername } = useAuth();
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [contestHistory, setHistory] = useState<Contest[]>([]);
  const [elo, setElo] = useState(0);
  const [solvedElos, setSolvedElos] = useState<Solved[]>([]);
  const [userElo, setUserElo] = useState<number | null>(null);
  const [handle, setHandle] = useState('');
  const [cfElo, setCFElo] = useState('');
  const [desc, setDesc] = useState('');
  const [yBounds, setYBounds] = useState<{ min: number; max: number } | null>(null);
  const [chartReady, setChartReady] = useState(false);

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
      setChartReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!contestHistory.length || yBounds !== null) return;

    const eloValues = contestHistory.map((c) => c.elo);
    const padding = contestHistory.length === 1 ? 250 : 100;
    const minElo = Math.min(...eloValues);
    const maxElo = Math.max(...eloValues);

    setYBounds({
      min: Math.max(0, Math.floor((minElo - padding) / 10) * 10),
      max: Math.ceil((maxElo + padding) / 10) * 10,
    });
  }, [contestHistory, yBounds]);

  useEffect(() => {
    if (!paramUsername) return;
    const uname = decodeURIComponent(paramUsername);
    let active = true;

    setUsername(uname);
    setAvatarUrl('');
    setDesc('');
    setHandle('');
    setCFElo('');
    setHistory([]);
    setElo(0);
    setYBounds(null);

    async function loadProfile() {
      const [lbRes, userRes] = await Promise.all([
        supabase
          .from('leaderboard')
          .select('elo, history')
          .eq('username', uname)
          .maybeSingle(),
        supabase
          .from('public_users')
          .select('desc, codeforces_handle, avatar_url')
          .eq('username', uname)
          .maybeSingle(),
      ]);

      if (!active) return;

      if (lbRes.data?.history) {
        const rawHistory = lbRes.data.history as Contest[];
        const displayedHistory = rawHistory.map((c, i) => ({
          ...c,
          elo: getDisplayedElo(c.elo, i + 1),
        }));
        setHistory(displayedHistory);
        setElo(displayedHistory.at(-1)?.elo ?? 0);
      }

      if (userRes.data) {
        setDesc(userRes.data.desc ?? '');
        setAvatarUrl(userRes.data.avatar_url ?? '');

        const cfHandle = userRes.data.codeforces_handle ?? '';
        setHandle(cfHandle);

        if (cfHandle) {
          try {
            const res = await fetch(
              `https://codeforces.com/api/user.info?handles=${encodeURIComponent(cfHandle)}`
            );
            const json = await res.json();
            if (!active) return;
            if (json.status === 'OK' && json.result?.length > 0) {
              setCFElo(String(json.result[0].rating || 'Unrated'));
            } else {
              setCFElo('Unrated');
            }
          } catch {
            if (active) setCFElo('Unavailable');
          }
        }
      }
    }

    loadProfile();
    return () => {
      active = false;
    };
  }, [paramUsername]);

  useEffect(() => {
    if (!username) return;
    let active = true;

    async function fetchSolved() {
      const [{ data: subs }, { data: probs }] = await Promise.all([
        supabase
          .from('public_submissions')
          .select('problem_id')
          .eq('username', username)
          .eq('overall', 'Accepted')
          .lt('problem_id', 1_000_000_000),
        supabase.from('problems').select('id, difficulty'),
      ]);

      if (!active || !subs || !probs) return;

      const probMap = new Map(probs.map((p) => [p.id, p.difficulty ?? 0]));
      const solved = [...new Set(subs.map((s) => s.problem_id))]
        .map((id) => ({ id, elo: probMap.get(id) ?? 0 }))
        .sort((a, b) => a.elo - b.elo);

      setSolvedElos(solved);

      if (solved.length > 0) {
        try {
          const estimate = estimateUserElo(solved.map((s) => s.elo));
          setUserElo(Math.round(estimate.elo + estimate.sd));
        } catch {
          setUserElo(null);
        }
      } else {
        setUserElo(null);
      }
    }

    fetchSolved();
    return () => {
      active = false;
    };
  }, [username]);

  const maxElo = useMemo(
    () => (contestHistory.length > 0 ? Math.max(...contestHistory.map((c) => c.elo)) : 0),
    [contestHistory]
  );

  const bestRank = useMemo(
    () => (contestHistory.length > 0 ? Math.min(...contestHistory.map((c) => c.rank)) : null),
    [contestHistory]
  );

  const historyRows = useMemo(() => {
    return contestHistory
      .map((c, i) => {
        const prevElo = i > 0 ? contestHistory[i - 1].elo : null;
        const change = prevElo === null ? c.elo : c.elo - prevElo;
        return { ...c, prevElo, change };
      })
      .reverse();
  }, [contestHistory]);

  const eloDistribution = useMemo(() => {
    const bins: { range: string; count: number; color: string }[] = [];
    for (let start = 400; start <= 3000; start += 100) {
      const count = solvedElos.filter((s) => s.elo >= start && s.elo < start + 100).length;
      bins.push({
        range: `${start}`,
        count,
        color: getEloColor(start),
      });
    }
    return bins;
  }, [solvedElos]);

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: 8 },
    animation: false,
    onHover: (event, elements) => {
      const target = event?.native?.target as HTMLElement | undefined;
      if (target) target.style.cursor = elements.length ? 'pointer' : 'default';
    },
    onClick: (_event, elements) => {
      if (!elements.length) return;
      const contest = contestHistory[elements[0].index];
      if (contest) router.push(`/contest/${contest.contestId}`);
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: TooltipItem<'line'>) => {
            const c = contestHistory[ctx.dataIndex];
            if (!c) return '';
            return [
              `Contest: ${c.name}`,
              `Date: ${c.date}`,
              `Rank: #${c.rank}`,
              `Elo: ${c.elo}`,
            ];
          },
        },
      },
      zoom: {
        pan: { enabled: true, mode: 'x', modifierKey: 'shift' },
        zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' },
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
        ticks: { color: '#d4d4d8', autoSkip: true, maxRotation: 0 },
        grid: { color: 'rgba(255,255,255,0.12)' },
      },
      y: {
        ticks: { color: '#d4d4d8' },
        grid: { color: 'rgba(255,255,255,0.12)' },
        min: yBounds?.min,
        max: yBounds?.max,
      },
    },
  };

  const chartData = {
    datasets: [
      {
        label: 'Elo Rating',
        data: contestHistory.map((c) => ({ x: c.date, y: c.elo })),
        borderColor: '#f5c542',
        borderWidth: 2,
        pointBackgroundColor: contestHistory.map((c) => getEloColor(c.elo)),
        pointBorderColor: '#18181b',
        pointBorderWidth: 1.5,
        pointRadius: 4.5,
        pointHoverRadius: 6,
        tension: 0,
        fill: false,
      },
    ],
  };

  const eloClass = getEloClass(elo);
  const peakClass = getEloClass(maxElo);
  const isOwnProfile = Boolean(loggedInUsername && loggedInUsername === username);

  return (
    <main className="max-w-7xl mx-auto px-5 py-6 text-zinc-100 space-y-6">
      {/* Header Strip */}
      <header className="bg-[#111111] border border-zinc-800 rounded-lg p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <UserAvatar username={username} avatarUrl={avatarUrl} size={76} />

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Image
                src={`/assets/ranks/${eloClass}.png`}
                alt={getEloTitle(elo)}
                width={28}
                height={28}
                className="shrink-0"
              />
              <h1 className={`text-2xl font-bold truncate ${eloClass}`}>
                {username}
              </h1>
              <span className="text-lg font-semibold tabular-nums text-zinc-200">
                ({elo})
              </span>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className={`font-medium ${eloClass}`}>{getEloTitle(elo)}</span>
              <span className="text-zinc-500">·</span>
              <span className="text-zinc-300 tabular-nums">
                {solvedElos.length} solved
              </span>
              <span className="text-zinc-500">·</span>
              <span className="text-zinc-300 tabular-nums">
                {contestHistory.length} {contestHistory.length === 1 ? 'contest' : 'contests'}
              </span>
            </div>
          </div>
        </div>

        {isOwnProfile && (
          <Link
            href="/settings"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-md border border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 transition-colors duration-150 motion-reduce:transition-none"
          >
            <Settings className="w-4 h-4" />
            Edit settings
          </Link>
        )}
      </header>

      {/* Bio (only shown when non-empty) */}
      {desc.trim().length > 0 && (
        <section className="bg-[#111111] border border-zinc-800 rounded-lg px-5 py-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
            About
          </h2>
          <div className="text-sm leading-relaxed text-zinc-200">
            <MarkdownRenderer content={desc} />
          </div>
        </section>
      )}

      {/* Main 70% / 30% Asymmetric Grid: Rating Graph + Rank/Stats Rail */}
      <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] gap-5 items-stretch">
        {/* 70% Left: Rating Graph */}
        <div className="bg-[#111111] border border-zinc-800 rounded-lg p-5 flex flex-col">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
            <h2 className="text-base font-semibold text-zinc-100">Rating Progression</h2>
            {contestHistory.length > 0 && (
              <span className="text-xs text-zinc-400">
                Scroll to zoom · Shift+drag to pan · Click a point for contest
              </span>
            )}
          </div>

          {contestHistory.length > 0 && chartReady ? (
            <div className="relative w-full h-[320px]">
              <Line data={chartData} options={options} />
            </div>
          ) : (
            <div className="h-[320px] flex items-center justify-center border border-dashed border-zinc-800 rounded-md text-sm text-zinc-400">
              No rated contests yet.
            </div>
          )}
        </div>

        {/* 30% Right: Rank Badges & Metrics */}
        <aside className="bg-[#111111] border border-zinc-800 rounded-lg p-5 flex flex-col justify-between gap-5">
          {/* Current vs Peak Rank */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-md bg-zinc-950 border border-zinc-800 flex flex-col items-center text-center">
              <span className="text-xs text-zinc-400 mb-2">Current Rank</span>
              <Image
                src={`/assets/ranks/${eloClass}.png`}
                alt={`Current rank ${getEloTitle(elo)}`}
                width={56}
                height={56}
              />
              <span className={`mt-2 text-sm font-bold tabular-nums ${eloClass}`}>
                {elo}
              </span>
              <span className="text-xs text-zinc-300 truncate max-w-full">
                {getEloTitle(elo)}
              </span>
            </div>

            <div className="p-3 rounded-md bg-zinc-950 border border-zinc-800 flex flex-col items-center text-center">
              <span className="text-xs text-zinc-400 mb-2">Peak Rank</span>
              <Image
                src={`/assets/ranks/${peakClass}.png`}
                alt={`Peak rank ${getEloTitle(maxElo)}`}
                width={56}
                height={56}
              />
              <span className={`mt-2 text-sm font-bold tabular-nums ${peakClass}`}>
                {maxElo}
              </span>
              <span className="text-xs text-zinc-300 truncate max-w-full">
                {getEloTitle(maxElo)}
              </span>
            </div>
          </div>

          {/* Key Stats List */}
          <dl className="divide-y divide-zinc-800 text-sm">
            <div className="py-2.5 flex items-center justify-between gap-2">
              <dt className="text-zinc-400">Est. Solving Elo</dt>
              <dd className={`font-semibold tabular-nums ${userElo ? getEloClass(userElo) : 'text-zinc-400'}`}>
                {userElo ?? '—'}
              </dd>
            </div>

            <div className="py-2.5 flex items-center justify-between gap-2">
              <dt className="text-zinc-400">Best Rank</dt>
              <dd className="font-semibold tabular-nums text-zinc-100">
                {bestRank !== null ? `#${bestRank}` : '—'}
              </dd>
            </div>

            <div className="py-2.5 flex items-center justify-between gap-2">
              <dt className="text-zinc-400">Problems Solved</dt>
              <dd className="font-semibold tabular-nums text-zinc-100">
                {solvedElos.length}
              </dd>
            </div>

            <div className="pt-2.5 flex items-center justify-between gap-2">
              <dt className="text-zinc-400">Codeforces</dt>
              <dd className="text-right min-w-0">
                {handle ? (
                  <a
                    href={`https://codeforces.com/profile/${encodeURIComponent(handle)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold hover:underline truncate"
                    style={{ color: getCFEloColor(Number(cfElo)) }}
                  >
                    {handle}
                    {cfElo && <span className="tabular-nums">({cfElo})</span>}
                    <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-75" />
                  </a>
                ) : (
                  <span className="text-zinc-500">Not linked</span>
                )}
              </dd>
            </div>
          </dl>
        </aside>
      </section>

      {/* Contest History Table */}
      {historyRows.length > 0 && (
        <section className="bg-[#111111] border border-zinc-800 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-100">Contest History</h2>
            <span className="text-xs text-zinc-400 tabular-nums">
              Newest first · {historyRows.length} total
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950/60 text-xs uppercase tracking-wider text-zinc-400">
                  <th className="py-3 px-5 font-medium">Contest</th>
                  <th className="py-3 px-4 font-medium">Date</th>
                  <th className="py-3 px-4 font-medium">Rank</th>
                  <th className="py-3 px-4 font-medium">Elo</th>
                  <th className="py-3 px-5 font-medium">Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80">
                {historyRows.map((c) => {
                  const color = getRatingChangeColor(c.change);
                  const tierChanged = getEloClass(c.elo) !== getEloClass(c.prevElo ?? 0);
                  const rankTone =
                    c.rank === 1
                      ? 'text-yellow-400 font-bold'
                      : c.rank === 2
                      ? 'text-zinc-200 font-bold'
                      : c.rank === 3
                      ? 'text-amber-500 font-bold'
                      : 'text-zinc-300';

                  return (
                    <tr
                      key={c.contestId}
                      className="hover:bg-zinc-900/60 transition-colors duration-150 motion-reduce:transition-none"
                    >
                      <td className="py-3 px-5 font-medium text-zinc-100">
                        <Link
                          href={`/contest/${encodeURIComponent(c.contestId)}`}
                          prefetch={false}
                          className="hover:underline"
                        >
                          {c.name}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-zinc-400 tabular-nums whitespace-nowrap">
                        {c.date}
                      </td>
                      <td className={`py-3 px-4 tabular-nums whitespace-nowrap ${rankTone}`}>
                        #{c.rank}
                      </td>
                      <td className={`py-3 px-4 font-bold tabular-nums whitespace-nowrap ${getEloClass(c.elo)}`}>
                        {c.elo}
                      </td>
                      <td className="py-3 px-5 whitespace-nowrap">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="font-bold tabular-nums" style={{ color }}>
                            {c.change >= 0 ? `+${c.change}` : c.change}
                          </span>

                          {tierChanged && (
                            <span className="inline-flex items-center gap-1.5 text-xs bg-zinc-950 border border-zinc-800 px-2 py-0.5 rounded-md">
                              <Image
                                src={`/assets/ranks/${getEloClass(c.prevElo ?? 0)}.png`}
                                alt={getEloTitle(c.prevElo ?? 0)}
                                width={16}
                                height={16}
                              />
                              <span className={getEloClass(c.prevElo ?? 0)}>
                                {getEloTitle(c.prevElo ?? 0)}
                              </span>
                              <ArrowRight className="w-3 h-3 text-zinc-400" />
                              <Image
                                src={`/assets/ranks/${getEloClass(c.elo)}.png`}
                                alt={getEloTitle(c.elo)}
                                width={16}
                                height={16}
                              />
                              <span className={getEloClass(c.elo)}>
                                {getEloTitle(c.elo)}
                              </span>
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Solved Problems & Difficulty Distribution */}
      <section className="bg-[#111111] border border-zinc-800 rounded-lg p-5 space-y-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-zinc-100">
            Solved Problems ({solvedElos.length})
          </h2>
          {userElo !== null && (
            <span className="text-sm text-zinc-300">
              Estimated solving Elo:{' '}
              <strong className={`tabular-nums ${getEloClass(userElo)}`}>{userElo}</strong>
            </span>
          )}
        </div>

        {/* Difficulty Bar Chart */}
        {solvedElos.length > 0 && (
          <div className="w-full h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={eloDistribution} margin={{ top: 8, right: 12, left: -16, bottom: 12 }}>
                <XAxis
                  dataKey="range"
                  interval={0}
                  angle={-45}
                  textAnchor="end"
                  height={48}
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
                <RechartsTooltip
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  contentStyle={{
                    backgroundColor: '#09090b',
                    border: '1px solid #27272a',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: '#f4f4f5',
                  }}
                />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                  {eloDistribution.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Problem Chips */}
        {solvedElos.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {solvedElos.map(({ id, elo: probElo }) => {
              const bg = getEloColor(probElo);
              const fg = getChipTextColor(bg);
              return (
                <Link
                  href={`/problems/${id}`}
                  key={id}
                  style={{ backgroundColor: bg, color: fg }}
                  className="px-2.5 py-1 rounded-md text-xs font-semibold tabular-nums hover:underline transition-opacity duration-150 hover:opacity-90 motion-reduce:transition-none"
                >
                  #{id} <span className="opacity-80">({probElo})</span>
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-zinc-400">No accepted problems yet.</p>
        )}
      </section>
    </main>
  );
}