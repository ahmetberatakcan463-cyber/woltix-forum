'use client';
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Plus, Pin, Lock, Clock, MessageSquare, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '@/lib/api';
import useAuthStore from '@/store/authStore';
import { formatDistanceToNow } from 'date-fns';

export default function CategoryPage() {
  return <Suspense fallback={<div className="max-w-5xl mx-auto px-4 py-20 text-center font-mono text-accent-green animate-pulse">loading...</div>}><CategoryContent /></Suspense>;
}

function CategoryContent() {
  const { slug } = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const page = parseInt(searchParams.get('page') || '1');

  useEffect(() => {
    setLoading(true);
    api.get(`/categories/${slug}?page=${page}`).then(r => {
      setData(r.data);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
      router.push('/');
    });
  }, [slug, page]);

  if (loading) return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="font-mono text-accent-green text-sm animate-pulse text-center py-20">loading...</div>
    </div>
  );

  if (!data) return null;
  const { category, threads, total, pages } = data;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 font-mono text-xs text-text-muted mb-6">
        <Link href="/" className="hover:text-accent-green transition-colors">~/index</Link>
        <span>/</span>
        <span style={{ color: category.color }}>{category.slug}</span>
      </div>

      {/* Category header */}
      <div className="bg-bg-card border border-border rounded-xl p-6 mb-6" style={{ borderColor: `${category.color}20` }}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl border"
              style={{ borderColor: `${category.color}30`, background: `${category.color}10` }}
            >
              {category.icon}
            </div>
            <div>
              <h1 className="font-mono font-bold text-xl" style={{ color: category.color }}>{category.name}</h1>
              <p className="text-text-secondary text-sm mt-0.5">{category.description}</p>
              <div className="flex items-center gap-4 mt-1 font-mono text-xs text-text-muted">
                <span>{category.thread_count} threads</span>
                <span>{category.post_count} posts</span>
              </div>
            </div>
          </div>

          {user && (
            <Link href={`/t/new?category=${category.id}`}>
              <button className="flex items-center gap-2 px-4 py-2 bg-accent-green text-bg-primary rounded-lg font-mono font-semibold text-sm hover:bg-accent-green/90 transition-colors">
                <Plus className="w-4 h-4" />
                new thread
              </button>
            </Link>
          )}
        </div>
      </div>

      {/* Thread list */}
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-bg-tertiary border-b border-border text-xs font-mono text-text-muted">
          <div className="col-span-6">thread</div>
          <div className="col-span-2 text-center hidden sm:block">replies</div>
          <div className="col-span-2 text-center hidden sm:block">views</div>
          <div className="col-span-4 sm:col-span-2">last post</div>
        </div>

        {threads.length === 0 ? (
          <div className="px-4 py-12 text-center font-mono text-text-muted text-sm">
            no threads yet. be the first!
          </div>
        ) : (
          threads.map(thread => <ThreadRow key={thread.id} thread={thread} />)
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6 font-mono text-sm">
          {page > 1 && (
            <Link href={`/c/${slug}?page=${page - 1}`} className="flex items-center gap-1 px-3 py-1.5 bg-bg-card border border-border rounded hover:border-accent-green/30 text-text-secondary hover:text-accent-green transition-colors">
              <ChevronLeft className="w-4 h-4" /> prev
            </Link>
          )}
          <span className="text-text-muted">{page} / {pages}</span>
          {page < pages && (
            <Link href={`/c/${slug}?page=${page + 1}`} className="flex items-center gap-1 px-3 py-1.5 bg-bg-card border border-border rounded hover:border-accent-green/30 text-text-secondary hover:text-accent-green transition-colors">
              next <ChevronRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function ThreadRow({ thread }) {
  return (
    <Link href={`/t/${thread.id}`}>
      <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-border last:border-b-0 hover:bg-bg-tertiary transition-colors group">
        <div className="col-span-8 sm:col-span-6 flex items-start gap-2 min-w-0">
          <div className="mt-0.5 shrink-0">
            {thread.is_pinned && <Pin className="w-3.5 h-3.5 text-accent-yellow" />}
            {!thread.is_pinned && <MessageSquare className="w-3.5 h-3.5 text-text-muted" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {thread.is_pinned && (
                <span className="font-mono text-[10px] bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/20 px-1.5 py-0.5 rounded">PINNED</span>
              )}
              {thread.is_locked && (
                <span className="font-mono text-[10px] bg-accent-red/10 text-accent-red border border-accent-red/20 px-1.5 py-0.5 rounded flex items-center gap-1"><Lock className="w-2.5 h-2.5" />LOCKED</span>
              )}
              <h3 className="font-mono text-sm text-text-primary group-hover:text-accent-green transition-colors truncate">{thread.title}</h3>
            </div>
            <p className="font-mono text-xs text-text-muted mt-0.5">
              by <span className="text-text-secondary">{thread.author}</span>
              {' · '}{formatDistanceToNow(new Date(thread.created_at), { addSuffix: true })}
            </p>
          </div>
        </div>

        <div className="col-span-2 text-center font-mono text-sm text-text-secondary self-center hidden sm:block">
          {thread.reply_count}
        </div>
        <div className="col-span-2 text-center font-mono text-sm text-text-muted self-center hidden sm:flex items-center justify-center gap-1">
          <Eye className="w-3 h-3" />{thread.view_count}
        </div>
        <div className="col-span-4 sm:col-span-2 self-center">
          <div className="font-mono text-xs text-text-muted">
            <p className="text-text-secondary truncate">{thread.last_reply_user || thread.author}</p>
            <p className="text-text-muted text-[10px]">{formatDistanceToNow(new Date(thread.last_reply_at), { addSuffix: true })}</p>
          </div>
        </div>
      </div>
    </Link>
  );
}
