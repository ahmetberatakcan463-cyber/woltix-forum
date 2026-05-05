'use client';
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Search, MessageSquare, FileText, User } from 'lucide-react';
import api from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';

const TABS = [
  { key: 'threads', icon: MessageSquare, label: 'threads' },
  { key: 'posts', icon: FileText, label: 'posts' },
  { key: 'users', icon: User, label: 'users' },
];

export default function SearchPage() {
  return <Suspense fallback={<div className="max-w-4xl mx-auto px-4 py-20 text-center font-mono text-accent-green animate-pulse">searching...</div>}><SearchContent /></Suspense>;
}

function SearchContent() {
  const searchParams = useSearchParams();
  const q = searchParams.get('q') || '';
  const [type, setType] = useState('threads');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (q.length < 2) return;
    setLoading(true);
    api.get(`/search?q=${encodeURIComponent(q)}&type=${type}`).then(r => {
      setResults(r.data.results);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [q, type]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Search className="w-5 h-5 text-accent-green" />
        <div>
          <h1 className="font-mono font-bold text-lg text-text-primary">
            search results for <span className="text-accent-green">"{q}"</span>
          </h1>
          <p className="font-mono text-xs text-text-muted">{results.length} result{results.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-bg-card border border-border rounded-xl p-1">
        {TABS.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setType(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg font-mono text-xs transition-colors ${type === key ? 'bg-accent-green text-bg-primary font-semibold' : 'text-text-muted hover:text-text-primary'}`}
          >
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="font-mono text-accent-green text-sm animate-pulse text-center py-12">searching...</div>
      )}

      {!loading && results.length === 0 && q && (
        <div className="text-center py-12">
          <p className="font-mono text-text-muted">no results found</p>
        </div>
      )}

      <div className="space-y-2">
        {type === 'threads' && results.map(r => (
          <Link key={r.id} href={`/t/${r.id}`}>
            <div className="bg-bg-card border border-border rounded-xl p-4 hover:border-accent-green/20 hover:bg-bg-tertiary transition-all group">
              <h3 className="font-mono text-sm font-semibold text-text-primary group-hover:text-accent-green transition-colors">{r.title}</h3>
              <div className="flex items-center gap-3 mt-1 font-mono text-xs text-text-muted">
                <span>{r.category_name}</span>
                <span>by {r.author}</span>
                <span>{r.reply_count} replies</span>
                <span>{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</span>
              </div>
            </div>
          </Link>
        ))}

        {type === 'posts' && results.map(r => (
          <Link key={r.id} href={`/t/${r.thread_id}`}>
            <div className="bg-bg-card border border-border rounded-xl p-4 hover:border-accent-green/20 hover:bg-bg-tertiary transition-all group">
              <p className="font-mono text-xs text-accent-green mb-1">{r.thread_title}</p>
              <p className="font-mono text-sm text-text-secondary line-clamp-2">{r.content}</p>
              <div className="flex items-center gap-3 mt-2 font-mono text-xs text-text-muted">
                <span>by {r.author}</span>
                <span>{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</span>
              </div>
            </div>
          </Link>
        ))}

        {type === 'users' && results.map(r => (
          <Link key={r.username} href={`/u/${r.username}`}>
            <div className="bg-bg-card border border-border rounded-xl p-4 hover:border-accent-green/20 hover:bg-bg-tertiary transition-all group flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl border border-border flex items-center justify-center font-mono font-bold text-accent-green text-sm bg-bg-tertiary shrink-0">
                {r.username[0].toUpperCase()}
              </div>
              <div>
                <p className="font-mono text-sm font-semibold text-text-primary group-hover:text-accent-green transition-colors">{r.username}</p>
                <p className="font-mono text-xs text-text-muted">{r.rank} · {r.post_count} posts · {r.reputation} rep</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
