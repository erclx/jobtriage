import './globals.css'

export const metadata = {
  title: 'jobtriage',
  description: 'Free-form chat over Swedish JobTech ads',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
