import { describe, expect, it } from 'vitest'
import { Route } from '~/routes/api.cv-chat'

type Handler = (ctx: { request: Request }) => Promise<Response>
const post = (Route.options.server as { handlers: { POST: Handler } }).handlers.POST

const request = (body: string) =>
  new Request('http://localhost/api/cv-chat', { method: 'POST', body, headers: { 'content-type': 'application/json' } })

describe('POST /api/cv-chat', () => {
  it('should reject an image attachment with 400 before calling the model', async () => {
    const body = JSON.stringify({
      messages: [{ id: 'm1', role: 'user', parts: [{ type: 'image', source: { type: 'url', value: 'https://x' } }] }],
    })

    const response = await post({ request: request(body) })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Only PDF documents are supported.' })
  })

  it('should reject a body that is not JSON with 400', async () => {
    const response = await post({ request: request('not json') })

    expect(response.status).toBe(400)
  })
})
