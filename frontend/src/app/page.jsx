'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MessageSquare, Users, TrendingUp, Clock, ChevronRight, Lock, Pin } from 'lucide-react';
import api from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';

export default function HomePage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/categories').then(r => {
      setCategories(r.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Hero */}
      <div className="mb-10 text-center">
        <div className="inline-block mb-4">
          <div className="font-mono text-text-muted text-sm mb-1">[root@woltix ~]$</div>
          <h1 className="font-mono text-3xl md:text-4xl font-bold text-accent-green glow-green">
            WOLTIX FORUM<span className="animate-blink">_</span>
          </h1>
          <p className="font-mono text-text-secondary text-sm mt-2">// where hackers converge</p>
        </div>
      </div>

      {/* Stats bar */}
      <StatsBar categories={categories} />

      {/* Categories */}
      <div className="space-y-2">
        {categories.map(cat => (
          <CategoryCard key={cat.id} category={cat} />
        ))}
      </div>
    </div>
  );
}

function StatsBar({ categories }) {
  const totalThreads = categories.reduce((s, c) => s + (c.thread_count || 0), 0);
  const totalPosts = categories.reduce((s, c) => s + (c.post_count || 0), 0);

  return (
    <div className="grid grid-cols-3 gap-3 mb-8">
      {[
        { icon: MessageSquare, label: 'threads', value: totalThreads },
        { icon: TrendingUp, label: 'posts', value: totalPosts },
        { icon: Users, label: 'categories', value: categories.length },
      ].map(({ icon: Icon, label, value }) => (
        <div key={label} className="bg-bg-card border border-border rounded-lg p-4 text-center">
          <Icon className="w-4 h-4 text-accent-green mx-auto mb-1" />
          <div className="font-mono font-bold text-accent-green text-xl">{value.toLocaleString()}</div>
          <div className="font-mono text-text-muted text-xs">{label}</div>
        </div>
      ))}
    </div>
  );
}

function CategoryCard({ category }) {
  return (
    <Link href={`/c/${category.slug}`}>
      <div
        className="group bg-bg-card border border-border hover:border-opacity-60 rounded-lg p-4 transition-all duration-150 hover:bg-bg-tertiary cursor-pointer"
        style={{ '--cat-color': category.color }}
      >
        <div className="flex items-center gap-4">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0 border"
            style={{ borderColor: `${category.color}30`, background: `${category.color}10` }}
          >
            {category.icon}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h2
                className="font-mono font-semibold text-sm group-hover:opacity-80 transition-opacity"
                style={{ color: category.color }}
              >
                {category.name}
              </h2>
              {category.is_private && <Lock className="w-3 h-3 text-text-muted" />}
            </div>
            <p className="text-text-secondary text-xs truncate">{category.description}</p>
          </div>

          <div className="hidden sm:flex items-center gap-6 text-xs font-mono text-text-muted shrink-0">
            <div className="text-center">
              <div className="text-text-primary font-semibold">{(category.thread_count || 0).toLocaleString()}</div>
              <div>threads</div>
            </div>
            <div className="text-center">
              <div className="text-text-primary font-semibold">{(category.post_count || 0).toLocaleString()}</div>
              <div>posts</div>
            </div>
          </div>

          <div className="hidden lg:block shrink-0 max-w-[200px]">
            {category.last_thread_title ? (
              <div className="text-xs font-mono">
                <p className="text-text-muted mb-0.5 flex items-center gap-1"><Clock className="w-3 h-3" /> latest</p>
                <p className="text-text-secondary truncate">{category.last_thread_title}</p>
              </div>
            ) : (
              <span className="text-text-muted text-xs font-mono">no threads yet</span>
            )}
          </div>

          <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-accent-green transition-colors shrink-0" />
        </div>
      </div>
    </Link>
  );
}

function LoadingState() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="text-center py-20">
        <div className="font-mono text-accent-green text-sm animate-pulse">initializing...</div>
      </div>
    </div>
  );
}
