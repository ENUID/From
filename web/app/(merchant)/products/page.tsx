'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function Redirect() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const storeId = searchParams.get('storeId')
    router.replace(`/merchant/dashboard${storeId ? `?storeId=${storeId}` : ''}`)
  }, [router, searchParams])

  return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--ink3)', fontSize: 13 }}>
      Loading...
    </div>
  )
}

export default function MerchantProductsPage() {
  return <Suspense><Redirect /></Suspense>
}
