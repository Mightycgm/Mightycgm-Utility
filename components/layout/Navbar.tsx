'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const tools = [
  { name: 'QR Code', href: '/qr', emoji: '📷' },
  { name: 'Color Picker', href: '/color-picker', emoji: '🎨' },
  { name: 'Background Remover', href: '/background-remover', emoji: '🖼️' },
  { name: 'PDF Tools', href: '/pdf-tools', emoji: '📄' },
  { name: 'Text Share', href: '/text-share', emoji: '📝' },
  { name: 'Log Share', href: '/log-share', emoji: '📋' },
  { name: 'Image Tools', href: '/image-tools', emoji: '🖼️' },
  { name: 'JSON Tools', href: '/json-tools', emoji: '{}' },
  { name: 'Dev Tools', href: '/dev-tools', emoji: '🔧' },
  { name: 'Converters', href: '/converters', emoji: '🔄' },
  { name: 'Text Tools', href: '/text-tools', emoji: '✏️' },
  { name: 'Settings', href: '/settings', emoji: '⚙️' },
];

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const router = useRouter();

  const filtered = tools.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <nav className="sticky top-0 z-50 glass border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-16">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-bold text-xl">
          <span className="text-2xl">⚡</span>
          <span className="gradient-text">UtilityHub</span>
        </Link>

        {/* Search bar */}
        <div className="hidden md:flex items-center gap-2 flex-1 max-w-xs mx-6 relative">
          <input
            className="input-field py-2 text-sm"
            placeholder="Search tools..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={() => setMenuOpen(true)}
            onBlur={() => setTimeout(() => setMenuOpen(false), 200)}
          />
          {menuOpen && search && (
            <div className="absolute top-full mt-2 w-full bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
              {filtered.length === 0 ? (
                <p className="p-3 text-sm text-gray-500">No tools found</p>
              ) : (
                filtered.map(t => (
                  <Link
                    key={t.href}
                    href={t.href}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-indigo-900/30 text-sm"
                    onClick={() => { setSearch(''); setMenuOpen(false); }}
                  >
                    <span>{t.emoji}</span>
                    <span>{t.name}</span>
                  </Link>
                ))
              )}
            </div>
          )}
        </div>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-1">
          {tools.slice(0, 5).map(t => (
            <Link
              key={t.href}
              href={t.href}
              className="px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            >
              {t.name}
            </Link>
          ))}
          <Link
            href="/settings"
            className="ml-2 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            ⚙️
          </Link>
        </div>

        {/* Mobile menu */}
        <button
          className="md:hidden p-2 rounded-lg hover:bg-gray-800"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <span className="text-xl">{menuOpen ? '✕' : '☰'}</span>
        </button>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="md:hidden border-t border-gray-800 bg-gray-900">
          <div className="p-4">
            <input
              className="input-field text-sm mb-3"
              placeholder="Search tools..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              {(search ? filtered : tools).map(t => (
                <Link
                  key={t.href}
                  href={t.href}
                  className="flex items-center gap-2 p-3 rounded-lg hover:bg-gray-800 text-sm"
                  onClick={() => setMenuOpen(false)}
                >
                  <span>{t.emoji}</span>
                  <span className="text-gray-300">{t.name}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
