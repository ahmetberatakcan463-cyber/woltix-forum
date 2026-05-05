'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Send, Inbox, Trash2, Plus, X } from 'lucide-react';
import api from '@/lib/api';
import useAuthStore from '@/store/authStore';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

export default function MessagesPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [tab, setTab] = useState('inbox');
  const [messages, setMessages] = useState([]);
  const [selected, setSelected] = useState(null);
  const [compose, setCompose] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ to: '', subject: '', content: '' });

  useEffect(() => {
    if (!user) { router.push('/auth/login'); return; }
    fetchMessages();
  }, [user, tab]);

  async function fetchMessages() {
    setLoading(true);
    try {
      const url = tab === 'sent' ? '/messages/sent' : '/messages';
      const res = await api.get(url);
      setMessages(res.data);
    } catch {
      toast.error('Failed to load messages');
    } finally {
      setLoading(false);
    }
  }

  async function openMessage(msg) {
    setSelected(msg);
    if (!msg.is_read && tab === 'inbox') {
      await api.get(`/messages/${msg.id}`);
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_read: true } : m));
    }
  }

  async function deleteMessage(id) {
    try {
      await api.delete(`/messages/${id}`);
      setMessages(prev => prev.filter(m => m.id !== id));
      if (selected?.id === id) setSelected(null);
      toast.success('Deleted');
    } catch {
      toast.error('Delete failed');
    }
  }

  async function sendMessage(e) {
    e.preventDefault();
    try {
      await api.post('/messages', form);
      toast.success('Message sent');
      setCompose(false);
      setForm({ to: '', subject: '', content: '' });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Send failed');
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-accent-green" />
          <h1 className="font-mono font-bold text-lg text-accent-green">messages</h1>
        </div>
        <button
          onClick={() => setCompose(true)}
          className="flex items-center gap-2 px-4 py-2 bg-accent-green text-bg-primary font-mono font-semibold text-sm rounded-lg hover:bg-accent-green/90 transition-colors"
        >
          <Plus className="w-4 h-4" /> compose
        </button>
      </div>

      {/* Compose modal */}
      {compose && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-bg-tertiary border-b border-border">
              <span className="font-mono text-sm font-semibold text-accent-green">new message</span>
              <button onClick={() => setCompose(false)} className="text-text-muted hover:text-text-primary">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={sendMessage} className="p-5 space-y-3">
              <input
                value={form.to}
                onChange={e => setForm(f => ({ ...f, to: e.target.value }))}
                placeholder="to: username"
                required
                className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 font-mono text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-green/50"
              />
              <input
                value={form.subject}
                onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                placeholder="subject"
                className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 font-mono text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-green/50"
              />
              <textarea
                value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                placeholder="message..."
                rows={6}
                required
                className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 font-mono text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-green/50 resize-none"
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setCompose(false)} className="px-4 py-2 font-mono text-sm text-text-muted hover:text-text-primary transition-colors">cancel</button>
                <button type="submit" className="px-5 py-2 bg-accent-green text-bg-primary font-mono font-semibold text-sm rounded-lg hover:bg-accent-green/90 transition-colors">send</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-4">
        {/* Message list */}
        <div className="sm:col-span-1">
          <div className="flex border border-border rounded-xl overflow-hidden mb-3">
            {[['inbox', Inbox], ['sent', Send]].map(([t, Icon]) => (
              <button
                key={t}
                onClick={() => { setTab(t); setSelected(null); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 font-mono text-xs transition-colors ${tab === t ? 'bg-accent-green text-bg-primary font-semibold' : 'bg-bg-card text-text-muted hover:text-text-primary'}`}
              >
                <Icon className="w-3.5 h-3.5" />{t}
              </button>
            ))}
          </div>

          <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
            {loading ? (
              <div className="p-4 font-mono text-xs text-accent-green animate-pulse">loading...</div>
            ) : messages.length === 0 ? (
              <div className="p-4 font-mono text-xs text-text-muted">no messages</div>
            ) : (
              messages.map(msg => (
                <div
                  key={msg.id}
                  onClick={() => openMessage(msg)}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-border last:border-b-0 cursor-pointer transition-colors group ${selected?.id === msg.id ? 'bg-bg-tertiary' : 'hover:bg-bg-tertiary'}`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${!msg.is_read && tab === 'inbox' ? 'bg-accent-green' : 'bg-transparent'}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`font-mono text-xs truncate ${!msg.is_read && tab === 'inbox' ? 'text-text-primary font-semibold' : 'text-text-secondary'}`}>
                      {tab === 'inbox' ? msg.sender_name : msg.receiver_name}
                    </p>
                    <p className="font-mono text-xs text-text-muted truncate">{msg.subject || 'No subject'}</p>
                    <p className="font-mono text-[10px] text-text-muted">{formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}</p>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); deleteMessage(msg.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-accent-red transition-all"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Message view */}
        <div className="sm:col-span-2">
          {selected ? (
            <div className="bg-bg-card border border-border rounded-xl overflow-hidden h-full">
              <div className="px-4 py-3 border-b border-border bg-bg-tertiary">
                <h2 className="font-mono font-semibold text-sm text-text-primary">{selected.subject || 'No subject'}</h2>
                <p className="font-mono text-xs text-text-muted mt-0.5">
                  {tab === 'inbox' ? `from: ${selected.sender_name}` : `to: ${selected.receiver_name}`}
                  {' · '}{formatDistanceToNow(new Date(selected.created_at), { addSuffix: true })}
                </p>
              </div>
              <div className="p-5">
                <p className="font-mono text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">{selected.content}</p>
              </div>
            </div>
          ) : (
            <div className="bg-bg-card border border-border rounded-xl h-full min-h-[200px] flex items-center justify-center">
              <div className="text-center">
                <Mail className="w-8 h-8 text-text-muted mx-auto mb-2" />
                <p className="font-mono text-xs text-text-muted">select a message</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
