// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CvChatWidget from '~/components/CvChatWidget'

vi.mock('@tanstack/react-router', () => ({ useRouter: () => ({ navigate: vi.fn() }) }))

const pdf = () => new File(['%PDF-1.7 spec'], 'spec.pdf', { type: 'application/pdf' })

const fetchSpy = vi.fn(() => new Response('', { status: 200, headers: { 'content-type': 'text/event-stream' } }))

beforeEach(() => {
  fetchSpy.mockClear()
  vi.stubGlobal('fetch', fetchSpy)
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const openChat = async () => {
  const user = userEvent.setup()
  const history = { load: () => Promise.resolve([]), save: () => Promise.resolve(), clear: () => Promise.resolve() }
  render(<CvChatWidget history={history} />)
  await user.click(screen.getByRole('button', { name: 'Open CV assistant' }))
  return user
}

const sentParts = (): Array<{ type: string }> => {
  const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit]
  const body = JSON.parse(init.body as string) as { messages: Array<{ content: Array<{ type: string }> }> }
  return body.messages.at(-1)?.content ?? []
}

describe('CvChatWidget work spec attachments', () => {
  it('should show a picked PDF as a removable attachment', async () => {
    const user = await openChat()

    await user.upload(screen.getByLabelText('Attach a work spec'), pdf())

    expect(await screen.findByRole('button', { name: 'Remove spec.pdf' })).toBeInTheDocument()
  })

  it('should attach a file dropped on the chat panel', async () => {
    await openChat()

    fireEvent.drop(screen.getByRole('region', { name: 'CV assistant' }), { dataTransfer: { files: [pdf()] } })

    expect(await screen.findByRole('button', { name: 'Remove spec.pdf' })).toBeInTheDocument()
  })

  it('should remove an attachment when its remove button is clicked', async () => {
    const user = await openChat()
    await user.upload(screen.getByLabelText('Attach a work spec'), pdf())

    await user.click(await screen.findByRole('button', { name: 'Remove spec.pdf' }))

    expect(screen.queryByRole('button', { name: 'Remove spec.pdf' })).not.toBeInTheDocument()
  })

  it('should explain why a file was not attached when its type is not supported', async () => {
    await openChat()

    fireEvent.drop(screen.getByRole('region', { name: 'CV assistant' }), {
      dataTransfer: { files: [new File(['x'], 'spec.docx', { type: 'application/msword' })] },
    })

    expect(await screen.findByRole('alert')).toHaveTextContent('spec.docx is not a PDF, .txt or .md file.')
    expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument()
  })

  it('should send the PDF as a document part with a default request when the message is empty', async () => {
    const user = await openChat()
    await user.upload(screen.getByLabelText('Attach a work spec'), pdf())
    await screen.findByRole('button', { name: 'Remove spec.pdf' })

    await user.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled()
    })
    expect(sentParts()).toEqual([
      expect.objectContaining({ type: 'document', source: expect.objectContaining({ mimeType: 'application/pdf' }) }),
      expect.objectContaining({ type: 'text', text: 'Find suitable CVs for this work spec.' }),
    ])
    expect(screen.queryByRole('button', { name: 'Remove spec.pdf' })).not.toBeInTheDocument()
  })

  it('should show the attached file name in the sent message', async () => {
    const user = await openChat()
    await user.upload(screen.getByLabelText('Attach a work spec'), pdf())
    await screen.findByRole('button', { name: 'Remove spec.pdf' })

    await user.click(screen.getByRole('button', { name: 'Send' }))

    expect(await screen.findByText('spec.pdf')).toBeInTheDocument()
  })
})
