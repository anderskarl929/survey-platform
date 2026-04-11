export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-surface border-b border-border-light sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <a href="/student" className="font-bold text-foreground hover:text-primary transition-colors text-sm tracking-tight">
              Dashboard
            </a>
            <a href="/student/results" className="text-sm text-muted hover:text-foreground transition-colors">
              Mina resultat
            </a>
          </div>
          <form action="/api/student/logout" method="POST">
            <button
              type="submit"
              className="btn-secondary text-xs"
            >
              Logga ut
            </button>
          </form>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
