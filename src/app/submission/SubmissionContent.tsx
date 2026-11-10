// app/submission/SubmissionContent.tsx
'use client'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import { supabase } from '@/utils/supabaseClient'
import { useAuth } from '@/context/AuthContext'

type StatusCode = 'AC' | 'WA' | 'TLE' | 'MLE' | 'RE' | 'CE' | 'PC' | 'OLE' | 'JE' | 'Pending'

type TestResult = {
  test: number
  status: StatusCode
  verdict?: string
  message?: string
  expected?: string
  got?: string
  fraction_correct?: number
  score?: number // fallback for older submissions
  time: number
  memory_kb: number
}

interface TestDropdownProps {
  result: TestResult
  isSpecial?: boolean
  canViewExpected: boolean
  isOpen: boolean
  onToggle: () => void
}

type Submission = {
  id: string
  username: string
  problem_id: string
  contest_id?: number | null
  code: string
  language: string
  created_at: string
  percentage_correct: number
  results?: TestResult[]
  overall: string
  time: number
  memory_kb: number
}

function overallColor(overall: string): string {
  switch (overall) {
    case 'Accepted': return 'text-green-400'
    case 'Wrong Answer': return 'text-red-400'
    case 'Time Limit Exceeded': return 'text-gray-400'
    case 'Memory Limit Exceeded': return 'text-purple-400'
    case 'Runtime Error': return 'text-orange-400'
    case 'Compile Error': return 'text-yellow-400'
    case 'Judging...': return 'text-blue-400'
    case 'Pending': return 'text-blue-400'
    case 'Partially Correct': return 'text-teal-300'
    case 'Output Limit Exceeded': return 'text-purple-400'
    case 'Judge Error': return 'text-pink-400'
    default: return 'text-white'
  }
}

function overallBg(overall: string): string {
  switch (overall) {
    case 'Accepted': return 'bg-green-900/40'
    case 'Wrong Answer': return 'bg-red-900/40'
    case 'Time Limit Exceeded': return 'bg-gray-800/60'
    case 'Memory Limit Exceeded': return 'bg-purple-900/40'
    case 'Runtime Error': return 'bg-orange-900/40'
    case 'Compile Error': return 'bg-yellow-900/40'
    case 'Judging...': return 'bg-blue-900/40'
    case 'Pending': return 'bg-blue-900/40'
    case 'Partially Correct': return 'bg-teal-900/40'
    case 'Output Limit Exceeded': return 'bg-purple-900/40'
    case 'Judge Error': return 'bg-pink-900/40'
    default: return 'bg-gray-900'
  }
}

function statusText(status: StatusCode): string {
  switch (status) {
    case 'AC': return 'Accepted'
    case 'WA': return 'Wrong Answer'
    case 'TLE': return 'Time Limit Exceeded'
    case 'MLE': return 'Memory Limit Exceeded'
    case 'RE': return 'Runtime Error'
    case 'CE': return 'Compile Error'
    case 'PC': return 'Partially Correct'
    case 'OLE': return 'Output Limit Exceeded'
    case 'JE': return 'Judge Error'
    case 'Pending': return 'Judging...'
    default: return status
  }
}

function statusColor(status: StatusCode): string {
  switch (status) {
    case 'AC': return 'text-green-400'
    case 'WA': return 'text-red-400'
    case 'TLE': return 'text-gray-400'
    case 'MLE': return 'text-purple-400'
    case 'RE': return 'text-orange-400'
    case 'CE': return 'text-yellow-400'
    case 'PC': return 'text-teal-300'
    case 'OLE': return 'text-purple-400'
    case 'JE': return 'text-pink-400'
    case 'Pending': return 'text-blue-400'
    default: return 'text-white'
  }
}

function truncate(text: string, maxLength: number = 500) {
  if (!text) return ''
  return text.length > maxLength ? text.slice(0, maxLength) + '...' : text
}

function getTestFraction(r: TestResult): number {
  if (r.fraction_correct !== undefined) return Number(r.fraction_correct)
  if (r.score !== undefined) return Number(r.score)
  return r.status === 'AC' ? 1 : 0
}

function formatScore(val: number): string {
  return Number.isInteger(val) ? val.toString() : val.toFixed(2).replace(/\.?0+$/, '')
}

function TestDropdown({ result, isSpecial = false, canViewExpected, isOpen, onToggle }: TestDropdownProps) {
  const frac = getTestFraction(result)
  const verdictMessage = result.verdict || result.message || (result.status === 'AC' ? 'OK' : '')

  return (
    <div className="mb-3 rounded-xl bg-gray-800 shadow-md">
      <div
        className={`flex justify-between items-center p-4 ${!isSpecial ? 'cursor-pointer select-none' : ''}`}
        onClick={!isSpecial ? onToggle : undefined}
      >
        <div className="flex items-center gap-3">
          <p className="text-blue-400 font-semibold">
            Test #{result.test}:{' '}
            <span className={statusColor(result.status)}>{statusText(result.status)}</span>
          </p>
          {result.status === 'PC' && (
            <span className="text-xs px-2 py-0.5 rounded bg-teal-900/60 text-teal-300 font-medium">
              +{formatScore(frac)} pt
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-400">
            {Math.round(result.time * 1000 * 100) / 100} ms
            {result.memory_kb > 0 ? ` · ${result.memory_kb} KB` : ''}
          </span>
          {!isSpecial && (
            <span
              className="text-white transition-transform duration-200"
              style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
            >
              ▶
            </span>
          )}
        </div>
      </div>

      {!isSpecial && isOpen && (
        <div className="grid grid-cols-[110px_1fr] gap-2 p-4 border-t border-gray-700 text-sm">
          {canViewExpected && result.expected !== undefined && (
            <>
              <p className="text-yellow-500 font-medium">Expected:</p>
              <span className={`font-mono break-all ${statusColor(result.status)}`}>
                {truncate(result.expected, 500)}
              </span>
            </>
          )}
          {result.got !== undefined && (
            <>
              <p className="text-white font-medium">Got:</p>
              <span className={`font-mono break-all ${statusColor(result.status)}`}>
                {truncate(result.got, 500)}
              </span>
            </>
          )}
          <p className="text-blue-400 font-medium">Time:</p>
          <span>{Math.round(result.time * 1000 * 100) / 100} ms</span>

          <p className="text-purple-400 font-medium">Memory:</p>
          <span>{result.memory_kb} KB</span>

          <p className="text-teal-300 font-medium">Score:</p>
          <span>
            {formatScore(frac)} / 1 ({(frac * 100).toFixed(0)}%)
          </span>

          {verdictMessage && (
            <>
              <p className="text-gray-300 font-medium">Verdict:</p>
              <pre className="whitespace-pre-wrap font-mono text-sm text-gray-200">
                {verdictMessage}
              </pre>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function SubmissionContent() {
  const searchParams = useSearchParams()
  const submissionId = searchParams.get('id')

  const [submission, setSubmission] = useState<Submission | null>(null)
  const { username, currentContestId, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [isSpecial, setIsSpecial] = useState(false)
  const [openTest, setOpenTest] = useState<number | null>(null)

  useEffect(() => {
    if (!submissionId) return

    const fetchData = async () => {
      const { data } = await supabase
        .from('submissions')
        .select('*')
        .eq('id', submissionId)
        .single()

      if (data) {
        const parsedResults: TestResult[] =
          typeof data.results === 'string' ? JSON.parse(data.results) : data.results
        setSubmission({ ...data, results: parsedResults })

        // Auto-open CE or JE if present
        const firstError = parsedResults?.find(r => r.status === 'CE' || r.status === 'JE')
        if (firstError) setOpenTest(firstError.test)
      }
      setLoading(false)
    }

    fetchData()

    const channel = supabase
      .channel(`submission-${submissionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'submissions',
          filter: `id=eq.${submissionId}`,
        },
        payload => {
          const newSub = payload.new as Submission
          const parsedResults: TestResult[] =
            typeof newSub.results === 'string' ? JSON.parse(newSub.results) : newSub.results

          setSubmission({
            ...newSub,
            results: parsedResults,
          })

          const firstError = parsedResults?.find(r => r.status === 'CE' || r.status === 'JE')
          if (firstError) {
            setOpenTest(prev => (prev === null ? firstError.test : prev))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [submissionId])

  useEffect(() => {
    if (!submission?.problem_id) return

    const fetchProblemMeta = async () => {
      const { data: problemData } = await supabase
        .rpc('get_problem_by_id', { p_id: Number(submission.problem_id) })
        .select('tags')
        .single()

      if (problemData && Array.isArray(problemData.tags)) {
        setIsSpecial(
          (problemData.tags as { tagName: string }[]).some(t => t.tagName === 'special')
        )
      }
    }

    fetchProblemMeta()
  }, [submission?.problem_id])

  useEffect(() => {
    if (submission?.overall === 'Judging...' || submission?.overall === 'Pending') {
      window.scrollBy({ top: 120, behavior: 'smooth' })
    }
  }, [submission?.results?.length, submission?.overall])

  if (loading || authLoading) return <p className="p-6">Loading...</p>
  if (!submission) return <p className="p-6 text-red-500">Submission not found.</p>

  if (!authLoading && username && submission.username !== username) {
    return (
      <p className="p-6 text-red-400 font-bold">
        You don&apos;t have permission to view this submission.
      </p>
    )
  }

  // Only allow viewing expected output when practicing (current_contest_id == 0 and submission wasn't made in a contest)
  const canViewExpected =
    (currentContestId ?? 0) === 0 && (submission.contest_id ?? 0) === 0

  const results = submission.results ?? []
  const isCompileOrJudgeError =
    results.length === 1 && (results[0].status === 'CE' || results[0].status === 'JE')

  const earnedScore = results.reduce((sum, r) => sum + getTestFraction(r), 0)
  const maxScore = isCompileOrJudgeError ? 0 : results.length

  const maxTimeMs =
    submission.time > 0
      ? Math.round(submission.time * 1000 * 100) / 100
      : results.length > 0
      ? Math.round(Math.max(...results.map(r => r.time || 0)) * 1000 * 100) / 100
      : 0

  const maxMemKb =
    submission.memory_kb > 0
      ? submission.memory_kb
      : results.length > 0
      ? Math.max(...results.map(r => r.memory_kb || 0))
      : 0

  return (
    <main className="max-w-4xl mx-auto p-6">
      <h1 className="text-xl font-bold mb-4">Submission #{submission.id}</h1>

      {/* Grouped Status & Metrics Block */}
      <div className="mb-6 rounded-xl bg-gray-800/80 border border-gray-700 p-4 shadow-md grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider">Username</p>
          <p className="font-semibold text-white mt-0.5">{submission.username}</p>
        </div>

        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider">Problem ID</p>
          <p className="font-semibold text-white mt-0.5">{submission.problem_id}</p>
        </div>

        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider">Status</p>
          <span className={`inline-block mt-0.5 font-bold ${overallColor(submission.overall)}`}>
            {submission.overall}
          </span>
        </div>

        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider">Score</p>
          <p className="font-semibold text-white mt-0.5">
            {maxScore > 0 ? (
              <>
                <span className={overallColor(submission.overall)}>
                  {formatScore(earnedScore)}
                </span>{' '}
                / {maxScore}{' '}
                <span className="text-xs text-gray-400 font-normal">
                  ({((earnedScore / maxScore) * 100).toFixed(1)}%)
                </span>
              </>
            ) : (
              <span className="text-gray-400">—</span>
            )}
          </p>
        </div>

        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider">Max Time</p>
          <p className="font-semibold text-white mt-0.5">{maxTimeMs} ms</p>
        </div>

        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider">Max Memory</p>
          <p className="font-semibold text-white mt-0.5">
            {maxMemKb > 0 ? `${(maxMemKb / 1024).toFixed(2)} MB (${maxMemKb} KB)` : '0 KB'}
          </p>
        </div>
      </div>

      <pre
        className={`whitespace-pre-wrap text-white p-4 rounded-xl mt-2 text-sm shadow-inner ${overallBg(
          submission.overall
        )}`}
        style={{ marginBottom: 20 }}
      >
        {submission.code}
      </pre>

      {/* Live test results (only one open at a time) */}
      {results.length > 0 &&
        results.map(r => (
          <TestDropdown
            key={r.test}
            result={r}
            isSpecial={isSpecial}
            canViewExpected={canViewExpected}
            isOpen={openTest === r.test}
            onToggle={() => setOpenTest(prev => (prev === r.test ? null : r.test))}
          />
        ))}

      {/* Show which test is currently being judged */}
      {(submission.overall === 'Judging...' || submission.overall === 'Pending') && (
        <div className="mb-4 rounded-xl bg-gray-800 shadow-md p-4 text-blue-400 animate-pulse">
          ⏳ Judging test {results.length + 1}
          {maxScore > 0 ? ` of ${maxScore}` : ''}...
        </div>
      )}
    </main>
  )
}

export default function SubmissionPage() {
  return (
    <Suspense fallback={<p className="p-6">Loading...</p>}>
      <SubmissionContent />
    </Suspense>
  )
}