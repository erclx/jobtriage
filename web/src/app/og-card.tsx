import { ImageResponse } from 'next/og'

// Mirrors the README hook. Keep aligned with hero copy on copy changes.
// The subhead below is a verbatim mock-mode chip, kept in sync with web/src/features/mock/prompts.ts.
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
            display: 'flex',
            alignItems: 'center',
            gap: '32px',
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 32 32"
            width="160"
            height="160"
          >
            <rect width="32" height="32" rx="6" fill="#0a0a0a" />
            <circle cx="19" cy="9" r="2.5" fill="#fafafa" />
            <path
              d="M19 14 V21 a5 5 0 0 1 -5 5 H10"
              fill="none"
              stroke="#fafafa"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div
            style={{
              fontSize: 168,
              lineHeight: 1,
              letterSpacing: '-0.04em',
            }}
          >
            jobtriage
          </div>
        </div>
        <div
          style={{
            fontSize: 44,
            lineHeight: 1.3,
            color: '#525252',
            maxWidth: 1000,
          }}
        >
          "Find Stockholm nursing roles ranked against my profile"
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
        <span>Try the demo, no key needed</span>
      </div>
    </div>,
    { ...ogCardSize },
  )
}
