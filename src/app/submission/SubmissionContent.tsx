'use client'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import { supabase } from '@/utils/supabaseClient'
import { useAuth } from '@/context/AuthContext'

type Verdict = 'AC' | 'WA' | 'TLE' | 'MLE' | 'RE' | 'CE' | 'PC' | 'OLE' | 'JE' | 'Pending'

type TestResult = {
  test: number
  status: Verdict
  expected?: string
  got?: string
  message?: string
  score?: number
  time: number
  memory_kb: number
}

interface TestDropdownProps {
  result: TestResult;
  isSpecial?: boolean;
}

type Submission = {
  id: string
  username: string
  problem_id: string
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

function testText(status: Verdict): string {
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

function testColor(status: Verdict): string {
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

function truncate(text: string, maxLength: number = 100) {
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
}


function TestDropdown({ result, isSpecial = false }: TestDropdownProps) {
  const [open, setOpen] = useState(result.status === 'CE' || result.status === 'JE')

  return (
    <div className="mb-4 rounded-xl bg-gray-800 shadow-md">
      <div
        className={`flex justify-between items-center p-4 ${!isSpecial ? 'cursor-pointer' : ''}`}
        onClick={!isSpecial ? () => setOpen(!open) : undefined}
      >
        <p className="text-blue-400 font-semibold">
          Test #{result.test}:{' '}
          <span className={testColor(result.status)}>{testText(result.status)}</span>
        </p>
        {!isSpecial && (
          <span
            className="text-white transition-transform duration-200"
            style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
          >
            ▶
          </span>
        )}
      </div>

      {(!isSpecial && (open)) && (
        <div className="grid grid-cols-[100px_1fr] gap-2 p-4 border-t border-gray-700">
          <p className="text-yellow-500">Expected:</p>
          <span className={testColor(result.status)}>{truncate(result.expected ?? '')}</span>
          <p className="text-white">Got:</p>
          <span className={testColor(result.status)}>{truncate(result.got ?? '')}</span>
          <p className="text-blue-500">Time:</p>
          <span>{Math.round((result.time * 1000) * 100) / 100} ms</span>
          {result.score !== undefined && result.status === 'PC' && (
            <>
              <p className="text-teal-300">Score:</p>
              <span>{(result.score * 100).toFixed(2)}%</span>
            </>
          )}
          {result.message && (
            <>
              <p className="text-white">Info:</p>
              <pre className="whitespace-pre-wrap text-sm text-gray-300">{result.message}</pre>
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
  const { username, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [isSpecial, setIsSpecial] = useState(false)

  useEffect(() => {
    if (!submissionId) return;

    const fetchData = async () => {
      const { data } = await supabase
        .from('submissions')
        .select('*')
        .eq('id', submissionId)
        .single();

      if (data) setSubmission(data);
      setLoading(false); 
    };

    fetchData();

    // Use unique channel name per submission
    const channel = supabase
      .channel(`submission-${submissionId}`)  // ← unique per submission
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'submissions',
          filter: `id=eq.${submissionId}`,
        },
        payload => {
          console.log('[REALTIME] results type:', typeof payload.new.results)
          console.log('[REALTIME] results value:', payload.new.results)
          console.log('[REALTIME] Got update:', payload.new)
          const newSub = payload.new as Submission
          setSubmission({
            ...newSub,
            results: typeof newSub.results === 'string' 
              ? JSON.parse(newSub.results) 
              : newSub.results
          })
        }
        
      )
      .subscribe((status) => {
        console.log('[REALTIME] Channel status:', status)  // ← add this to debug
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [submissionId]);

  useEffect(() => {
    if (!submission) return;

    const fetchSpecialTag = async () => {
      const { data: problemData } = await supabase
        .from('problems')
        .select('tags')
        .eq('id', submission.problem_id)
        .single()

      if (problemData && Array.isArray(problemData.tags)) {
        setIsSpecial((problemData.tags as { tagName: string }[]).some(t => t.tagName === 'special'))
      }
    }

    fetchSpecialTag()
  }, [submission])

  useEffect(() => {
    if (submission?.overall === 'Judging...' || submission?.overall === 'Pending') {
      window.scrollBy({ top: 120, behavior: 'smooth' })
    }
  }, [submission?.results?.length])

  if (loading || authLoading) return <p className="p-6">Loading...</p>
  if (!submission) return <p className="p-6 text-red-500">Submission not found.</p>

  // Only check permission once both are fully loaded
  if ((!authLoading && username && submission.username !== username)) {
    return <p className="p-6 text-red-400 font-bold">You don&apos;t have permission to view this submission.</p>
  }

  return (
    <main className="max-w-4xl mx-auto p-6">
      <h1 className="text-xl font-bold mb-4">Submission #{submission.id}</h1>

      <div className="mb-4"><strong>Username:</strong> {submission.username}</div>
      <div className="mb-4"><strong>Problem ID:</strong> {submission.problem_id}</div>
      <div className="mb-4">
        <strong>Status:</strong>{' '}
        <span className={`px-2 py-1 rounded font-semibold ${overallColor(submission.overall)}`}>
          {submission.overall}
        </span>
      </div>

      <pre className={`whitespace-pre-wrap text-white p-4 rounded mt-2 text-sm shadow-inner ${overallBg(submission.overall)}`} style={{ marginBottom: 20 }}>
        {submission.code}
      </pre>

      {/* Live test results */}
      {submission.results && submission.results.length > 0 && (
        submission.results.map((r) => (
          <TestDropdown key={r.test} result ={r} isSpecial={isSpecial} />
        ))
      )}

      {/* Show which test is currently being judged */}
      {(submission.overall === 'Judging...' || submission.overall === 'Pending') && (
        <div className="mb-4 rounded-xl bg-gray-800 shadow-md p-4 text-blue-400 animate-pulse">
          ⏳ Judging test {(submission.results?.length ?? 0) + 1}...
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