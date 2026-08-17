import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/layout/Sidebar';

export const metadata: Metadata = {
  title: {
    default: 'UtilityHub — Free Online Tools',
    template: '%s | UtilityHub',
  },
  description:
    'UtilityHub: Free online tools — QR code generator/decoder, background remover, PDF tools, color picker, text sharing, JSON formatter, dev tools and more. No login required.',
  keywords: [
    'online tools', 'qr code', 'background remover', 'pdf tools', 'color picker',
    'json formatter', 'base64', 'hash generator', 'text share', 'image compressor',
    'unit converter', 'timestamp converter', 'utility', 'free tools',
  ],
  authors: [{ name: 'Mightycgm' }],
  creator: 'Mightycgm',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://mightycgm.github.io/Mightycgm-Utility',
    siteName: 'UtilityHub',
    title: 'UtilityHub — Free Online Tools',
    description: 'Free online tools: QR code, background remover, PDF, color picker and more.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'UtilityHub — Free Online Tools',
    description: 'Free online tools: QR code, background remover, PDF, color picker and more.',
    creator: '@Mightycgm',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: 'UtilityHub',
              url: 'https://mightycgm.github.io/Mightycgm-Utility',
              description: 'Free online utility tools',
              potentialAction: {
                '@type': 'SearchAction',
                target: 'https://mightycgm.github.io/Mightycgm-Utility?q={search_term_string}',
                'query-input': 'required name=search_term_string',
              },
            }),
          }}
        />
      </head>
      <body className="antialiased flex h-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
        <Sidebar />
        <main className="flex-1 h-screen overflow-y-auto relative">
          {children}
        </main>
      </body>
    </html>
  );
}
