'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const tools = [
  { name: 'Home', href: '/', emoji: '🏠' },
  { name: 'QR Code', href: '/qr', emoji: '📷' },
  { name: 'Color Picker', href: '/color-picker', emoji: '🎨' },
  { name: 'Background Remover', href: '/background-remover', emoji: '✂️' },
  { name: 'PDF Tools', href: '/pdf-tools', emoji: '📄' },
  { name: 'URL Shortener', href: '/url-shortener', emoji: '🔗' },
  { name: 'Text Share', href: '/text-share', emoji: '📝' },
  { name: 'Log Share', href: '/log-share', emoji: '📋' },
  { name: 'Image Tools', href: '/image-tools', emoji: '🖼️' },
  { name: 'JSON Tools', href: '/json-tools', emoji: '{}' },
  { name: 'Dev Tools', href: '/dev-tools', emoji: '🔧' },
  { name: 'Converters', href: '/converters', emoji: '🔄' },
  { name: 'Text Tools', href: '/text-tools', emoji: '✏️' },
  { name: 'Settings', href: '/settings', emoji: '⚙️' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Mobile Toggle Button */}
      <button 
        className="md:hidden fixed top-4 right-4 z-50 p-2 bg-[var(--card)] border border-[var(--card-border)] rounded-md shadow-sm"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="text-xl leading-none">☰</span>
      </button>

      {/* Sidebar Navigation */}
      <aside 
        className={`fixed md:sticky top-0 left-0 h-screen w-64 border-r border-[var(--card-border)] bg-[var(--background)] flex flex-col transition-transform z-40 
          ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
      >
        <div className="p-6">
          <Link href="/" className="text-xl font-bold tracking-tight text-[var(--foreground)]" onClick={() => setIsOpen(false)}>
            UtilityHub.
          </Link>
        </div>
        
        <nav className="flex-1 overflow-y-auto px-4 pb-4 space-y-1 scrollbar-thin">
          {tools.map(t => {
            const active = pathname === t.href || (t.href !== '/' && pathname.startsWith(t.href));
            return (
              <Link 
                key={t.href} 
                href={t.href}
                prefetch={false}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                  active 
                    ? 'bg-[var(--foreground)] text-[var(--background)] font-medium' 
                    : 'text-[var(--muted-text)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]'
                }`}
              >
                <span>{t.emoji}</span>
                {t.name}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-30 md:hidden backdrop-blur-sm transition-opacity" 
          onClick={() => setIsOpen(false)} 
        />
      )}
    </>
  );
}
