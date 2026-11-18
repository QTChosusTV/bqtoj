import { Suspense } from 'react'
import BlogViewPage from './BlogViewPage'

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <BlogViewPage />
    </Suspense>
  )
}
