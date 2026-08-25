import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'UtilityHub — Free Online Tools',
  description:
    'All-in-one free online utility tools: QR code generator/decoder, AI background remover, PDF tools, color picker (7 types), text/log sharing, JSON formatter, Base64, hash generator, unit converter, and more.',
};

const toolCategories = [
  {
    category: 'Media & Images',
    tools: [
      { name: 'QR Code Suite', description: 'Generate & decode QR codes', href: '/qr', emoji: '📷' },
      { name: 'Background Remover', description: 'Remove BG with AI — client-side', href: '/background-remover', emoji: '✂️' },
      { name: 'Color Picker', description: '7 picker types + format converter', href: '/color-picker', emoji: '🎨' },
      { name: 'Image Tools', description: 'Compress & convert images', href: '/image-tools', emoji: '🖼️' },
    ],
  },
  {
    category: 'PDF Tools',
    tools: [
      { name: 'PDF Tools', description: 'PDF to Markdown (.md), Merge, Split, PDF↔Images', href: '/pdf-tools', emoji: '📄' },
    ],
  },
  {
    category: 'Sharing & Links',
    tools: [
      { name: 'URL Shortener', description: 'Create short, shareable links', href: '/url-shortener', emoji: '🔗' },
      { name: 'Text Share', description: 'Share long text via short link', href: '/text-share', emoji: '📝' },
      { name: 'Log Share', description: 'Share logs with syntax highlight', href: '/log-share', emoji: '📋' },
    ],
  },
  {
    category: 'Developer Tools',
    tools: [
      { name: 'JSON Tools', description: 'Format, validate & minify JSON', href: '/json-tools', emoji: '{}' },
      { name: 'Dev Tools', description: 'Base64, Hash, JWT, UUID, Regex', href: '/dev-tools', emoji: '🔧' },
      { name: 'Text Tools', description: 'Diff, Markdown preview, Word count', href: '/text-tools', emoji: '✏️' },
    ],
  },
  {
    category: 'Converters',
    tools: [
      { name: 'Converters', description: 'Unit, number base & timestamp', href: '/converters', emoji: '🔄' },
    ],
  },
];

export default function HomePage() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-12 md:py-20">
      
      {/* Minimal Hero */}
      <div className="mb-16">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
          UtilityHub.
        </h1>
        <p className="text-lg text-[var(--muted-text)] max-w-2xl">
          A collection of clean, fast, and privacy-first online tools. 
          Everything runs entirely in your browser.
        </p>
      </div>

      {/* Tools Grid Minimal */}
      <div className="space-y-16">
        {toolCategories.map(cat => (
          <div key={cat.category}>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--muted-text)] mb-6">
              {cat.category}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {cat.tools.map(tool => (
                <Link 
                  key={tool.href} 
                  href={tool.href} 
                  prefetch={false}
                  className="tool-card p-5 flex flex-col gap-3 group"
                >
                  <div className="w-10 h-10 rounded-md bg-[var(--muted)] flex items-center justify-center text-xl">
                    {tool.emoji}
                  </div>
                  <div>
                    <h3 className="font-medium text-[var(--foreground)] text-sm mb-1">{tool.name}</h3>
                    <p className="text-xs text-[var(--muted-text)] leading-relaxed">
                      {tool.description}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      <footer className="mt-20 pt-8 border-t border-[var(--card-border)] text-xs text-[var(--muted-text)] flex justify-between items-center">
        <p>© {new Date().getFullYear()} UtilityHub.</p>
        <a href="https://github.com/Mightycgm/Mightycgm-Utility" target="_blank" rel="noreferrer" className="hover:text-[var(--foreground)] transition-colors">
          GitHub
        </a>
      </footer>
    </div>
  );
}

