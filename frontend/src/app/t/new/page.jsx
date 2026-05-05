'use client';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
import { PenSquare, Eye } from 'lucide-react';
import api from '@/lib/api';
import useAuthStore from '@/store/authStore';
import toast from 'react-hot-toast';

export default function NewThreadPage() {
  return <Suspense fallback={<div className="max-w-4xl mx-auto px-4 py-20 text-center font-mono text-accent-green animate-pulse">loading...</div>}><NewThreadContent /></Suspense>;
}

function NewThreadContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ title: '', content: '', category_id: searchParams.get('category') || '' });
  const [preview, setPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) { router.push('/auth/login'); return; }
    api.get('/categories').then(r => setCategories(r.data));
  }, [user]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim() || !form.category_id) {
      toast.error('All fields required');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post('/threads', form);
      toast.success('Thread created');
      router.push(`/t/${res.data.thread.id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create thread');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 font-mono text-xs text-text-muted mb-6">
        <Link href="/" className="hover:text-accent-green transition-colors">~/index</Link>
        <span>/</span>
        <span className="text-text-secondary">new thread</span>
      </div>

      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-bg-tertiary border-b border-border">
          <PenSquare className="w-4 h-4 text-accent-green" />
          <span className="font-mono text-sm font-semibold text-accent-green">new thread</span>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Category */}
          <div>
            <label className="block font-mono text-xs text-text-muted mb-1.5">category</label>
            <select
              value={form.category_id}
              onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
              required
              className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2.5 font-mono text-sm text-text-primary focus:outline-none focus:border-accent-green/50 transition-colors"
            >
              <option value="">select category...</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block font-mono text-xs text-text-muted mb-1.5">title</label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Thread title..."
              required
              maxLength={200}
              className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2.5 font-mono text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-green/50 transition-colors"
            />
            <div className="text-right font-mono text-[10px] text-text-muted mt-1">{form.title.length}/200</div>
          </div>

          {/* Content */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-mono text-xs text-text-muted">content</label>
              <button
                type="button"
                onClick={() => setPreview(!preview)}
                className="flex items-center gap-1.5 font-mono text-xs text-text-muted hover:text-accent-green transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                {preview ? 'edit' : 'preview'}
              </button>
            </div>

            {preview ? (
              <div className="min-h-[200px] bg-bg-tertiary border border-border rounded-lg p-4 prose-woltix">
                {form.content ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                    {form.content}
                  </ReactMarkdown>
                ) : (
                  <span className="text-text-muted font-mono text-sm">nothing to preview</span>
                )}
              </div>
            ) : (
              <textarea
                value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                placeholder={`Write your post...\n\n\`\`\`python\n# Code blocks supported!\nprint("hack the planet")\n\`\`\``}
                rows={12}
                required
                className="w-full bg-bg-tertiary border border-border rounded-lg p-3 font-mono text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-green/50 transition-colors resize-y"
              />
            )}

            <div className="mt-2 flex flex-wrap gap-3 font-mono text-[10px] text-text-muted">
              <span>**bold**</span>
              <span>*italic*</span>
              <span>`code`</span>
              <span>```lang\ncode block\n```</span>
              <span>&gt; quote</span>
              <span>[link](url)</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Link href="/" className="font-mono text-sm text-text-muted hover:text-accent-green transition-colors">
              cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-accent-green text-bg-primary font-mono font-bold text-sm rounded-lg hover:bg-accent-green/90 transition-colors disabled:opacity-40"
            >
              {submitting ? 'posting...' : '> post thread'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
