import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import bcrypt from 'bcryptjs'
import { api } from '@/convex/_generated/api'

function getConvex() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!url) throw new Error('NEXT_PUBLIC_CONVEX_URL is not set')
  return new ConvexHttpClient(url)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, email, password } = body

    // Validate inputs
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json(
        { error: 'Name must be at least 2 characters' },
        { status: 400 }
      )
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      )
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      )
    }

    // Hash the password
    const salt = await bcrypt.genSalt(12)
    const passwordHash = await bcrypt.hash(password, salt)

    // Store user in Convex — createUser is server-secret gated (Convex is a
    // public endpoint), so this route is the only caller that can create rows.
    const serverSecret = process.env.CONVEX_AUTH_SECRET
    if (!serverSecret) {
      console.error('[register] CONVEX_AUTH_SECRET is not configured')
      return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
    }
    const convex = getConvex()
    const userId = await convex.mutation(api.users.createUser, {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      serverSecret,
    })

    return NextResponse.json(
      { success: true, userId },
      { status: 201 }
    )
  } catch (err: any) {
    // Handle duplicate email
    if (err?.message?.includes('EMAIL_EXISTS')) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      )
    }

    console.error('Registration error:', err)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
