'use client';
import { useEffect, useState, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
import { ThumbsUp, ThumbsDown, Pin, Lock, Trash2, Edit2, MessageSquare, ChevronLeft, ChevronRight, Shield } from 'lucide-react';
import api from '@/lib/api';
import useAuthStore from '@/store/authStore';
import toast from 'react-hot-toast';
import { formatDistanceToNow, format } from 'date-fns';

const RANK_COLORS = {
  Newbie: 'text-text-secondary',
  Member: 'text-emerald-400',
  Regular: 'text-cyan-400',
  Veteran: 'text-yellow-400',
  Expert: 'text-accent-purple',
  Elite: 'text-accent-green',
  Legend: 'text-accent-red',
};

export default function ThreadPage() {
  return <Suspense fallback={<div className="max-w-5xl mx-auto px-4 py-20 text-center font-mono text-accent-green animate-pulse">loading thread...</div>}><ThreadContent /></Suspense>;
}

function ThreadContent() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [posting, setPosting] = useState(false);
  const replyRef = useRef(null);

  const page = parseInt(searchParams.get('page') || '1');

  useEffect(() => {
    setLoading(true);
    api.get(`/threads/${id}?page=${page}`).then(r => {
      setData(r.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id, page]);

  async function handleReply(e) {
    e.preventDefault();
    if (!reply.trim()) return;
    setPosting(true);
    try {
      const res = await api.post(`/threads/${id}/posts`, { content: reply });
      setData(prev => ({
        ...prev,
        posts: [...prev.posts, res.data],
        thread: { ...prev.thread, reply_count: prev.thread.reply_count + 1 },
      }));
      setReply('');
      toast.success('Reply posted');
      setTimeout(() => replyRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to post reply');
    } finally {
      setPosting(false);
    }
  }

  async function handleVote(postId, type) {
    if (!user) { toast.error('Login to vote'); return; }
    try {
      const res = await api.post(`/threads/posts/${postId}/vote`, { type });
      setData(prev => ({
        ...prev,
        posts: prev.posts.map(p => p.id === postId ? { ...p, votes: res.data.votes, userVote: p.userVote === type ? 0 : type } : p),
      }));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Vote failed');
    }
  }

  async function handleDelete(postId) {
    if (!confirm('Delete this post?')) return;
    try {
      await api.delete(`/admin/posts/${postId}`);
      setData(prev => ({ ...prev, posts: prev.posts.filter(p => p.id !== postId) }));
      toast.success('Post deleted');
    } catch {
      toast.error('Delete failed');
    }
  }

  if (loading) return (
    <div className="max-w-5xl mx-auto px-4 py-8 text-center py-20">
      <div className="font-mono text-accent-green animate-pulse">loading thread...</div>
    </div>
  );

  if (!data) return (
    <div className="max-w-5xl mx-auto px-4 py-8 text-center">
      <p className="font-mono text-text-muted">Thread not found</p>
    </div>
  );

  const { thread, posts, pages } = data;
  const isMod = user?.role === 'admin' || user?.role === 'moderator';

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 font-mono text-xs text-text-muted mb-6 flex-wrap">
        <Link href="/" className="hover:text-accent-green transition-colors">~/index</Link>
        <span>/</span>
        <Link href={`/c/${thread.category_slug}`} className="hover:text-accent-green transition-colors" style={{ color: thread.category_color }}>{thread.category_slug}</Link>
        <span>/</span>
        <span className="text-text-secondary truncate max-w-[200px]">{thread.title}</span>
      </div>

      {/* Thread header */}
      <div className="bg-bg-card border border-border rounded-xl p-5 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {thread.is_pinned && (
                <span className="font-mono text-[10px] bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/20 px-1.5 py-0.5 rounded flex items-center gap-1">
                  <Pin className="w-2.5 h-2.5" />PINNED
                </span>
              )}
              {thread.is_locked && (
                <span className="font-mono text-[10px] bg-accent-red/10 text-accent-red border border-accent-red/20 px-1.5 py-0.5 rounded flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" />LOCKED
                </span>
              )}
            </div>
            <h1 className="font-mono font-bold text-lg text-text-primary">{thread.title}</h1>
            <div className="flex items-center gap-3 mt-1 font-mono text-xs text-text-muted">
              <span>by <Link href={`/u/${thread.author}`} className="text-text-secondary hover:text-accent-green">{thread.author}</Link></span>
              <span>{formatDistanceToNow(new Date(thread.created_at), { addSuffix: true })}</span>
              <span>{thread.reply_count} replies</span>
              <span>{thread.view_count} views</span>
            </div>
          </div>

          {isMod && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => api.patch(`/threads/${thread.id}`, { is_pinned: !thread.is_pinned }).then(r => setData(p => ({ ...p, thread: r.data })))}
                className={`p-1.5 rounded text-text-muted hover:text-accent-yellow transition-colors ${thread.is_pinned ? 'text-accent-yellow' : ''}`}
                title="Toggle pin"
              >
                <Pin className="w-4 h-4" />
              </button>
              <button
                onClick={() => api.patch(`/threads/${thread.id}`, { is_locked: !thread.is_locked }).then(r => setData(p => ({ ...p, thread: r.data })))}
                className={`p-1.5 rounded text-text-muted hover:text-accent-red transition-colors ${thread.is_locked ? 'text-accent-red' : ''}`}
                title="Toggle lock"
              >
                <Lock className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Posts */}
      <div className="space-y-3">
        {posts.map((post, index) => (
          <PostCard
            key={post.id}
            post={post}
            index={(page - 1) * 20 + index + 1}
            user={user}
            isMod={isMod}
            onVote={handleVote}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 my-6 font-mono text-sm">
          {page > 1 && (
            <Link href={`/t/${id}?page=${page - 1}`} className="flex items-center gap-1 px-3 py-1.5 bg-bg-card border border-border rounded hover:border-accent-green/30 text-text-secondary hover:text-accent-green transition-colors">
              <ChevronLeft className="w-4 h-4" /> prev
            </Link>
          )}
          <span className="text-text-muted">{page} / {pages}</span>
          {page < pages && (
            <Link href={`/t/${id}?page=${page + 1}`} className="flex items-center gap-1 px-3 py-1.5 bg-bg-card border border-border rounded hover:border-accent-green/30 text-text-secondary hover:text-accent-green transition-colors">
              next <ChevronRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      )}

      {/* Reply box */}
      {user && !thread.is_locked && (
        <div ref={replyRef} className="bg-bg-card border border-border rounded-xl overflow-hidden mt-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-bg-tertiary border-b border-border">
            <MessageSquare className="w-4 h-4 text-accent-green" />
            <span className="font-mono text-xs text-text-muted">reply as <span className="text-accent-green">{user.username}</span></span>
          </div>
          <form onSubmit={handleReply} className="p-4">
            <textarea
              value={reply}
              onChange={e => setReply(e.target.value)}
              placeholder="Write your reply... (Markdown supported)"
              rows={5}
              className="w-full bg-bg-tertiary border border-border rounded-lg p-3 font-mono text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-green/50 transition-colors resize-y"
            />
            <div className="flex items-center justify-between mt-3">
              <span className="font-mono text-xs text-text-muted">markdown + code blocks supported</span>
              <button
                type="submit"
                disabled={posting || !reply.trim()}
                className="px-5 py-2 bg-accent-green text-bg-primary font-mono font-semibold text-sm rounded-lg hover:bg-accent-green/90 transition-colors disabled:opacity-40"
              >
                {posting ? 'posting...' : '> reply'}
              </button>
            </div>
          </form>
        </div>
      )}

      {thread.is_locked && (
        <div className="mt-4 px-4 py-3 bg-accent-red/5 border border-accent-red/20 rounded-lg font-mono text-sm text-accent-red text-center">
          <Lock className="w-4 h-4 inline mr-2" />Thread is locked
        </div>
      )}

      {!user && (
        <div className="mt-4 px-4 py-3 bg-bg-card border border-border rounded-lg font-mono text-sm text-text-secondary text-center">
          <Link href="/auth/login" className="text-accent-green hover:text-accent-purple">Login</Link> to reply
        </div>
      )}
    </div>
  );
}

function PostCard({ post, index, user, isMod, onVote, onDelete }) {
  const isAuthor = user?.id === post.user_id;
  const rankColor = RANK_COLORS[post.rank] || 'text-text-secondary';

  return (
    <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex gap-0">
        {/* Sidebar */}
        <div className="w-36 shrink-0 bg-bg-tertiary border-r border-border p-3 hidden sm:flex flex-col items-center text-center">
          <div className="w-10 h-10 rounded-full bg-bg-primary border border-border flex items-center justify-center font-mono font-bold text-accent-green text-sm mb-2">
            {post.username?.[0]?.toUpperCase() || '?'}
          </div>
          <Link href={`/u/${post.username}`} className="font-mono text-xs font-semibold text-text-primary hover:text-accent-green transition-colors truncate w-full text-center">
            {post.username || '[deleted]'}
          </Link>
          <span className={`font-mono text-[10px] mt-0.5 ${rankColor}`}>{post.rank}</span>
          {(post.role === 'admin' || post.role === 'moderator') && (
            <span className="font-mono text-[10px] text-accent-purple mt-0.5 flex items-center gap-0.5">
              <Shield className="w-2.5 h-2.5" />{post.role}
            </span>
          )}
          <div className="mt-2 space-y-0.5 text-[10px] font-mono text-text-muted">
            <p>{post.post_count} posts</p>
            <p>{post.reputation} rep</p>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-bg-tertiary">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-text-muted">#{index}</span>
              <span className="font-mono text-xs text-text-muted">
                {format(new Date(post.created_at), 'dd MMM yyyy, HH:mm')}
                {post.edited_at && <span className="ml-2 text-text-muted/60">(edited)</span>}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {(isMod || isAuthor) && (
                <button
                  onClick={() => onDelete(post.id)}
                  className="p-1 text-text-muted hover:text-accent-red transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="p-4">
            <div className="prose-woltix">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                {post.content}
              </ReactMarkdown>
            </div>

            {post.signature && (
              <div className="mt-4 pt-3 border-t border-border font-mono text-xs text-text-muted italic">
                {post.signature}
              </div>
            )}
          </div>

          {/* Vote bar */}
          <div className="flex items-center gap-3 px-4 py-2 border-t border-border">
            <button
              onClick={() => onVote(post.id, 1)}
              className={`flex items-center gap-1 font-mono text-xs transition-colors ${post.userVote === 1 ? 'text-accent-green' : 'text-text-muted hover:text-accent-green'}`}
            >
              <ThumbsUp className="w-3.5 h-3.5" />
            </button>
            <span className={`font-mono text-xs font-semibold ${post.votes > 0 ? 'text-accent-green' : post.votes < 0 ? 'text-accent-red' : 'text-text-muted'}`}>
              {post.votes > 0 ? '+' : ''}{post.votes}
            </span>
            <button
              onClick={() => onVote(post.id, -1)}
              className={`flex items-center gap-1 font-mono text-xs transition-colors ${post.userVote === -1 ? 'text-accent-red' : 'text-text-muted hover:text-accent-red'}`}
            >
              <ThumbsDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
