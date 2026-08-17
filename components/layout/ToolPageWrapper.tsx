interface Props {
  title: string;
  description: string;
  emoji: string;
  children: React.ReactNode;
}

export default function ToolPageWrapper({ title, description, emoji, children }: Props) {
  return (
    <div className="max-w-5xl mx-auto px-6 py-10 md:py-14">
      <div className="mb-10 pb-6 border-b border-[var(--card-border)]">
        <h1 className="text-2xl font-bold tracking-tight mb-2 text-[var(--foreground)]">
          <span className="mr-3">{emoji}</span>
          {title}
        </h1>
        <p className="text-[var(--muted-text)] text-sm">
          {description}
        </p>
      </div>
      <div>
        {children}
      </div>
    </div>
  );
}
