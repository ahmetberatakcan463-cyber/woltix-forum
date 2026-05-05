import { Terminal } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t border-border bg-bg-secondary mt-16">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-accent-green" />
            <span className="font-mono font-bold text-accent-green text-sm">WOLTIX</span>
            <span className="font-mono text-text-muted text-xs">/forum — hack the planet</span>
          </div>
          <div className="flex items-center gap-6 text-xs font-mono text-text-muted">
            <span>© 2025 Woltix</span>
            <span className="text-text-muted/30">|</span>
            <span>
              <span className="text-accent-green animate-pulse-green inline-block w-1.5 h-1.5 rounded-full bg-accent-green mr-1.5" />
              systems operational
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
