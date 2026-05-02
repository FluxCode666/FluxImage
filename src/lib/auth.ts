import jwt from 'jsonwebtoken'
import { NextRequest, NextResponse } from 'next/server'

export interface JwtPayload {
  id: number
  username: string
  email: string
  role: string
  drawing_points: number
  creation_count: number
}

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret'

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload
  } catch {
    return null
  }
}

export function getTokenFromRequest(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return null
  const parts = authHeader.split(' ')
  return parts.length === 2 && parts[0] === 'Bearer' ? parts[1] : null
}

export function authenticateRequest(req: NextRequest): JwtPayload | NextResponse {
  const token = getTokenFromRequest(req)
  if (!token) {
    return NextResponse.json({ error: '需要提供访问令牌' }, { status: 401 })
  }
  const user = verifyToken(token)
  if (!user) {
    return NextResponse.json({ error: '无效或过期的访问令牌' }, { status: 403 })
  }
  return user
}

export function requireAdmin(user: JwtPayload): NextResponse | null {
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }
  return null
}
