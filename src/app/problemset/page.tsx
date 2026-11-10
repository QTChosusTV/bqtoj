'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import Link from 'next/link'
import './pbl.css'
import { getEloClass, getEloColor } from "@/utils/eloDisplay"

interface Problem {
  id: number
  title: string
  difficulty: number
  tags: { tagName: string }[]
  statement: string
  constrains: string
  examples: string
  created_at: string
  total_count: number
}

const PAGE_SIZE = 10

const allTags = ['backtracking', 'basic', 'bfs', 'binary search', 'brute force', 'combinatorics', 'contest-problem', 'counting', 'data structures', 'dijkstra', 'divide and conquer', 'dp', 'dsu', 'geometry', 'graph', 'greedy', 'heuristic', 'implementation', 'interval', 'math', 'number theory', 'offline queries', 'online queries', 'recursion', 'shortest path', 'sorting', 'special', 'stack', 'string', 'sweepline', 'two pointers']

function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// Returns page numbers with null as "..." gaps, e.g. [1, null, 4, 5, 6, null, 20]
function getPageList(current: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | null)[] = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  if (start > 2) pages.push(null)
  for (let i = start; i <= end; i++) pages.push(i)
  if (end < total - 1) pages.push(null)
  pages.push(total)
  return pages
}

export default function ProblemsetList() {
  const [username, setUsername] = useState<string | null>(null)
  const [userReady, setUserReady] = useState(false)
  const [problems, setProblems] = useState<Problem[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1) // 1-based

  const [solvedProblems, setSolvedProblems] = useState<Set<number>>(new Set())
  const [submittedProblems, setSubmittedProblems] = useState<Set<number>>(new Set())

  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [filterStatus, setFilterStatus] = useState<'all' | 'unsolved' | 'submitted-not-ac' | 'solved'>('all')
  const [sortMode, setSortMode] = useState<'elo-asc' | 'elo-desc' | 'time-asc' | 'time-desc'>('time-desc')
  const [searchInput, setSearchInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  // user check
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: userData } = await supabase
          .from("users")
          .select("username")
          .eq("id", user.id)
          .maybeSingle()

        setUsername(userData?.username ?? null)
      }
      setUserReady(true)
    }
    checkUser()
  }, [])

  // solved / submitted marks (for the ✅ ❌ icons)
  useEffect(() => {
    if (!username) return
    const fetchSubmissions = async () => {
      const { data, error } = await supabase
        .from('public_submissions')
        .select('problem_id, overall')
        .eq('username', username)
      if (!error && data) {
        const solved = new Set<number>()
        const submitted = new Set<number>()
        data.forEach(d => {
          submitted.add(d.problem_id)
          if (d.overall === "Accepted") solved.add(d.problem_id)
        })
        setSolvedProblems(solved)
        setSubmittedProblems(submitted)
      }
    }
    fetchSubmissions()
  }, [username])

  // go back to page 1 whenever a filter changes
  useEffect(() => {
    setPage(1)
  }, [selectedTags, filterStatus, sortMode, searchQuery])

  // fetch the current page (filters applied server-side)
  useEffect(() => {
    if (!userReady) return
    let cancelled = false

    const fetchProblems = async () => {
      setLoading(true)
      const { data, error } = await supabase.rpc('get_problems', {
        p_limit: PAGE_SIZE,
        p_offset: (page - 1) * PAGE_SIZE,
        p_tags: selectedTags,
        p_search: searchQuery.trim(),
        p_sort: sortMode,
        p_status: filterStatus,
        p_username: username,
      })
      if (cancelled) return
      if (!error && data) {
        setProblems(data)
        setTotalCount(data.length > 0 ? Number(data[0].total_count) : 0)
      }
      setLoading(false)
    }

    fetchProblems()
    return () => { cancelled = true }
  }, [userReady, username, page, selectedTags, filterStatus, sortMode, searchQuery])

  // if filters shrink the result and the page is now out of range, clamp it
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const goToPage = (p: number) => {
    setPage(Math.min(Math.max(1, p), totalPages))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <main>
      <div className="p-6">
        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
          <div>
            <label className="mr-2 font-semibold">Sort:</label>
            <select
              value={sortMode}
              onChange={e => setSortMode(e.target.value as any)}
              className="p-2 border rounded bg-gray-500"
            >
              <option value="elo-asc">Easiest</option>
              <option value="elo-desc">Hardest</option>
              <option value="time-asc">Oldest</option>
              <option value="time-desc">Newest</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="font-semibold">Filter by Tags:</label>
            <select
              multiple
              value={selectedTags}
              onChange={e => setSelectedTags(Array.from(e.target.selectedOptions, o => o.value))}
              className="p-2 border rounded h-36"
            >
              {allTags.map(tag => <option key={tag} value={tag}>{tag}</option>)}
            </select>
            <button
              onClick={() => setSelectedTags([])}
              className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Reset
            </button>
          </div>

          <div>
            <label className="font-semibold">Filter by Status: </label>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as any)}
              className="p-2 border rounded bg-gray-500"
            >
              <option value="all">All</option>
              <option value="unsolved">Unsolved</option>
              <option value="submitted-not-ac">Submitted</option>
              <option value="solved">Solved</option>
            </select>
          </div>

          <form
            className="flex items-center gap-2"
            onSubmit={e => { e.preventDefault(); setSearchQuery(searchInput) }}
          >
            <label className="mr-2 font-semibold">Search:</label>
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search by title..."
              className="p-2 border rounded bg-gray-500 text-white"
            />
            <button type="submit" className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700">
              Search
            </button>
            <button
              type="button"
              onClick={() => { setSearchInput(""); setSearchQuery("") }}
              className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Reset
            </button>
          </form>
        </div>

        <div className="space-y-0" style={{ opacity: loading ? 0.6 : 1 }}>
          {!loading && problems.length === 0 && (
            <p className="text-gray-400 p-5">No problems found.</p>
          )}

          {problems.map(problem => {
            const baseBg = hexToRgba(getEloColor(problem.difficulty), 0.15)
            const hoverBg = hexToRgba(getEloColor(problem.difficulty), 0.3)

            return (
              <Link key={problem.id} href={`/problems?id=${encodeURIComponent(problem.id)}`} className="block">
                <div
                  className="flex flex-col md:flex-row md:justify-between border p-5 bg-gray-800 hover:shadow-lg transition-colors duration-200"
                  style={{ backgroundColor: baseBg }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = hoverBg }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = baseBg }}
                >
                  <div className="flex flex-col md:flex-row md:items-center gap-2">
                    <span className="font-bold text-gray-400">#{problem.id}</span>
                    <h3 className={`font-semibold text-lg ${getEloClass(problem.difficulty)}`}>
                      {solvedProblems.has(problem.id) && '✅ '}
                      {!solvedProblems.has(problem.id) && submittedProblems.has(problem.id) && '❌ '}
                      {problem.title}
                    </h3>
                  </div>

                  <div className="flex flex-col md:flex-row md:items-center gap-5 mt-2 md:mt-0">
                    <div className="flex flex-wrap gap-1">
                      {problem.tags?.map(tag => (
                        <span key={tag.tagName} className="bg-blue-600 text-white px-2 py-0.5 rounded text-xs">
                          {tag.tagName}
                        </span>
                      ))}
                    </div>
                    <span className={`font-bold ${getEloClass(problem.difficulty)}`}>{problem.difficulty}</span>
                    <span className="text-gray-400 text-sm">
                      {new Date(problem.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>

        {/* Page selector */}
        {totalCount > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-1 mt-6">
            <button
              onClick={() => goToPage(1)}
              disabled={page === 1}
              className="px-3 py-1 rounded bg-gray-700 text-white disabled:opacity-40"
            >
              «
            </button>
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page === 1}
              className="px-3 py-1 rounded bg-gray-700 text-white disabled:opacity-40"
            >
              ‹
            </button>

            {getPageList(page, totalPages).map((p, i) =>
              p === null ? (
                <span key={`gap-${i}`} className="px-2 text-gray-400">…</span>
              ) : (
                <button
                  key={p}
                  onClick={() => goToPage(p)}
                  className={`px-3 py-1 rounded text-white ${
                    p === page ? 'bg-blue-600 font-bold' : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  {p}
                </button>
              )
            )}

            <button
              onClick={() => goToPage(page + 1)}
              disabled={page === totalPages}
              className="px-3 py-1 rounded bg-gray-700 text-white disabled:opacity-40"
            >
              ›
            </button>
            <button
              onClick={() => goToPage(totalPages)}
              disabled={page === totalPages}
              className="px-3 py-1 rounded bg-gray-700 text-white disabled:opacity-40"
            >
              »
            </button>

            <span className="ml-3 text-gray-400 text-sm">
              Page {page} / {totalPages} ({totalCount} problems)
            </span>
          </div>
        )}
      </div>
    </main>
  )
}