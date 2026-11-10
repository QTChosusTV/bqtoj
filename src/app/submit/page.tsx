// submit/page.tsx

'use client'

import { useAuth } from '@/context/AuthContext'
import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import { supabase } from '@/utils/supabaseClient'

type UserMetadata = {
  username?: string
}

function SubmitPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const problemId = searchParams.get('id')

  const [code, setCode] = useState('')
  const [language, setLanguage] = useState('cpp')
  const [submitting, setSubmitting] = useState(false)
  const { username } = useAuth()

  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!username || !problemId) return 
    setSubmitting(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({
          code,
          problem_id: problemId,
          language,
          username,
        }),
      })
      const result = await res.json()
      if (!res.ok || !result.id) {
        setError(result.error ?? 'Submission failed')
        setSubmitting(false)
        return
      }
      router.push(`/submission?id=${result.id}`)
    } catch {
      setError('Could not reach the judge')
      setSubmitting(false)
    }
  }
 

  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-xl font-bold mb-4">Submit your solution</h1>

      <label className="block mb-2 text-sm font-medium">Language</label>
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
        className="mb-4 p-2 rounded bg-gray-800 text-white w-full"
      >
        <option value="cpp">C++20</option>
        <option value="python">Python3</option>
      </select>

      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        rows={15}
        className="w-full p-3 text-sm bg-gray-900 text-white rounded border border-gray-700 mb-4"
        placeholder="Paste your C++ code here..."
      />

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center gap-2"
      >
        {submitting && (
          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
          </svg>
        )}
        {submitting ? 'Submitting...' : 'Submit'}
      </button>

      {submitting && (
        <p className="mt-2 text-sm text-gray-300">
          Please be patient, we will redirect you after the submission is processed.
        </p>
      )}


    </main>
  )
}

export default function SubmitPage() {
  return (
    <Suspense fallback={<p className="p-6">Loading form...</p>}>
      <SubmitPageContent />
    </Suspense>
  )
}
