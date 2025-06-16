import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Quant Bot',
  description: 'QuantBot v3.0 - Enterprise Dashboard Edition',
  generator: 'v0.dev',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
