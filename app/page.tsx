import type { Metadata } from 'next';
import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: 'UtilityHub — Free Online Tools',
  description:
    'All-in-one free online utility tools: QR code generator/decoder, AI background remover, PDF tools, color picker (7 types), text/log sharing, JSON formatter, Base64, hash generator, unit converter, and more.',
};

const toolCategories = [
  {
    category: 'Media & Images',
    emoji: '🎨',
    tools: [
      { name: 'QR Code Suite', description: 'Generate & decode QR codes', href: '/qr', emoji: '📷', tags: ['generate', 'decode', 'scan'] },
      { name: 'Background Remover', description: 'Remove BG with AI — client-side', href: '/background-remover', emoji: '✂️', tags: ['ai', 'image', 'png'] },
      { name: 'Color Picker', description: '7 picker types + format converter', href: '/color-picker', emoji: '🎨', tags: ['hex', 'rgb', 'hsl', 'cmyk'] },
      { name: 'Image Tools', description: 'Compress & convert images', href: '/image-tools', emoji: '🖼️', tags: ['compress', 'webp', 'png', 'jpg'] },
    ],
  },
  {
    category: 'PDF Tools',
    emoji: '📄',
    tools: [
      { name: 'PDF Tools', description: 'Merge, split, PDF↔Images', href: '/pdf-tools', emoji: '📄', tags: ['merge', 'split', 'pdf'] },
    ],
  },
  {
    category: 'Sharing',
    emoji: '🔗',
    tools: [
      { name: 'Text Share', description: 'Share long text via short link', href: '/text-share', emoji: '📝', tags: ['paste', 'share', 'link'] },
      { name: 'Log Share', description: 'Share logs with syntax highlight', href: '/log-share', emoji: '📋', tags: ['logs', 'debug', 'code'] },
    ],
  },
  {
    category: 'Developer Tools',
    emoji: '🔧',
    tools: [
      { name: 'JSON Tools', description: 'Format, validate & minify JSON', href: '/json-tools', emoji: '{}', tags: ['json', 'format', 'validate'] },
      { name: 'Dev Tools', description: 'Base64, Hash, JWT, UUID, Regex', href: '/dev-tools', emoji: '🔧', tags: ['base64', 'sha256', 'jwt', 'uuid', 'regex'] },
      { name: 'Text Tools', description: 'Diff, Markdown preview, Word count', href: '/text-tools', emoji: '✏️', tags: ['diff', 'markdown', 'count'] },
    ],
  },
  {
    category: 'Converters',
    emoji: '🔄',
    tools: [
      { name: 'Converters', description: 'Unit, number base & timestamp', href: '/converters', emoji: '🔄', tags: ['unit', 'binary', 'hex', 'timestamp', 'epoch'] },
    ],
  },
];

const allTools = toolCategories.flatMap(c => c.tools);

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-transparent to-transparent" />
          <div className="relative max-w-5xl mx-auto px-4 py-24 text-center">
            <div className="inline-flex items-center gap-2 bg-indigo-900/30 border border-indigo-500/30 rounded-full px-4 py-2 text-sm text-indigo-300 mb-8">
              <span className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" />
              Free • No login • Privacy-first
            </div>
            <h1 className="text-5xl md:text-7xl font-extrabold mb-6">
              <span className="gradient-text">UtilityHub</span>
            </h1>
            <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
              All-in-one collection of free online tools. Process everything locally — your data never leaves your browser.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {allTools.slice(0, 6).map(t => (
                <Link
                  key={t.href}
                  href={t.href}
                  className="btn-primary text-sm"
                >
                  {t.emoji} {t.name}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Tool Grid */}
        <section className="max-w-7xl mx-auto px-4 pb-20">
          {toolCategories.map(cat => (
            <div key={cat.category} className="mb-12">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                <span>{cat.emoji}</span>
                {cat.category}
                <div className="flex-1 h-px bg-gray-800 ml-4" />
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {cat.tools.map(tool => (
                  <Link key={tool.href} href={tool.href} className="tool-card p-5 flex flex-col gap-3 group">
                    <div className="w-10 h-10 rounded-xl bg-indigo-900/40 border border-indigo-500/20 flex items-center justify-center text-xl group-hover:border-indigo-500/60 transition-colors">
                      {tool.emoji}
                    </div>
                    <div>
                      <h3 className="font-semibold text-white text-sm">{tool.name}</h3>
                      <p className="text-xs text-gray-500 mt-1">{tool.description}</p>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-auto">
                      {tool.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-xs bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full">{tag}</span>
                      ))}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </section>

        {/* Stats */}
        <section className="border-y border-gray-800 py-12 mb-0">
          <div className="max-w-4xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[['12+', 'Tools Available'], ['100%', 'Free Forever'], ['0', 'Data Uploaded'], ['∞', 'No Rate Limits']].map(([val, label]) => (
              <div key={label}>
                <div className="text-3xl font-extrabold gradient-text">{val}</div>
                <div className="text-sm text-gray-500 mt-1">{label}</div>
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
