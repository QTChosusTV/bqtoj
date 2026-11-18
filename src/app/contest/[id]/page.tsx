import { Suspense } from 'react'
import ContestPage from './ContestPage'

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ContestPage />
    </Suspense>
  )
}
