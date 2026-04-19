import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { ConvexHttpClient } from 'convex/browser'
import { authOptions } from '@/lib/auth'
import { EMBED_DIMENSIONS, EMBED_MODEL, aiEmbed, aiHealth } from '@/lib/openai'
import { api } from '@/lib/convexApi'

function getConvex() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!url) throw new Error('NEXT_PUBLIC_CONVEX_URL is not set')
  return new ConvexHttpClient(url)
}

async function getOwnedMerchantIds(convex: ConvexHttpClient, ownerUserId: string) {
  const stores = await convex.query(api.merchants.listByUser, {
    owner_user_id: ownerUserId,
  }) as Array<{ _id: string }>

  return stores.map((store) => store._id)
}

async function requireOwnedMerchant(
  convex: ConvexHttpClient,
  ownerUserId: string,
  merchantId: string | null
) {
  if (!merchantId) {
    return { error: NextResponse.json({ error: 'Missing merchant_id' }, { status: 400 }) }
  }

  const store = await convex.query(api.merchants.getStoreForOwner, {
    owner_user_id: ownerUserId,
    merchant_id: merchantId as any,
  })

  if (!store) {
    return { error: NextResponse.json({ error: 'Store not found' }, { status: 404 }) }
  }

  return { merchantId }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const merchantId = typeof body.merchant_id === 'string' ? body.merchant_id : null
  const force = body.force === true
  const limit = typeof body.limit === 'number' ? body.limit : 25

  const health = await aiHealth()
  if (!health.ok) {
    return NextResponse.json({
      error: 'AI provider is not configured. Set OPENAI_API_KEY for production use.',
    }, { status: 503 })
  }

  if (!health.models.includes(EMBED_MODEL)) {
    return NextResponse.json({
      error: `Model "${EMBED_MODEL}" is not configured for the current AI provider.`,
      available_models: health.models,
    }, { status: 503 })
  }

  const convex = getConvex()
  const ownership = await requireOwnedMerchant(convex, session.user.id, merchantId)
  if ('error' in ownership) {
    return ownership.error
  }

  if (force) {
    await convex.mutation(api.embedHelpers.queueProductsForEmbedding, {
      merchantId: ownership.merchantId,
      force: true,
    }).catch(() => null)
  }

  try {
    const pending = await convex.mutation(api.embedHelpers.claimPendingProducts, {
      merchantId: ownership.merchantId,
      limit,
    })

    if (!pending.length) {
      return NextResponse.json({ embedded: 0, failed: 0, total: 0, message: 'No queued products to embed' })
    }

    let ok = 0
    let fail = 0

    for (const product of pending) {
      const text = [product.title, product.description, product.vendor, product.product_type, (product.tags ?? []).join(' ')]
        .filter(Boolean).join(' ').trim()
      if (!text) continue

      try {
        const embedding = await aiEmbed(text)
        if (embedding.length !== EMBED_DIMENSIONS) throw new Error(`Expected ${EMBED_DIMENSIONS} dims, got ${embedding.length}`)

        await convex.mutation(api.embedHelpers.saveEmbedding, {
          id: product._id,
          embedding,
          model: EMBED_MODEL,
        })
        ok++
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown embed error'
        console.error(`Embed failed "${product.title}":`, errorMessage)
        await convex.mutation(api.embedHelpers.markEmbeddingFailed, {
          id: product._id,
          error: errorMessage,
        }).catch(() => null)
        fail++
      }
    }

    return NextResponse.json({ embedded: ok, failed: fail, total: pending.length, worker: true })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch pending products' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const convex = getConvex()
  const health = await aiHealth()
  const merchantId = req.nextUrl.searchParams.get('merchant_id')
  const merchantIds = merchantId
    ? [merchantId]
    : await getOwnedMerchantIds(convex, session.user.id)

  if (!merchantIds.length) {
    return NextResponse.json({
      embed_status: { total: 0, embedded: 0, pending: 0, processing: 0, failed: 0 },
      ai: {
        configured: health.ok,
        provider: health.provider,
        models: health.models,
        embed_model: EMBED_MODEL,
        chat_model: process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o-mini',
        embed_dimensions: EMBED_DIMENSIONS,
      },
    })
  }

  if (merchantId) {
    const ownership = await requireOwnedMerchant(convex, session.user.id, merchantId)
    if ('error' in ownership) {
      return ownership.error
    }
  }

  const status = await convex.query(api.embedHelpers.getEmbedStatus, { merchantIds }).catch(() => null)

  return NextResponse.json({
    embed_status: status,
    ai: {
      configured: health.ok,
      provider: health.provider,
      models: health.models,
      embed_model: EMBED_MODEL,
      chat_model: process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o-mini',
      embed_dimensions: EMBED_DIMENSIONS,
    },
  })
}
