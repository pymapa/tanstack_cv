import { describe, expect, it } from 'vitest'
import type { CvLinks } from '~/lib/cv-links'
import { linkCvs } from '~/lib/cv-tools'
import { getCvRepository } from '~/server/repositories/instance'

describe('linkCvs tool', () => {
  it('should link a sample CV file to the page that shows that CV version', async () => {
    const result = (await linkCvs.execute?.({ files: ['p10-v3.json'] })) as CvLinks | undefined

    const cvId = result?.cvs[0]?.url.replace('/cvs/', '') ?? ''
    const cv = (await getCvRepository()).getCv(cvId)
    expect(cv?.variant).toBe('PM-PO')
    expect(result?.filterUrl).toContain(encodeURIComponent(cvId))
  })
})
