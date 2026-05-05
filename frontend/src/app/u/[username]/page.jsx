'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Shield, Award, MessageSquare, TrendingUp, Calendar, Globe, Clock } from 'lucide-react';
import api from '@/lib/api';
import { formatDistanceToNow, format } from 'date-fns';

const RANK_COLORS = {
  Newbie: '#888888', Member: '#10b981', Regular: '#06b6d4',
  Veteran: '#f59e0b', Expert: '#a855f7', Elite: '#00ff41', Legend: '#ff4444',
};

export default function UserProfilePage() {
  const { username } = useParams();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    api.get(`/users/${username}`).then(r => {
      setUser(r.data);
      setLoading(false);
    }).catch(() => {
      setNotFound(true);
      setLoading(false);
    });
  }, [username]);

  if (loading) return (
    <div className="max-w-4xl mx-auto px-4 py-20 text-center">
      <div className="font-mono text-accent-green animate-pulse">loading profile...</div>
    </div>
  );

  if (notFound || !user) return (
    <div className="max-w-4xl mx-auto px-4 py-20 text-center">
      <p className="font-mono text-text-muted">User not found</p>
      <Link href="/" className="font-mono text-xs text-accent-green mt-2 inline-block">← back</Link>
    </div>
  );

  const rankColor = RANK_COLORS[user.rank] || '#888888';

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Profile card */}
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden mb-6">
        {/* Banner */}
        <div className="h-24 bg-gradient-to-r from-bg-tertiary via-bg-secondary to-bg-tertiary relative">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: `repeating-linear-gradient(0deg, ${rankColor}20 0px, transparent 1px, transparent 20px), repeating-linear-gradient(90deg, ${rankColor}20 0px, transparent 1px, transparent 20px)` }} />
        </div>

        <div className="px-6 pb-6">
          <div className="flex items-end gap-4 -mt-8 mb-4">
            <div
              className="w-16 h-16 rounded-xl border-2 flex items-center justify-center text-2xl font-mono font-bold bg-bg-primary shrink-0"
              style={{ borderColor: rankColor, color: rankColor }}
            >
              {user.username[0].toUpperCase()}
            </div>
            <div className="mb-1 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-mono font-bold text-xl text-text-primary">{user.username}</h1>
                {(user.role === 'admin' || user.role === 'moderator') && (
                  <span className="font-mono text-xs text-accent-purple flex items-center gap-1 bg-accent-purple/10 border border-accent-purple/20 px-2 py-0.5 rounded">
                    <Shield className="w-3 h-3" />{user.role}
                  </span>
                )}
              </div>
              <span className="font-mono text-sm font-semibold" style={{ color: rankColor }}>{user.rank}</span>
            </div>
          </div>

          {user.bio && (
            <p className="font-mono text-sm text-text-secondary mb-4 leading-relaxed">{user.bio}</p>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[
              { icon: MessageSquare, label: 'Posts', value: user.post_count },
              { icon: TrendingUp, label: 'Rep', value: user.reputation },
              { icon: MessageSquare, label: 'Threads', value: user.thread_count },
              { icon: Calendar, label: 'Joined', value: format(new Date(user.created_at), 'MMM yyyy') },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="bg-bg-tertiary border border-border rounded-lg p-3 text-center">
                <Icon className="w-4 h-4 mx-auto mb-1 text-accent-green" />
                <div className="font-mono font-bold text-text-primary text-sm">{value}</div>
                <div className="font-mono text-[10px] text-text-muted">{label}</div>
              </div>
            ))}
          </div>

          {/* Meta */}
          <div className="flex flex-wrap gap-4 font-mono text-xs text-text-muted">
            {user.website && (
              <a href={user.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-accent-green transition-colors">
                <Globe className="w-3.5 h-3.5" />{user.website.replace(/https?:\/\//, '')}
              </a>
            )}
            {user.last_seen && (
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                last seen {formatDistanceToNow(new Date(user.last_seen), { addSuffix: true })}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-6">
        {/* Badges */}
        <div>
          <h2 className="font-mono text-sm font-semibold text-text-secondary mb-3 flex items-center gap-2">
            <Award className="w-4 h-4 text-accent-yellow" /> badges
          </h2>
          <div className="bg-bg-card border border-border rounded-xl p-4">
            {user.badges.length === 0 ? (
              <p className="font-mono text-xs text-text-muted">no badges yet</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {user.badges.map((b, i) => (
                  <span
                    key={i}
                    className="font-mono text-xs px-2 py-1 rounded-lg border flex items-center gap-1"
                    style={{ color: b.badge_color, borderColor: `${b.badge_color}30`, background: `${b.badge_color}10` }}
                  >
                    {b.badge_icon} {b.badge_name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent threads */}
        <div className="sm:col-span-2">
          <h2 className="font-mono text-sm font-semibold text-text-secondary mb-3 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-accent-green" /> recent threads
          </h2>
          <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
            {user.recent_threads.length === 0 ? (
              <p className="font-mono text-xs text-text-muted p-4">no threads yet</p>
            ) : (
              user.recent_threads.map(t => (
                <Link key={t.id} href={`/t/${t.id}`}>
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border last:border-b-0 hover:bg-bg-tertiary transition-colors group">
                    <div className="min-w-0">
                      <p className="font-mono text-sm text-text-primary group-hover:text-accent-green transition-colors truncate">{t.title}</p>
                      <p className="font-mono text-[10px] text-text-muted">{t.category_name}</p>
                    </div>
                    <span className="font-mono text-[10px] text-text-muted shrink-0 ml-3">
                      {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
