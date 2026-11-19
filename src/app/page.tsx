'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Settings } from 'lucide-react';
import { supabase } from '@/utils/supabaseClient';
import { getDisplayedElo } from '@/utils/eloAccumulation';
import { ELO_TIERS, getEloClass, getEloColor } from '@/utils/eloDisplay';
import { useAuth } from '@/context/AuthContext';
import UserAvatar from '@/components/UserAvatar';

type Contest = {
  id: number;
  name: string | null;
  time_start: string | null;
  time_end: string | null;
  elo_min: number | null;
  elo_max: number | null;
  link: string | null;
};

type LeaderboardUser = {
  username: string;
  elo: number;
  displayElo: number;
  avatarUrl: string;
};

type TopACUser = {
  username: string;
  count: number;
  elo: number;
  avatarUrl: string;
};

function RankRow({
  rank,
  username,
  avatarUrl,
  valueLabel,
  eloForIcon,
}: {
  rank: number;
  username: string;
  avatarUrl: string;
  valueLabel: string;
  eloForIcon: number;
}) {
  const eloClass = getEloClass(eloForIcon);
  const rankTone =
    rank === 1
      ? 'text-yellow-400 font-bold'
      : rank === 2
      ? 'text-zinc-200 font-bold'
      : rank === 3
      ? 'text-amber-500 font-bold'
      : 'text-zinc-400';

  return (
    <Link
      href={`/user/${encodeURIComponent(username)}`}
      prefetch={false}
      className="grid grid-cols-[24px_26px_20px_1fr_auto] items-center gap-2 px-2 py-1.5 rounded-md hover:bg-zinc-900 transition-colors duration-150 motion-reduce:transition-none"
    >
      <span className={`text-xs text-center tabular-nums ${rankTone}`}>
        {rank}
      </span>
      <UserAvatar username={username} avatarUrl={avatarUrl} size={24} />
      <Image
        src={`/assets/ranks/${eloClass}.png`}
        alt={eloClass}
        width={18}
        height={18}
        style={{ imageRendering: 'pixelated' }}
      />
      <span
        className="text-sm font-medium truncate"
        style={{ color: getEloColor(eloForIcon) }}
      >
        {username}
      </span>
      <span
        className="text-sm font-semibold tabular-nums text-right"
        style={{ color: getEloColor(eloForIcon) }}
      >
        {valueLabel}
      </span>
    </Link>
  );
}

function formatTimeLeft(toTime: string | null, nowMs: number): string {
  if (!toTime) return '';
  const ms = new Date(toTime).getTime() - nowMs;
  if (ms <= 0) return '0s';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  return `${d > 0 ? `${d}d ` : ''}${h % 24}h ${m % 60}m ${s % 60}s`;
}

export default function HomePage() {
  const { username, email } = useAuth();

  const [upcoming, setUpcoming] = useState<Contest[]>([]);
  const [ongoing, setOngoing] = useState<Contest[]>([]);
  const [past, setPast] = useState<Contest[]>([]);
  const [elo, setElo] = useState<number>(0);
  const [myAvatarUrl, setMyAvatarUrl] = useState<string>('');
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [topRanking, setTopRanking] = useState<LeaderboardUser[]>([]);
  const [topAC, setTopAC] = useState<TopACUser[]>([]);
  const [loadingRankings, setLoadingRankings] = useState(true);

  const sortedTiers = useMemo(
    () => ELO_TIERS.slice().sort((a, b) => a.min - b.min),
    []
  );

  // Only tick every second when a live or upcoming countdown exists
  useEffect(() => {
    if (ongoing.length === 0 && upcoming.length === 0) return;
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [ongoing.length, upcoming.length]);

  // Fetch contests
  useEffect(() => {
    let active = true;
    async function loadContests() {
      const { data } = await supabase
        .from('contests')
        .select('*')
        .order('time_start', { ascending: true })
        .limit(20);

      if (!active || !data) return;

      const nowIso = new Date().toISOString();
      const up: Contest[] = [];
      const on: Contest[] = [];
      const pa: Contest[] = [];

      for (const c of data as Contest[]) {
        if (c.time_start && c.time_start > nowIso) up.push(c);
        else if (c.time_end && c.time_end >= nowIso) on.push(c);
        else pa.push(c);
      }

      setUpcoming(up);
      setOngoing(on);
      setPast(
        pa
          .sort(
            (a, b) =>
              new Date(b.time_end ?? 0).getTime() -
              new Date(a.time_end ?? 0).getTime()
          )
          .slice(0, 6)
      );
    }
    loadContests();
    return () => {
      active = false;
    };
  }, []);

  // Fetch logged-in user Elo + avatar
  const loadMyProfile = useCallback(async () => {
    if (!username) {
      setElo(0);
      setMyAvatarUrl('');
      return;
    }

    const [lbRes, userRes] = await Promise.all([
      supabase
        .from('leaderboard')
        .select('elo, history')
        .eq('username', username)
        .maybeSingle(),
      supabase
        .from('public_users')
        .select('avatar_url')
        .eq('username', username)
        .maybeSingle(),
    ]);

    if (lbRes.data) {
      setElo(getDisplayedElo(lbRes.data.elo, lbRes.data.history?.length ?? 0));
    }
    setMyAvatarUrl(userRes.data?.avatar_url ?? '');
  }, [username]);

  useEffect(() => {
    loadMyProfile();
  }, [loadMyProfile]);

  useEffect(() => {
    const onUpdated = () => loadMyProfile();
    window.addEventListener('bqt-profile-updated', onUpdated);
    return () => window.removeEventListener('bqt-profile-updated', onUpdated);
  }, [loadMyProfile]);

  // Fetch Top Ranking (5+ contests) + Top AC this month + their avatars
  useEffect(() => {
    let active = true;

    async function loadLeaderboards() {
      setLoadingRankings(true);

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

      const [rankRes, subsRes] = await Promise.all([
        supabase
          .from('leaderboard')
          .select('username, elo, history')
          .order('elo', { ascending: false })
          .limit(50),
        supabase
          .from('public_submissions')
          .select('username, problem_id')
          .eq('overall', 'Accepted')
          .lt('problem_id', 1_000_000_000)
          .gte('created_at', monthStart)
          .lt('created_at', monthEnd),
      ]);

      if (!active) return;

      const trustedTop = (rankRes.data ?? [])
        .filter((u) => (u.history?.length ?? 0) >= 5)
        .slice(0, 7);

      const solvedMap: Record<string, Set<number>> = {};
      for (const row of subsRes.data ?? []) {
        if (!solvedMap[row.username]) solvedMap[row.username] = new Set();
        solvedMap[row.username].add(row.problem_id);
      }

      const acSorted = Object.entries(solvedMap)
        .map(([u, set]) => ({ username: u, count: set.size }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 7);

      const allUsernames = Array.from(
        new Set([
          ...trustedTop.map((u) => u.username),
          ...acSorted.map((u) => u.username),
        ])
      );

      const acNames = acSorted.map((u) => u.username);

      const [avatarsRes, acLbRes] = await Promise.all([
        allUsernames.length > 0
          ? supabase
              .from('public_users')
              .select('username, avatar_url')
              .in('username', allUsernames)
          : Promise.resolve({ data: null }),
        acNames.length > 0
          ? supabase
              .from('leaderboard')
              .select('username, elo, history')
              .in('username', acNames)
          : Promise.resolve({ data: null }),
      ]);

      if (!active) return;

      const avatarLookup: Record<string, string> = {};
      avatarsRes.data?.forEach((u) => {
        if (u.username) avatarLookup[u.username] = u.avatar_url ?? '';
      });

      const acEloLookup: Record<string, number> = {};
      acLbRes.data?.forEach((u) => {
        acEloLookup[u.username] = getDisplayedElo(u.elo, u.history?.length ?? 0);
      });

      setTopRanking(
        trustedTop.map((u) => ({
          username: u.username,
          elo: u.elo,
          displayElo: u.elo,
          avatarUrl: avatarLookup[u.username] ?? '',
        }))
      );

      setTopAC(
        acSorted.map((s) => ({
          username: s.username,
          count: s.count,
          elo: acEloLookup[s.username] ?? 0,
          avatarUrl: avatarLookup[s.username] ?? '',
        }))
      );

      setLoadingRankings(false);
    }

    loadLeaderboards();
    return () => {
      active = false;
    };
  }, []);

  const monthLabel = new Date().toLocaleString('en-US', { month: 'long' });

  const renderContestCard = (
    contest: Contest,
    type: 'upcoming' | 'ongoing' | 'past'
  ) => {
    const eloMin = contest.elo_min ?? 0;
    const eloMax = contest.elo_max ?? 9999;
    const timeLeft =
      type === 'upcoming'
        ? formatTimeLeft(contest.time_start, nowMs)
        : type === 'ongoing'
        ? formatTimeLeft(contest.time_end, nowMs)
        : '';

    const iconsInRange = sortedTiers.filter(
      (r) => r.min >= eloMin && r.min <= eloMax
    );

    const href = contest.link || `/contest/${contest.id}`;

    return (
      <Link
        key={contest.id}
        href={href}
        prefetch={false}
        className={`block rounded-lg border px-4 py-3.5 transition-colors duration-150 motion-reduce:transition-none ${
          type === 'ongoing'
            ? 'bg-emerald-950/20 border-emerald-800/70 hover:border-emerald-600/80'
            : 'bg-[#111111] border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/60'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[15px] font-semibold text-zinc-100 truncate">
              {contest.name ?? 'Unnamed Contest'}
            </div>
            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-zinc-400 mr-1">Rated:</span>
              {iconsInRange.map((rank) => (
                <Image
                  key={rank.class}
                  src={`/assets/ranks/${rank.class}.png`}
                  alt={rank.class}
                  width={20}
                  height={20}
                />
              ))}
            </div>
          </div>

          {timeLeft && (
            <span
              className={`text-xs font-medium px-2.5 py-1 rounded-md border tabular-nums shrink-0 ${
                type === 'ongoing'
                  ? 'bg-emerald-950/70 text-emerald-300 border-emerald-700/80'
                  : 'bg-zinc-950 text-zinc-300 border-zinc-700'
              }`}
            >
              {type === 'ongoing' ? `Ends in ${timeLeft}` : `Starts in ${timeLeft}`}
            </span>
          )}
        </div>
      </Link>
    );
  };

  // Guest gate
  if (!email) {
    return (
      <main className="max-w-xl mx-auto px-6 py-16 text-zinc-100">
        <div className="bg-[#111111] border border-zinc-800 rounded-lg p-8">
          <div className="flex items-center gap-3 mb-5">
            <Image
              src="/assets/web-icon.png"
              alt="BQTOJ"
              width={40}
              height={40}
              className="rounded-lg shrink-0"
            />
            <div>
              <h1 className="text-xl font-bold tracking-tight text-zinc-50">
                BanhQuyTeam Online Judge
              </h1>
              <p className="text-xs text-zinc-400">
                Competitive programming training &amp; rated contests
              </p>
            </div>
          </div>

          <p className="text-sm text-zinc-300 leading-relaxed mb-6">
            Sign in to submit C++ and Python solutions, join live rated contests, and track your Elo progression across problem sets.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-medium rounded-md bg-zinc-100 text-zinc-950 hover:bg-zinc-200 transition-colors duration-150 motion-reduce:transition-none"
            >
              Log in
            </Link>
            <Link
              href="/register"
              className="text-sm font-medium text-zinc-300 hover:text-zinc-50 underline underline-offset-4 transition-colors duration-150 motion-reduce:transition-none"
            >
              Create an account
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const eloClass = getEloClass(elo);

  return (
    <main className="max-w-7xl mx-auto px-5 py-6 text-zinc-100 space-y-6">
      {/* Top User Strip */}
      <header className="bg-[#111111] border border-zinc-800 rounded-lg p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <Link
            href={username ? `/user/${encodeURIComponent(username)}` : '/settings'}
            prefetch={false}
            className="shrink-0"
          >
            <UserAvatar
              username={username || email}
              avatarUrl={myAvatarUrl}
              size={48}
            />
          </Link>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Image
                src={`/assets/ranks/${eloClass}.png`}
                alt={eloClass}
                width={20}
                height={20}
                className="shrink-0"
              />
              <Link
                href={username ? `/user/${encodeURIComponent(username)}` : '/settings'}
                prefetch={false}
                className={`text-base font-bold hover:underline truncate ${eloClass}`}
              >
                {username}
              </Link>
              <span className="text-sm font-semibold tabular-nums text-zinc-300">
                ({elo})
              </span>
            </div>
            <p className="text-xs text-zinc-400 truncate mt-0.5">{email}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/problemset"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md bg-zinc-100 text-zinc-950 hover:bg-zinc-200 transition-colors duration-150 motion-reduce:transition-none"
          >
            Browse problems
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/settings"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md border border-zinc-700 bg-zinc-950 text-zinc-200 hover:bg-zinc-900 transition-colors duration-150 motion-reduce:transition-none"
          >
            <Settings className="w-4 h-4" />
            Settings
          </Link>
        </div>
      </header>

      {/* Main Asymmetric Dashboard: Contests (left) + Rankings & Support (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
        {/* Left Column: Contests */}
        <div className="space-y-6 min-w-0">
          {ongoing.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-emerald-400">
                  Ongoing Contests
                </h2>
              </div>
              <div className="space-y-2.5">
                {ongoing.map((c) => renderContestCard(c, 'ongoing'))}
              </div>
            </section>
          )}

          {upcoming.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-200">
                  Upcoming Contests
                </h2>
              </div>
              <div className="space-y-2.5">
                {upcoming.map((c) => renderContestCard(c, 'upcoming'))}
              </div>
            </section>
          )}

          <section>
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">
                Past Contests
              </h2>
              <Link
                href="/contests/past/1"
                prefetch={false}
                className="inline-flex items-center gap-1 text-xs font-medium text-zinc-300 hover:text-zinc-50 underline underline-offset-4 transition-colors duration-150 motion-reduce:transition-none"
              >
                View archive
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {past.length === 0 ? (
              <p className="text-sm text-zinc-400 bg-[#111111] border border-zinc-800 rounded-lg p-4">
                No past contests recorded yet.
              </p>
            ) : (
              <div className="space-y-2.5">
                {past.map((c) => renderContestCard(c, 'past'))}
              </div>
            )}
          </section>
        </div>

        {/* Right Rail: Rankings + Support */}
        <aside className="space-y-5 min-w-0">
          {/* Top Ranking */}
          <section className="bg-[#111111] border border-zinc-800 rounded-lg p-4">
            <div className="flex items-baseline justify-between gap-2 pb-2.5 mb-2 border-b border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-100">
                Top Ranking (5+ Contests)
              </h2>
              <Link
                href="/leaderboard"
                prefetch={false}
                className="text-xs text-zinc-400 hover:text-zinc-100 underline underline-offset-4 transition-colors duration-150 motion-reduce:transition-none"
              >
                All
              </Link>
            </div>

            {loadingRankings ? (
              <p className="text-xs text-zinc-400 py-3">Loading...</p>
            ) : topRanking.length === 0 ? (
              <p className="text-xs text-zinc-400 py-3">No calibrated users yet.</p>
            ) : (
              <div className="space-y-0.5">
                {topRanking.map((u, i) => (
                  <RankRow
                    key={u.username}
                    rank={i + 1}
                    username={u.username}
                    avatarUrl={u.avatarUrl}
                    valueLabel={String(u.displayElo)}
                    eloForIcon={u.displayElo}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Top AC This Month */}
          <section className="bg-[#111111] border border-zinc-800 rounded-lg p-4">
            <div className="flex items-baseline justify-between gap-2 pb-2.5 mb-2 border-b border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-100">
                Top Solvers ({monthLabel})
              </h2>
              <span className="text-xs text-zinc-400">Solved</span>
            </div>

            {loadingRankings ? (
              <p className="text-xs text-zinc-400 py-3">Loading...</p>
            ) : topAC.length === 0 ? (
              <p className="text-xs text-zinc-400 py-3">No solves yet this month.</p>
            ) : (
              <div className="space-y-0.5">
                {topAC.map((u, i) => (
                  <RankRow
                    key={u.username}
                    rank={i + 1}
                    username={u.username}
                    avatarUrl={u.avatarUrl}
                    valueLabel={String(u.count)}
                    eloForIcon={u.elo}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Support BQTOJ */}
          <section className="bg-[#111111] border border-zinc-800 rounded-lg p-4">
            <div className="pb-2.5 mb-3 border-b border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-100">Support BQTOJ</h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Help keep the judge servers running.
              </p>
            </div>

            <div className="bg-white rounded-md p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-2">
                <span className="text-xs font-bold text-[#004a97] tracking-tight">
                  BIDV
                </span>
                <span className="text-[10px] text-[#004a97]">·</span>
                <span className="text-xs font-bold">
                  <span className="text-[#d0021b]">VIET</span>
                  <span className="text-[#00a651]">QR</span>
                </span>
              </div>

              <Image
                src="/assets/qr/MONEY.jpg"
                alt="BIDV VietQR donation code"
                width={156}
                height={156}
                className="rounded mx-auto mb-2.5 block"
              />

              <div className="text-xs font-bold text-zinc-900">
                TRAN QUANG THUAN
              </div>
              <div className="text-xs font-medium text-zinc-700 tabular-nums mt-0.5">
                8833202549
              </div>
              <div className="text-[10px] text-zinc-600 mt-1 leading-snug">
                Ngân hàng TMCP Đầu tư và Phát triển Việt Nam
              </div>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}