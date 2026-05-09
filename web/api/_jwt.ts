import jwt from 'jsonwebtoken'

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    console.error('[_jwt] Missing env var: JWT_SECRET')
    throw new Error('Missing env var: JWT_SECRET')
  }
  return secret
}

export function signToken(payload: object): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '30d' })
}

export function verifyToken(token: string): unknown {
  return jwt.verify(token, getJwtSecret())
}
