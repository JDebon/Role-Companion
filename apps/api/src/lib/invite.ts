import { randomBytes } from 'crypto'

const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

export function generateInviteCode(length = 8): string {
  const bytes = randomBytes(length)
  return Array.from(bytes)
    .map((b) => CHARSET[b % CHARSET.length])
    .join('')
}
