import { NextResponse } from 'next/server'
import { getExchangeRates } from '@/lib/exchangeRates'

export const maxDuration = 10

export async function GET() {
  try {
    const rates = await getExchangeRates()
    return NextResponse.json(rates, {
      headers: {
        'Cache-Control': 'public, max-age=1800, stale-while-revalidate=3600',
      },
    })
  } catch {
    return NextResponse.json({ error: 'unavailable' }, { status: 500 })
  }
}
