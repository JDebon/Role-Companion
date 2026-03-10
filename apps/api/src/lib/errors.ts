import type { Context } from 'hono'

export function errorResponse(
  c: Context,
  status: 400 | 401 | 403 | 404 | 409,
  code: string,
  fields?: Record<string, string>
) {
  const body: Record<string, unknown> = { error: code }
  if (fields) body.fields = fields
  return c.json(body, status)
}
