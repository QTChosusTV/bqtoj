// context/AuthContext.tsx
'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '@/utils/supabaseClient'

interface AuthContextType {
  userId: string | null
  username: string | null
  email: string | null
  loading: boolean
  currentContestId: number | null
}

const AuthContext = createContext<AuthContextType>({
  userId: null,
  username: null,
  email: null,
  loading: true,
  currentContestId: null,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null)
  const [username, setUsername] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentContestId, setCurrentContestId] = useState<number | null>(null)

  const loadUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user ?? null

      if (!user) {
        setUserId(null)
        setUsername(null)
        setEmail(null)
        setCurrentContestId(null)
        return
      }

      setUserId(user.id)
      setEmail(user.email ?? null)

      const { data } = await supabase
        .from('users')
        .select('username, current_contest_id')
        .eq('id', user.id)
        .maybeSingle()

      // Do NOT fall back to email prefix; if data.username is null, user hasn't finished /post-register
      setUsername(data?.username ?? null)
      setCurrentContestId(data?.current_contest_id ?? null)
    } catch (e) {
      console.error('[AUTH] failed:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      loadUser()
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ userId, username, email, loading, currentContestId }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)