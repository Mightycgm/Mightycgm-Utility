import Link from 'next/link';
import Navbar from './Navbar';
import Footer from './Footer';

interface Props {
  title: string;
  description: string;
  emoji: string;
  children: React.ReactNode;
}

export default function ToolPageWrapper({ title, description, emoji, children }: Props) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        {/* Hero */}
        <div className="border-b border-gray-800 bg-gradient-to-b from-gray-900 to-transparent">
          <div className="max-w-5xl mx-auto px-4 py-10">
            <Link href="/" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-indigo-400 mb-6 transition-colors">
              ← Back to all tools
            </Link>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-900/40 border border-indigo-500/30 flex items-center justify-center text-3xl">
                {emoji}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">{title}</h1>
                <p className="text-gray-400 text-sm mt-1">{description}</p>
              </div>
            </div>
          </div>
        </div>
        {/* Content */}
        <div className="max-w-5xl mx-auto px-4 py-10">{children}</div>
      </main>
      <Footer />
    </div>
  );
}
