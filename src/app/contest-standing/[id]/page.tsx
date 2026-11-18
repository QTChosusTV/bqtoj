import { Suspense } from 'react'
import ContestStandingPage from './ContestStandingPage'

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ContestStandingPage />
    </Suspense>
  )
}
