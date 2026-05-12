import { afterEach, describe, expect, it, vi } from 'vitest'

import { triggerDownload } from './download'

describe('triggerDownload', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('should create a blob URL with the given mime type, click an anchor with the filename, then revoke the URL', () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:fake-url')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL,
      revokeObjectURL,
    })
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})

    triggerDownload({
      content: '# heading\n',
      mimeType: 'text/markdown',
      filename: 'shortlist_2026-05-12.md',
    })

    const blob = createObjectURL.mock.calls[0]?.[0] as Blob
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('text/markdown;charset=utf-8')
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake-url')
  })
})
