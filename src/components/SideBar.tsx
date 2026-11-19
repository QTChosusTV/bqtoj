'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Settings } from 'lucide-react'
import { supabase } from '@/utils/supabaseClient'
import { useAuth } from '@/context/AuthContext'
import { getDisplayedElo } from '@/utils/eloAccumulation'
import { getEloClass, getEloColor } from '@/utils/eloDisplay'
import AuthButtons from '@/components/layout_b'
import UserAvatar from '@/components/UserAvatar'

type HistoryEntry = {
  name: string
  elo: number
  date?: string
  contestId?: number
  rank?: number
}

const NAV_ITEMS = [
  {
    href: '/',
    label: 'Home',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 1.5L1 7h2v7h4v-4h2v4h4V7h2L8 1.5z" />
      </svg>
    ),
  },
  {
    href: '/problemset',
    label: 'Problems',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
        <path d="M3 2h10a1 1 0 011 1v1H2V3a1 1 0 011-1zM2 5h12v8a1 1 0 01-1 1H3a1 1 0 01-1-1V5zm3 2v1h6V7H5zm0 3v1h4v-1H5z" />
      </svg>
    ),
  },
  {
    href: '/contests/past/1',
    label: 'Contests',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 1a7 7 0 100 14A7 7 0 008 1zM7 4h2v4.5l3 1.8-1 1.7-3.5-2.1A1 1 0 017 9V4z" />
      </svg>
    ),
  },
  {
    href: '/leaderboard',
    label: 'Leaderboard',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 1l1.8 4.9H15l-4.1 3 1.6 4.9L8 11l-4.5 2.8 1.6-4.9L1 6h5.2L8 1z" />
      </svg>
    ),
  },
  {
    href: '/submissions',
    label: 'Submissions',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
        <path d="M2 2h12v2H2V2zm0 3h12v9H2V5zm2 2v5h8V7H4zm1 1h2v1H5V8zm0 2h4v1H5v-1z" />
      </svg>
    ),
  },
  {
    href: '/ide',
    label: 'Live IDE',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
        <path d="M2 2h12a1 1 0 011 1v10a1 1 0 01-1 1H2a1 1 0 01-1-1V3a1 1 0 011-1zm1 3v7h10V5H3zm2 1l2 2-2 2-.7-.7L6.6 8 4.3 5.7 5 5zm3 4h3v1H8v-1z" />
      </svg>
    ),
  },
  {
    href: '/chat',
    label: 'Chat',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
        <path d="M2 2h12a1 1 0 011 1v8a1 1 0 01-1 1H5l-3 3V3a1 1 0 011-1z" />
      </svg>
    ),
  },
  {
    href: '/blogs',
    label: 'Blogs',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
        <path d="M2 3h12v1H2V3zm0 3h8v1H2V6zm0 3h10v1H2V9zm0 3h6v1H2v-1z" />
      </svg>
    ),
  },
  {
    href: '/about',
    label: 'About',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 1a7 7 0 100 14A7 7 0 008 1zM7 5h2v2H7V5zm0 3h2v5H7V8z" />
      </svg>
    ),
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { username } = useAuth()
  const [elo, setElo] = useState<number>(0)
  const [avatarUrl, setAvatarUrl] = useState<string>('')
  const [delta, setDelta] = useState<number | null>(null)
  const [lastContest, setLastContest] = useState<string>('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const fetchUserData = useCallback(async () => {
    if (!username) {
      setElo(0)
      setAvatarUrl('')
      setDelta(null)
      setLastContest('')
      return
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
    ])

    setAvatarUrl(userRes.data?.avatar_url ?? '')

    const data = lbRes.data
    if (!data) return

    const history = (data.history ?? []) as HistoryEntry[]
    const count = history.length

    const displayed = getDisplayedElo(data.elo, count)
    setElo(displayed)

    if (count >= 2) {
      const last = history[count - 1]
      const prev = history[count - 2]

      const lastDisp = getDisplayedElo(last.elo, count)
      const prevDisp = getDisplayedElo(prev.elo, count - 1)

      setDelta(Math.round(lastDisp - prevDisp))
      setLastContest(last.name ?? '')
    } else if (count === 1) {
      setLastContest(history[0].name ?? '')
      setDelta(null)
    } else {
      setLastContest('')
      setDelta(null)
    }
  }, [username])

  useEffect(() => {
    fetchUserData()
  }, [fetchUserData])

  useEffect(() => {
    const onProfileUpdated = () => {
      fetchUserData()
    }
    window.addEventListener('bqt-profile-updated', onProfileUpdated)
    return () => window.removeEventListener('bqt-profile-updated', onProfileUpdated)
  }, [fetchUserData])

  const eloClass = getEloClass(elo)

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    if (href === '/problemset') return pathname.startsWith('/problem') || pathname.startsWith('/submit/')
    if (href === '/contests/past/1') return pathname.startsWith('/contest')
    if (href === '/submissions') return pathname.startsWith('/submission')
    if (href === '/blogs') return pathname.startsWith('/blog')
    return pathname.startsWith(href)
  }

  const sidebarContent = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: '12px 8px',
      }}
    >
      {/* Logo */}
      <Link
        href="/"
        onClick={() => setMobileOpen(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '6px 8px 14px',
          textDecoration: 'none',
          borderBottom: '1px solid #1e2030',
          marginBottom: '10px',
        }}
      >
        <Image
          src="/assets/web-icon.png"
          alt="BQTOJ"
          width={28}
          height={28}
          style={{ borderRadius: '7px', flexShrink: 0 }}
        />
        <span style={{ fontSize: '20px', color: '#c300ff' }}>
          <strong>BQTOJ</strong>
        </span>
      </Link>

      {/* Nav items */}
      <nav style={{ flex: 1 }}>
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              onClick={() => setMobileOpen(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '9px',
                padding: '8px 10px',
                borderRadius: '6px',
                fontSize: '13px',
                color: active ? '#e4e4e7' : '#9ca3af',
                background: active ? '#1a1c2e' : 'transparent',
                fontWeight: active ? '600' : '400',
                textDecoration: 'none',
                marginBottom: '2px',
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              <span style={{ opacity: active ? 1 : 0.7, flexShrink: 0 }}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Divider */}
      <div style={{ height: '1px', background: '#1e2030', margin: '10px 0' }} />

      {/* Rating card */}
      {username ? (
        <div
          style={{
            background: '#161827',
            border: '1px solid #1e2030',
            borderRadius: '8px',
            padding: '12px 10px',
            marginBottom: '10px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              marginBottom: '8px',
            }}
          >
            <Link
              href={`/user/${encodeURIComponent(username)}`}
              prefetch={false}
              onClick={() => setMobileOpen(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                minWidth: 0,
                textDecoration: 'none',
              }}
            >
              <UserAvatar username={username} avatarUrl={avatarUrl} size={30} />
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                <strong style={{ color: getEloColor(elo) }}>{username}</strong>
              </div>
            </Link>

            <Link
              href="/settings"
              prefetch={false}
              onClick={() => setMobileOpen(false)}
              aria-label="Account settings"
              title="Account settings"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '5px',
                borderRadius: '6px',
                color: pathname === '/settings' ? '#f4f4f5' : '#9ca3af',
                background: pathname === '/settings' ? '#25283d' : 'transparent',
                flexShrink: 0,
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              <Settings size={15} />
            </Link>
          </div>

          <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '2px' }}>
            Rating
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
            <Image
              src={`/assets/ranks/${eloClass}.png`}
              alt={eloClass}
              width={24}
              height={24}
            />
            <div
              style={{
                fontSize: '22px',
                fontWeight: '600',
                color: getEloColor(elo),
                lineHeight: 1.4,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {elo}
            </div>
            {delta !== null && lastContest && (
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  color: delta >= 0 ? '#22c55e' : '#ef4444',
                  marginTop: '2px',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {delta >= 0 ? '+' : ''}
                {delta}
              </div>
            )}
          </div>

          {delta !== null && lastContest && (
            <div
              style={{
                fontSize: '12px',
                color: '#d4d4d8',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              <strong>{lastContest}</strong>
            </div>
          )}
        </div>
      ) : null}

      {/* Auth */}
      <div style={{ fontSize: '12px' }}>
        <AuthButtons />
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <div
        className="bqt-sidebar-desktop"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: sidebarOpen ? '250px' : '10px',
          height: '100vh',
          zIndex: 30,
        }}
        onMouseEnter={() => setSidebarOpen(true)}
        onMouseLeave={() => setSidebarOpen(false)}
      >
        <aside
          className="bqt-sidebar-aside"
          style={{
            width: '250px',
            flexShrink: 0,
            background: '#121420',
            borderRight: '1px solid #1e2030',
            height: '100vh',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            transform: sidebarOpen ? 'translateX(0)' : 'translateX(-242px)',
            transition: 'transform 0.18s ease-out',
          }}
        >
          {sidebarContent}
        </aside>
      </div>

      {/* Mobile top bar */}
      <div
        style={{
          display: 'none',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: '#10121a',
          borderBottom: '1px solid #1e2030',
          padding: '0 16px',
          height: '48px',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
        className="bqt-mobile-bar"
      >
        <Link
          href="/"
          onClick={() => setMobileOpen(false)}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}
        >
          <Image
            src="/assets/web-icon.png"
            alt="BQTOJ"
            width={24}
            height={24}
            style={{ borderRadius: '6px' }}
          />
          <span style={{ fontSize: '16px', fontWeight: '600', color: '#e4e4e7' }}>BQTOJ</span>
        </Link>
        <button
          onClick={() => setMobileOpen((v) => !v)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#9ca3af',
            cursor: 'pointer',
            padding: '6px',
            display: 'flex',
            alignItems: 'center',
          }}
          aria-label="Toggle menu"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            {mobileOpen ? (
              <path d="M4 4l12 12M4 16L16 4" stroke="currentColor" strokeWidth="2" fill="none" />
            ) : (
              <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="2" fill="none" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div
          style={{
            display: 'none',
            position: 'fixed',
            top: '48px',
            left: 0,
            right: 0,
            bottom: 0,
            background: '#10121a',
            zIndex: 40,
            overflowY: 'auto',
          }}
          className="bqt-mobile-drawer"
        >
          {sidebarContent}
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .bqt-sidebar-desktop { display: none !important; }
          .bqt-sidebar-spacer  { display: none !important; }
          .bqt-mobile-bar { display: flex !important; }
          .bqt-mobile-drawer { display: block !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .bqt-sidebar-aside { transition: none !important; }
        }
      `}</style>
    </>
  )
}