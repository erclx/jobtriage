import { ImageResponse } from 'next/og'

// Mirrors the README hook. Keep the two strings aligned when copy changes.
export const ogCardAlt =
  'jobtriage: triage Swedish job ads against any profile in a live agent workspace'
export const ogCardSize = { width: 1200, height: 630 }
export const ogCardContentType = 'image/png'

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'https://jobtriage.vercel.app')

export function renderOgCard() {
  const displayUrl = SITE_URL.replace(/^https?:\/\//, '')
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '80px',
        backgroundColor: '#fafafa',
        color: '#0a0a0a',
        fontFamily: 'Geist',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '40px',
        }}
      >
        <div
          style={{
            fontSize: 168,
            lineHeight: 1,
            letterSpacing: '-0.04em',
          }}
        >
          jobtriage
        </div>
        <div
          style={{
            fontSize: 44,
            lineHeight: 1.3,
            color: '#525252',
            maxWidth: 1000,
          }}
        >
          "Show me agentic AI roles in Sweden ranked by my profile fit"
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 28,
          color: '#737373',
        }}
      >
        <span>{displayUrl}</span>
        <span>Bring your own key</span>
      </div>
    </div>,
    { ...ogCardSize },
  )
}
