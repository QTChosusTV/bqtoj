'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import Link from 'next/link'
import { Timestamp } from 'next/dist/server/lib/cache-handlers/types'
import { getEloClass, getEloColor } from "@/utils/eloDisplay"

interface Problem {
  id: number
  title: string
  difficulty: number
  tags: { tagName: string }[]
  statement: string
  constrains: string
  examples: string
  created_at: Timestamp
}

const TAG_COLORS: Record<string, { bg: string; color: string }> = {
  math:             { bg: '#1a1530', color: '#a89cee' },
  'number theory':  { bg: '#1a1530', color: '#a89cee' },
  counting:         { bg: '#1a1530', color: '#a89cee' },
  dp:               { bg: '#0e1f10', color: '#97C459' },
  recursion:        { bg: '#0e1f10', color: '#97C459' },
  'divide and conquer': { bg: '#0e1f10', color: '#97C459' },
  graph:            { bg: '#0e2820', color: '#5DCAA5' },
  bfs:              { bg: '#0e2820', color: '#5DCAA5' },
  dsu:              { bg: '#0e2820', color: '#5DCAA5' },
  dijkstra:         { bg: '#0e2820', color: '#5DCAA5' },
  'shortest path':  { bg: '#0e2820', color: '#5DCAA5' },
  'data structures':{ bg: '#241800', color: '#EF9F27' },
  'binary search':  { bg: '#241800', color: '#EF9F27' },
  sorting:          { bg: '#241800', color: '#EF9F27' },
  string:           { bg: '#1a0e16', color: '#ED93B1' },
  greedy:           { bg: '#1a0810', color: '#f09595' },
  geometry:         { bg: '#001a1a', color: '#5DCAA5' },
  sweepline:        { bg: '#001a1a', color: '#5DCAA5' },
  interval:         { bg: '#001a1a', color: '#5DCAA5' },
  backtracking:     { bg: '#1a0810', color: '#f09595' },
  'brute force':    { bg: '#1a1010', color: '#f09595' },
  implementation:   { bg: '#101520', color: '#85B7EB' },
  basic:            { bg: '#181818', color: '#aaaaaa' },
  special:          { bg: '#201520', color: '#ED93B1' },
}

const DEFAULT_TAG = { bg: '#161827', color: '#8a8ea8' }

function getTagStyle(tag: string) {
  return TAG_COLORS[tag.toLowerCase()] ?? DEFAULT_TAG
}

const ALL_TAGS = [
  'backtracking','basic','bfs','binary search','brute force','combinatorics',
  'counting','data structures','dijkstra','divide and conquer','dp','dsu',
  'geometry','graph','greedy','heuristic','implementation','interval','math',
  'number theory','offline queries','online queries','recursion','shortest path',
  'sorting','special','stack','string','sweepline','two pointers',
]

export default function ProblemsetList() {
  const [username, setUsername] = useState<string | null>(null)
  const [problems, setProblems] = useState<Problem[]>([])
  const [solvedProblems, setSolvedProblems] = useState<Set<number>>(new Set())
  const [submittedProblems, setSubmittedProblems] = useState<Set<number>>(new Set())
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [filterStatus, setFilterStatus] = useState<'all' | 'unsolved' | 'submitted-not-ac' | 'solved'>('all')
  const [sortMode, setSortMode] = useState<'elo-asc' | 'elo-desc' | 'time-asc' | 'time-desc'>('time-desc')
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false)

  useEffect(() => {
    const fetchProblems = async () => {
      const { data, error } = await supabase.rpc('get_problems', { 
        p_limit: 10, 
        p_offset: 0 
      })
      if (!error && data) setProblems(data)
    }

    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: userData } = await supabase
        .from('users')
        .select('username')
        .eq('id', user.id)
        .single()
      if (userData) setUsername(userData.username ?? null)
    }

    checkUser()
    fetchProblems()
  }, [])

  useEffect(() => {
    const fetchSubmissions = async () => {
      if (!username) return
      const { data, error } = await supabase
        .from('submissions')
        .select('problem_id, overall')
        .eq('username', username)
      if (!error && data) {
        const solved = new Set<number>()
        const submitted = new Set<number>()
        data.forEach(d => {
          submitted.add(d.problem_id)
          if (d.overall === 'Accepted') solved.add(d.problem_id)
        })
        setSolvedProblems(solved)
        setSubmittedProblems(submitted)
      }
    }
    fetchSubmissions()
  }, [username])

  const filteredProblems = problems
    .filter(problem => {
      const tagMatch = selectedTags.length === 0 || problem.tags?.some(t => selectedTags.includes(t.tagName))
      const excludeContest = !problem.tags?.some(t => t.tagName === 'contest-problem')
      const statusMatch =
        filterStatus === 'all' ||
        (filterStatus === 'unsolved' && !solvedProblems.has(problem.id)) ||
        (filterStatus === 'submitted-not-ac' && submittedProblems.has(problem.id) && !solvedProblems.has(problem.id)) ||
        (filterStatus === 'solved' && solvedProblems.has(problem.id))
      const searchMatch =
        searchQuery.trim() === '' ||
        problem.title.toLowerCase().includes(searchQuery.toLowerCase())
      return tagMatch && excludeContest && statusMatch && searchMatch
    })
    .sort((a, b) => {
      switch (sortMode) {
        case 'elo-asc':  return a.difficulty - b.difficulty
        case 'elo-desc': return b.difficulty - a.difficulty
        case 'time-asc': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        case 'time-desc':return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        default:         return 0
      }
    })

  const selectStyle: React.CSSProperties = {
    background: '#161827',
    border: '1px solid #1e2030',
    borderRadius: '6px',
    padding: '6px 10px',
    fontSize: '12px',
    color: '#8a8ea8',
    outline: 'none',
    cursor: 'pointer',
  }

  const inputStyle: React.CSSProperties = {
    background: '#161827',
    border: '1px solid #1e2030',
    borderRadius: '6px',
    padding: '6px 10px',
    fontSize: '12px',
    color: '#e0e0e0',
    outline: 'none',
    flex: 1,
    minWidth: 0,
  }

  return (
    <main style={{ padding: '16px', maxWidth: '100%' }}>
      {/* ── Toolbar ── */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        marginBottom: '14px',
        alignItems: 'center',
      }}>
        {/* Search */}
        <div style={{ display: 'flex', gap: '6px', flex: '1 1 200px', minWidth: 0 }}>
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && setSearchQuery(searchInput)}
            placeholder="Tìm bài theo tên..."
            style={inputStyle}
          />
          <button
            onClick={() => setSearchQuery(searchInput)}
            style={{ ...selectStyle, color: '#a89cee', border: '1px solid #2a2d3a', whiteSpace: 'nowrap' }}
          >
            Search
          </button>
          {searchQuery && (
            <button
              onClick={() => { setSearchInput(''); setSearchQuery('') }}
              style={{ ...selectStyle, color: '#f09595', border: '1px solid #2a2d3a' }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Sort */}
        <select value={sortMode} onChange={e => setSortMode(e.target.value as any)} style={selectStyle}>
          <option value="time-desc">Newest</option>
          <option value="time-asc">Oldest</option>
          <option value="elo-asc">Easiest</option>
          <option value="elo-desc">Hardest</option>
        </select>

        {/* Status */}
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)} style={selectStyle}>
          <option value="all">All</option>
          <option value="unsolved">Unsolved</option>
          <option value="solved">Solved</option>
          <option value="submitted-not-ac">Attempted</option>
        </select>

        {/* Tags dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setTagDropdownOpen(v => !v)}
            style={{
              ...selectStyle,
              color: selectedTags.length > 0 ? '#a89cee' : '#8a8ea8',
              border: '1px solid ' + (selectedTags.length > 0 ? '#534AB7' : '#1e2030'),
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            Tags {selectedTags.length > 0 && (
              <span style={{
                background: '#534AB7',
                color: '#CECBF6',
                borderRadius: '10px',
                padding: '0 6px',
                fontSize: '10px',
              }}>{selectedTags.length}</span>
            )}
            <span style={{ fontSize: '10px', opacity: 0.6 }}>▼</span>
          </button>
          {tagDropdownOpen && (
            <div style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '4px',
              background: '#10121a',
              border: '1px solid #1e2030',
              borderRadius: '8px',
              padding: '8px',
              zIndex: 100,
              width: '220px',
              maxHeight: '280px',
              overflowY: 'auto',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', color: '#4a4e62' }}>Filter by tag</span>
                <button
                  onClick={() => setSelectedTags([])}
                  style={{ fontSize: '10px', padding: '2px 6px', color: '#f09595', background: 'transparent', border: 'none' }}
                >
                  Clear
                </button>
              </div>
              {ALL_TAGS.map(tag => {
                const active = selectedTags.includes(tag)
                const s = getTagStyle(tag)
                return (
                  <div
                    key={tag}
                    onClick={() => setSelectedTags(prev =>
                      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                    )}
                    style={{
                      padding: '5px 8px',
                      borderRadius: '5px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      background: active ? s.bg : 'transparent',
                      color: active ? s.color : '#6a6e88',
                      marginBottom: '2px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      border: active ? 'none' : '1px solid #2a2d3a',
                      background: active ? s.color : 'transparent',
                      flexShrink: 0,
                    }}/>
                    {tag}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Problem count ── */}
      <div style={{ fontSize: '11px', color: '#4a4e62', marginBottom: '8px' }}>
        {filteredProblems.length} problem{filteredProblems.length !== 1 ? 's' : ''}
        {searchQuery && ` matching "${searchQuery}"`}
      </div>

      {/* ── Table (desktop) ── */}
      <div style={{
        background: '#161827',
        borderRadius: '10px',
        border: '1px solid #1e2030',
        overflow: 'hidden',
      }}>
        {/* Table header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '50px 1fr 180px 70px 80px 70px',
          padding: '8px 14px',
          fontSize: '10px',
          color: '#4a4e62',
          borderBottom: '1px solid #1e2030',
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
        }} className="prob-table-header">
          <span>#</span>
          <span>Title</span>
          <span>Tags</span>
          <span>Rating</span>
          <span>Added</span>
          <span>Status</span>
        </div>

        {/* Rows */}
        {filteredProblems.map((problem, idx) => {
          const ac = solvedProblems.has(problem.id)
          const wa = !ac && submittedProblems.has(problem.id)
          const statusColor = ac ? '#28c840' : wa ? '#ff5f57' : '#4a4e62'
          const statusText = ac ? 'AC' : wa ? 'WA' : '—'

          return (
            <Link
              key={problem.id}
              href={`/problems?id=${encodeURIComponent(problem.id)}`}
              style={{ textDecoration: 'none', display: 'block' }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '50px 1fr 180px 70px 80px 70px',
                  padding: '10px 14px',
                  borderBottom: '1px solid #111320',
                  alignItems: 'center',
                  background: idx % 2 === 0 ? '#10121a' : '#111320',
                  transition: 'background 0.12s',
                  cursor: 'pointer',
                }}
                className="prob-row"
                onMouseEnter={e => (e.currentTarget.style.background = '#1a1c2e')}
                onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? '#10121a' : '#111320')}
              >
                <span style={{ fontSize: '12px', color: '#4a4e62' }}>#{problem.id}</span>

                <span style={{
                  fontSize: '13px',
                  fontWeight: '500',
                  color: '#c8ccde',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  paddingRight: '8px',
                }}>
                  {problem.title}
                </span>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                  {problem.tags?.slice(0, 2).map(tag => {
                    const s = getTagStyle(tag.tagName)
                    return (
                      <span key={tag.tagName} style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: s.bg,
                        color: s.color,
                        whiteSpace: 'nowrap',
                      }}>
                        {tag.tagName}
                      </span>
                    )
                  })}
                  {(problem.tags?.length ?? 0) > 2 && (
                    <span style={{ fontSize: '10px', color: '#4a4e62' }}>
                      +{(problem.tags?.length ?? 0) - 2}
                    </span>
                  )}
                </div>

                <span style={{
                  fontSize: '13px',
                  fontWeight: '500',
                  color: getEloColor(problem.difficulty),
                }}>
                  {problem.difficulty}
                </span>

                <span style={{ fontSize: '11px', color: '#4a4e62' }}>
                  {new Date(problem.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                </span>

                <span style={{
                  fontSize: '12px',
                  fontWeight: '500',
                  color: statusColor,
                }}>
                  {statusText}
                </span>
              </div>
            </Link>
          )
        })}

        {filteredProblems.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: '#4a4e62', fontSize: '13px' }}>
            No problems found
          </div>
        )}
      </div>

      {/* ── Mobile cards (shown on small screens) ── */}
      <style>{`
        @media (max-width: 640px) {
          .prob-table-header { display: none !important; }
          .prob-row {
            display: flex !important;
            flex-direction: column !important;
            gap: 6px !important;
            padding: 12px 14px !important;
          }
        }
      `}</style>
    </main>
  )
}