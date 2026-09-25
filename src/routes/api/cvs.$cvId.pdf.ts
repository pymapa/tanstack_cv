import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { getCvRepository } from '~/server/repositories/instance'
import { exportCvPdf } from '~/server/services/pdf-export'

/*
 * SECURITY TODO (spec M2): no session/authz check yet; the dev server is localhost-only.
 * Add: session → 401, can('cv.export') → 404, audit event (see secure-server-fn skill).
 */

const Params = z.strictObject({
  cvId: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[0-9a-f-]+$/),
})
const Query = z.object({
  download: z.enum(['0', '1']).default('1'),
  contact: z.enum(['0', '1']).default('0'),
  anonymize: z.enum(['0', '1']).default('0'),
})

const plain = (status: number, body: string) =>
  new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } })

export const Route = createFileRoute('/api/cvs/$cvId/pdf')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const parsedParams = Params.safeParse(params)
        const query = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams))
        if (!parsedParams.success || !query.success) return plain(400, 'Invalid request')

        const result = await exportCvPdf(await getCvRepository(), parsedParams.data.cvId, {
          includeContact: query.data.contact === '1',
          anonymizeClients: query.data.anonymize === '1',
        })
        if (!result.ok) return plain(404, 'Not found')

        const disposition = query.data.download === '1' ? 'attachment' : 'inline'
        return new Response(new Blob([result.value.bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }), {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `${disposition}; filename="${result.value.fileName}"`,
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
          },
        })
      },
    },
  },
})
