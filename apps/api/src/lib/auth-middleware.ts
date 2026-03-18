import { createMiddleware } from 'hono/factory'
import { verifyToken, type JwtPayload } from './jwt.js'
import { errorResponse } from './errors.js'

type AuthVariables = {
  user: JwtPayload
}

export const authMiddleware = createMiddleware<{ Variables: AuthVariables }>(
  async (c, next) => {
    const header = c.req.header('Authorization')
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null

    if (!token) {
      return errorResponse(c, 401, 'UNAUTHORIZED')
    }

    let payload: JwtPayload
    try {
      payload = verifyToken(token)
    } catch {
      return errorResponse(c, 401, 'UNAUTHORIZED')
    }
    c.set('user', payload)
    await next()
  }
)
