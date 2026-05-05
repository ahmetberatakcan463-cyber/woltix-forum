'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Shield, Users, MessageSquare, TrendingUp, Ban, Award, RotateCw,
  LayoutGrid, FileText, Settings, Activity, Globe, Bell, Eye,
  Search, ChevronDown, Plus, Trash2, Pin, Lock, Unlock, Move,
  X, Check, AlertTriangle, Download, RefreshCw, UserX, Key,
  Tag, FolderPlus, Image, List, Grid, Clock, Server, Cpu,
  Mail, Terminal, LogOut, Star, Filter, ArrowUp, ArrowDown,
  ExternalLink, Copy, CheckCircle, HelpCircle, Info, Zap,
  ShieldOff, Wifi, HardDrive, Database, GlobeLock, Siren,
  BookOpen, Hash, AtSign, Calendar, Edit3, EyeOff, CornerUpLeft,
  Gavel, Fingerprint, Radio, Webhook, Scan, Bug, Lock as LockIcon,
} from 'lucide-react';
import { adminApi } from '@/lib/api';
import useAuthStore from '@/store/authStore';
import toast from 'react-hot-toast';
import { formatDistanceToNow, format } from 'date-fns';

const severityColors = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  info: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

const roleColors = {
  admin: 'text-red-400 bg-red-500/10',
  moderator: 'text-purple-400 bg-purple-500/10',
  member: 'text-blue-400 bg-blue-500/10',
};

export default function AdminPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [tab, setTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({});
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!user) { router.push('/auth/login'); return; }
    if (user.role !== 'admin' && user.role !== 'moderator') { router.push('/'); return; }
    loadData();
  }, [user]);

  async function loadData() {
    setLoading(true);
    try {
      const [stats, activity, usersRes, categories, threads, posts, tags, ipBans, auditRes, health] = await Promise.all([
        adminApi.getStats().catch(() => null),
        adminApi.getRecentActivity().catch(() => null),
        adminApi.getUsers({ limit: 50 }).catch(() => null),
        adminApi.getCategories().catch(() => null),
        adminApi.getThreads({ limit: 20 }).catch(() => null),
        adminApi.getPosts({ limit: 20 }).catch(() => null),
        adminApi.getTags().catch(() => null),
        adminApi.getIpBans().catch(() => null),
        adminApi.getAuditLog({ limit: 50 }).catch(() => null),
        adminApi.getHealth().catch(() => null),
      ]);

      let settings = null;
      if (user.role === 'admin') {
        settings = await adminApi.getSettings().catch(() => null);
      }

      setData({
        stats: stats?.data,
        activity: activity?.data || [],
        users: usersRes?.data?.users || [],
        usersTotal: usersRes?.data?.total || 0,
        categories: categories?.data || [],
        threads: threads?.data?.threads || [],
        posts: posts?.data?.posts || [],
        tags: tags?.data || [],
        ipBans: ipBans?.data || [],
        auditLogs: auditRes?.data?.logs || [],
        auditTotal: auditRes?.data?.total || 0,
        health: health?.data,
        settings: settings?.data || {},
      });
    } catch (err) {
      toast.error('Failed to load admin data');
    }
    setLoading(false);
  }

  const isAdmin = user?.role === 'admin';

  const TABS = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutGrid, mod: true },
    { key: 'users', label: 'Users', icon: Users, mod: true },
    { key: 'categories', label: 'Categories', icon: FolderPlus, admin: true },
    { key: 'threads', label: 'Threads', icon: FileText, mod: true },
    { key: 'posts', label: 'Posts', icon: MessageSquare, mod: true },
    { key: 'badges', label: 'Badges', icon: Award, mod: true },
    { key: 'tags', label: 'Tags', icon: Tag, admin: true },
    { key: 'ipbans', label: 'IP Bans', icon: GlobeLock, admin: true },
    { key: 'settings', label: 'Settings', icon: Settings, admin: true },
    { key: 'security', label: 'Security', icon: Shield, admin: true },
    { key: 'broadcast', label: 'Broadcast', icon: Bell, admin: true },
    { key: 'audit', label: 'Audit Log', icon: Activity, admin: true },
  ].filter(t => (t.admin ? isAdmin : true));

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-purple" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-6 h-6 text-accent-purple" />
        <div>
          <h1 className="font-mono font-bold text-xl text-accent-purple">woltix admin panel</h1>
          <p className="font-mono text-xs text-text-muted">
            logged in as <span className={roleColors[user?.role] || 'text-accent-purple'}>{user?.role}</span>
            {' | '}
            <span className="text-text-muted">{data.stats?.total_users || 0} users</span>
          </p>
        </div>
        <button onClick={loadData} className="ml-auto p-2 text-text-muted hover:text-accent-green transition-colors" title="Refresh All Data">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="flex gap-1 mb-6 bg-bg-card border border-border rounded-xl p-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setPage(1); setSearch(''); }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-xs transition-colors whitespace-nowrap ${
              tab === t.key ? 'bg-accent-purple text-white font-semibold' : 'text-text-muted hover:text-text-primary hover:bg-bg-tertiary'
            }`}>
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && <DashboardTab data={data} onRefresh={loadData} />}
      {tab === 'users' && <UsersTab data={data} onRefresh={loadData} search={search} setSearch={setSearch} page={page} setPage={setPage} />}
      {tab === 'categories' && <CategoriesTab data={data} onRefresh={loadData} />}
      {tab === 'threads' && <ThreadsTab data={data} onRefresh={loadData} search={search} setSearch={setSearch} page={page} setPage={setPage} />}
      {tab === 'posts' && <PostsTab data={data} onRefresh={loadData} search={search} setSearch={setSearch} page={page} setPage={setPage} />}
      {tab === 'badges' && <BadgesTab data={data} onRefresh={loadData} />}
      {tab === 'tags' && <TagsTab data={data} onRefresh={loadData} />}
      {tab === 'ipbans' && <IpBansTab data={data} onRefresh={loadData} />}
      {tab === 'settings' && <SettingsTab data={data} onRefresh={loadData} />}
      {tab === 'security' && <SecurityTab data={data} onRefresh={loadData} />}
      {tab === 'broadcast' && <BroadcastTab data={data} onRefresh={loadData} />}
      {tab === 'audit' && <AuditTab data={data} onRefresh={loadData} page={page} setPage={setPage} />}
    </div>
  );
}

function DashboardTab({ data, onRefresh }) {
  const { stats, activity, health } = data;
  const statCards = [
    { icon: Users, label: 'total users', value: stats?.total_users, color: 'text-accent-cyan', sub: `${stats?.new_users_today || 0} today` },
    { icon: MessageSquare, label: 'threads', value: stats?.total_threads, color: 'text-accent-green', sub: `${stats?.new_threads_today || 0} today` },
    { icon: TrendingUp, label: 'posts', value: stats?.total_posts, color: 'text-accent-purple', sub: `${stats?.total_messages || 0} messages` },
    { icon: Users, label: 'active today', value: stats?.active_today, color: 'text-accent-yellow', sub: `${stats?.new_users_week || 0} this week` },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {statCards.map(({ icon: Icon, label, value, color, sub }) => (
          <div key={label} className="bg-bg-card border border-border rounded-xl p-5 text-center group hover:border-accent-purple/30 transition-all">
            <Icon className={`w-5 h-5 mx-auto mb-2 ${color} group-hover:scale-110 transition-transform`} />
            <div className={`font-mono font-bold text-2xl ${color}`}>{value?.toLocaleString() || '—'}</div>
            <div className="font-mono text-[10px] text-text-muted mt-1 uppercase tracking-wider">{label}</div>
            <div className="font-mono text-[9px] text-text-muted/60 mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-bg-tertiary flex items-center gap-2">
            <Server className="w-4 h-4 text-accent-green" />
            <span className="font-mono text-sm font-semibold text-text-primary">server health</span>
          </div>
          <div className="p-4 space-y-2">
            {health ? (
              <>
                <HealthRow icon={Database} label="Database" value={health.database?.connected ? 'Connected' : 'Disconnected'} status={health.database?.connected ? 'ok' : 'error'} />
                <HealthRow icon={Activity} label="Active Connections" value={health.database?.active_connections} />
                <HealthRow icon={Clock} label="Uptime" value={`${Math.floor(health.server?.uptime / 60)}m ${Math.floor(health.server?.uptime % 60)}s`} />
                <HealthRow icon={Cpu} label="Node.js" value={health.server?.node_version} />
                <HealthRow icon={HardDrive} label="Memory" value={health.server?.memory ? `${(health.server.memory.heapUsed / 1024 / 1024).toFixed(1)}MB / ${(health.server.memory.heapTotal / 1024 / 1024).toFixed(1)}MB` : '—'} />
              </>
            ) : (
              <p className="font-mono text-xs text-text-muted">Health check unavailable</p>
            )}
          </div>
        </div>

        <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-bg-tertiary flex items-center gap-2">
            <Activity className="w-4 h-4 text-accent-purple" />
            <span className="font-mono text-sm font-semibold text-text-primary">recent activity</span>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {activity?.length > 0 ? activity.slice(0, 10).map((a, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-b-0 hover:bg-bg-tertiary/50 transition-colors">
                <span className={`font-mono text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider ${
                  a.type === 'thread' ? 'bg-accent-green/10 text-accent-green' :
                  a.type === 'post' ? 'bg-accent-purple/10 text-accent-purple' :
                  'bg-accent-cyan/10 text-accent-cyan'
                }`}>{a.type}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-xs text-text-primary truncate">{a.label || a.title || a.content}</p>
                  <p className="font-mono text-[10px] text-text-muted">by {a.username}</p>
                </div>
                <span className="font-mono text-[10px] text-text-muted shrink-0">
                  {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                </span>
              </div>
            )) : (
              <p className="font-mono text-xs text-text-muted text-center py-8">No recent activity</p>
            )}
          </div>
        </div>
      </div>

      {stats?.category_stats?.length > 0 && (
        <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-bg-tertiary flex items-center gap-2">
            <LayoutGrid className="w-4 h-4 text-accent-yellow" />
            <span className="font-mono text-sm font-semibold text-text-primary">category stats</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 p-4">
            {stats.category_stats.map((cat, i) => (
              <div key={i} className="bg-bg-tertiary rounded-lg p-3 text-center">
                <div className="font-mono font-bold text-lg text-accent-green">{cat.thread_count}</div>
                <div className="font-mono text-[10px] text-text-muted truncate">{cat.name}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function HealthRow({ icon: Icon, label, value, status }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2">
        <Icon className="w-3.5 h-3.5 text-text-muted" />
        <span className="font-mono text-xs text-text-secondary">{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        {status === 'ok' && <div className="w-1.5 h-1.5 rounded-full bg-accent-green" />}
        {status === 'error' && <div className="w-1.5 h-1.5 rounded-full bg-accent-red" />}
        <span className={`font-mono text-xs ${status === 'ok' ? 'text-accent-green' : status === 'error' ? 'text-accent-red' : 'text-text-primary'}`}>{value}</span>
      </div>
    </div>
  );
}

function UsersTab({ data, onRefresh, search, setSearch, page, setPage }) {
  const { user: currentUser } = useAuthStore();
  const [users, setUsers] = useState(data.users || []);
  const [total, setTotal] = useState(data.usersTotal || 0);
  const [loading, setLoading] = useState(false);
  const [filterRole, setFilterRole] = useState('');
  const [filterBanned, setFilterBanned] = useState('');
  const [sort, setSort] = useState('created_at');
  const [order, setOrder] = useState('DESC');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showResetPw, setShowResetPw] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [showAwardBadge, setShowAwardBadge] = useState(null);
  const [badgeData, setBadgeData] = useState({ name: '', icon: '🏆', color: '#00ff41' });

  const isAdmin = currentUser?.role === 'admin';

  async function loadUsers() {
    setLoading(true);
    try {
      const params = { page, limit: 30, sort, order };
      if (search) params.search = search;
      if (filterRole) params.role = filterRole;
      if (filterBanned) params.banned = filterBanned;
      const res = await adminApi.getUsers(params);
      setUsers(res.data.users);
      setTotal(res.data.total);
    } catch { toast.error('Failed to load users'); }
    setLoading(false);
  }

  useEffect(() => { loadUsers(); }, [page, sort, order, filterRole, filterBanned]);
  useEffect(() => {
    const timer = setTimeout(() => { if (search !== undefined) loadUsers(); }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  async function handleBan(userId, ban, reason = '') {
    try {
      await adminApi.banUser(userId, ban, reason);
      toast.success(ban ? 'User banned' : 'User unbanned');
      loadUsers();
    } catch (err) { toast.error(err.response?.data?.error || 'Action failed'); }
  }

  async function handleRoleChange(userId, role) {
    if (!isAdmin) { toast.error('Admin only'); return; }
    try { await adminApi.updateRole(userId, role); toast.success('Role updated'); loadUsers(); }
    catch { toast.error('Role update failed'); }
  }

  async function handleDeleteUser(userId) {
    if (!confirm('Permanently delete this user? This cannot be undone!')) return;
    try { await adminApi.deleteUser(userId); toast.success('User deleted'); loadUsers(); }
    catch { toast.error('Delete failed'); }
  }

  async function handleResetPassword(userId) {
    if (!newPassword || newPassword.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    try { await adminApi.resetPassword(userId, newPassword); toast.success('Password reset!'); setShowResetPw(null); setNewPassword(''); }
    catch { toast.error('Password reset failed'); }
  }

  async function handleAwardBadge(userId) {
    if (!badgeData.name) { toast.error('Badge name required'); return; }
    try {
      await adminApi.awardBadge(userId, { badge_name: badgeData.name, badge_icon: badgeData.icon, badge_color: badgeData.color });
      toast.success('Badge awarded!'); setShowAwardBadge(null); setBadgeData({ name: '', icon: '🏆', color: '#00ff41' }); loadUsers();
    } catch { toast.error('Failed to award badge'); }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex-1 min-w-[200px]">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="search users..."
            className="w-full bg-bg-card border border-border rounded-xl px-4 py-2.5 font-mono text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-purple/50 transition-colors" />
        </div>
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
          className="bg-bg-card border border-border rounded-xl px-3 py-2.5 font-mono text-xs text-text-primary focus:outline-none focus:border-accent-purple/50">
          <option value="">All Roles</option>
          <option value="admin">Admin</option>
          <option value="moderator">Moderator</option>
          <option value="member">Member</option>
        </select>
        <select value={filterBanned} onChange={e => setFilterBanned(e.target.value)}
          className="bg-bg-card border border-border rounded-xl px-3 py-2.5 font-mono text-xs text-text-primary focus:outline-none focus:border-accent-purple/50">
          <option value="">All</option>
          <option value="true">Banned</option>
          <option value="false">Active</option>
        </select>
        <select value={sort} onChange={e => setSort(e.target.value)}
          className="bg-bg-card border border-border rounded-xl px-3 py-2.5 font-mono text-xs text-text-primary focus:outline-none focus:border-accent-purple/50">
          <option value="created_at">Join Date</option>
          <option value="username">Username</option>
          <option value="role">Role</option>
          <option value="post_count">Posts</option>
          <option value="reputation">Reputation</option>
          <option value="last_seen">Last Seen</option>
        </select>
        <button onClick={() => setOrder(o => o === 'DESC' ? 'ASC' : 'DESC')}
          className="bg-bg-card border border-border rounded-xl px-3 py-2.5 font-mono text-xs text-text-muted hover:text-text-primary transition-colors">
          {order === 'DESC' ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUp className="w-3.5 h-3.5" />}
        </button>
        <span className="font-mono text-[10px] text-text-muted self-center ml-2">{total} users</span>
      </div>

      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setSelectedUser(null)}>
          <div className="bg-bg-card border border-border rounded-2xl w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-accent-purple/20 flex items-center justify-center font-mono font-bold text-accent-purple">
                  {selectedUser.username?.[0]?.toUpperCase()}
                </div>
                <div>
                  <h3 className="font-mono font-semibold text-text-primary">{selectedUser.username}</h3>
                  <p className="font-mono text-[10px] text-text-muted">{selectedUser.email}</p>
                </div>
              </div>
              <button onClick={() => setSelectedUser(null)} className="p-1 text-text-muted hover:text-text-primary"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-bg-tertiary rounded-lg p-3"><p className="font-mono text-[10px] text-text-muted">Role</p><p className={`font-mono text-sm font-semibold ${roleColors[selectedUser.role]?.split(' ')[0] || 'text-text-primary'}`}>{selectedUser.role}</p></div>
                <div className="bg-bg-tertiary rounded-lg p-3"><p className="font-mono text-[10px] text-text-muted">Rank</p><p className="font-mono text-sm font-semibold text-text-primary">{selectedUser.rank}</p></div>
                <div className="bg-bg-tertiary rounded-lg p-3"><p className="font-mono text-[10px] text-text-muted">Posts</p><p className="font-mono text-sm font-semibold text-text-primary">{selectedUser.post_count}</p></div>
                <div className="bg-bg-tertiary rounded-lg p-3"><p className="font-mono text-[10px] text-text-muted">Threads</p><p className="font-mono text-sm font-semibold text-text-primary">{selectedUser.thread_count}</p></div>
                <div className="bg-bg-tertiary rounded-lg p-3"><p className="font-mono text-[10px] text-text-muted">Reputation</p><p className="font-mono text-sm font-semibold text-text-primary">{selectedUser.reputation}</p></div>
                <div className="bg-bg-tertiary rounded-lg p-3"><p className="font-mono text-[10px] text-text-muted">2FA</p><p className={`font-mono text-sm font-semibold ${selectedUser.totp_enabled ? 'text-accent-green' : 'text-text-muted'}`}>{selectedUser.totp_enabled ? 'Enabled' : 'Disabled'}</p></div>
              </div>
              <div className="font-mono text-[10px] text-text-muted space-y-1">
                <p>Joined: {selectedUser.created_at ? format(new Date(selectedUser.created_at), 'PPP') : '—'}</p>
                <p>Last seen: {selectedUser.last_seen ? formatDistanceToNow(new Date(selectedUser.last_seen), { addSuffix: true }) : '—'}</p>
                {selectedUser.is_banned && <p className="text-accent-red">Banned: {selectedUser.ban_reason || 'No reason'}</p>}
              </div>
              {selectedUser.badges?.length > 0 && (
                <div>
                  <p className="font-mono text-xs text-text-muted mb-2">Badges:</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedUser.badges.map((b, i) => (
                      <span key={i} className="font-mono text-xs px-2 py-1 rounded-full bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/20">{b.badge_icon} {b.badge_name}</span>
                    ))}
                  </div>
                </div>
              )}
              {selectedUser.bio && (
                <div><p className="font-mono text-xs text-text-muted mb-1">Bio:</p><p className="font-mono text-xs text-text-secondary bg-bg-tertiary rounded-lg p-3">{selectedUser.bio}</p></div>
              )}
            </div>
          </div>
        </div>
      )}

      {showResetPw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => { setShowResetPw(null); setNewPassword(''); }}>
          <div className="bg-bg-card border border-border rounded-2xl w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-mono font-semibold text-text-primary mb-4 flex items-center gap-2"><Key className="w-4 h-4 text-accent-yellow" /> Reset Password for {showResetPw.username}</h3>
            <input value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="New password (min 8 chars)" type="password"
              className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 font-mono text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-yellow/50 mb-4" />
            <div className="flex gap-2">
              <button onClick={() => handleResetPassword(showResetPw.id)} className="flex-1 py-2 bg-accent-yellow text-bg-primary font-mono font-bold text-sm rounded-lg hover:bg-accent-yellow/90 transition-colors">Reset Password</button>
              <button onClick={() => { setShowResetPw(null); setNewPassword(''); }} className="px-4 py-2 bg-bg-tertiary text-text-muted font-mono text-sm rounded-lg hover:text-text-primary transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showAwardBadge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => { setShowAwardBadge(null); setBadgeData({ name: '', icon: '🏆', color: '#00ff41' }); }}>
          <div className="bg-bg-card border border-border rounded-2xl w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-mono font-semibold text-text-primary mb-4 flex items-center gap-2"><Award className="w-4 h-4 text-accent-yellow" /> Award Badge to {showAwardBadge.username}</h3>
            <div className="space-y-3">
              <input value={badgeData.name} onChange={e => setBadgeData(p => ({ ...p, name: e.target.value }))} placeholder="Badge name"
                className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 font-mono text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-yellow/50" />
              <div className="flex gap-2">
                <input value={badgeData.icon} onChange={e => setBadgeData(p => ({ ...p, icon: e.target.value }))} placeholder="Icon (emoji)" className="flex-1 bg-bg-tertiary border border-border rounded-lg px-3 py-2 font-mono text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-yellow/50" />
                <input value={badgeData.color} onChange={e => setBadgeData(p => ({ ...p, color: e.target.value }))} type="color" className="w-10 h-10 rounded-lg bg-bg-tertiary border border-border cursor-pointer" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => handleAwardBadge(showAwardBadge.id)} className="flex-1 py-2 bg-accent-yellow text-bg-primary font-mono font-bold text-sm rounded-lg hover:bg-accent-yellow/90 transition-colors">Award Badge</button>
              <button onClick={() => { setShowAwardBadge(null); setBadgeData({ name: '', icon: '🏆', color: '#00ff41' }); }} className="px-4 py-2 bg-bg-tertiary text-text-muted font-mono text-sm rounded-lg hover:text-text-primary transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 bg-bg-tertiary border-b border-border text-[10px] font-mono text-text-muted uppercase tracking-wider">
          <div className="col-span-3">user</div>
          <div className="col-span-1">role</div>
          <div className="col-span-1">rank</div>
          <div className="col-span-1">posts</div>
          <div className="col-span-1">rep</div>
          <div className="col-span-1">status</div>
          <div className="col-span-4">actions</div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent-purple" /></div>
        ) : users.length === 0 ? (
          <p className="font-mono text-xs text-text-muted text-center py-12">No users found</p>
        ) : users.map(u => (
          <div key={u.id} className={`grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 px-4 py-3 border-b border-border last:border-b-0 items-center ${u.is_banned ? 'opacity-60' : ''} hover:bg-bg-tertiary/30 transition-colors`}>
            <div className="md:col-span-3 min-w-0 flex items-center gap-2">
              <button onClick={() => setSelectedUser(u)} className="w-7 h-7 rounded-full bg-accent-purple/20 flex items-center justify-center font-mono font-bold text-xs text-accent-purple shrink-0 hover:bg-accent-purple/30 transition-colors">{u.username?.[0]?.toUpperCase()}</button>
              <div className="min-w-0">
                <button onClick={() => setSelectedUser(u)} className="font-mono text-sm text-text-primary truncate block hover:text-accent-purple transition-colors">{u.username}</button>
                <p className="font-mono text-[10px] text-text-muted truncate md:hidden">{u.email}</p>
              </div>
            </div>
            <div className="md:col-span-1">
              {isAdmin ? (
                <select value={u.role} onChange={e => handleRoleChange(u.id, e.target.value)} className="bg-bg-tertiary border border-border rounded px-1.5 py-0.5 font-mono text-[10px] text-text-primary focus:outline-none w-full">
                  <option value="member">member</option>
                  <option value="moderator">mod</option>
                  <option value="admin">admin</option>
                </select>
              ) : (
                <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${roleColors[u.role] || ''}`}>{u.role}</span>
              )}
            </div>
            <div className="md:col-span-1"><span className="font-mono text-xs text-text-primary">{u.rank || '—'}</span></div>
            <div className="md:col-span-1"><span className="font-mono text-xs text-text-primary">{u.post_count}</span></div>
            <div className="md:col-span-1"><span className="font-mono text-xs text-text-primary">{u.reputation ?? 0}</span></div>
            <div className="md:col-span-1">
              {u.is_banned ? (
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-accent-red/10 text-accent-red">banned</span>
              ) : (
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-accent-green/10 text-accent-green">active</span>
              )}
            </div>
            <div className="md:col-span-4 flex items-center gap-1 flex-wrap">
              <button onClick={() => setSelectedUser(u)} className="p-1.5 rounded-lg bg-bg-tertiary text-text-muted hover:text-accent-cyan hover:bg-accent-cyan/10 transition-colors" title="View Details"><Eye className="w-3.5 h-3.5" /></button>
              {isAdmin && (
                <>
                  <button onClick={() => handleBan(u.id, !u.is_banned, 'Violation')} className={`p-1.5 rounded-lg transition-colors ${u.is_banned ? 'bg-accent-green/10 text-accent-green hover:bg-accent-green/20' : 'bg-bg-tertiary text-text-muted hover:text-accent-red hover:bg-accent-red/10'}`} title={u.is_banned ? 'Unban' : 'Ban'}>
                    {u.is_banned ? <Check className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={() => { setShowResetPw(u); setNewPassword(''); }} className="p-1.5 rounded-lg bg-bg-tertiary text-text-muted hover:text-accent-yellow hover:bg-accent-yellow/10 transition-colors" title="Reset Password"><Key className="w-3.5 h-3.5" /></button>
                  <button onClick={() => { setShowAwardBadge(u); setBadgeData({ name: '', icon: '🏆', color: '#00ff41' }); }} className="p-1.5 rounded-lg bg-bg-tertiary text-text-muted hover:text-accent-yellow hover:bg-accent-yellow/10 transition-colors" title="Award Badge"><Award className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDeleteUser(u.id)} className="p-1.5 rounded-lg bg-bg-tertiary text-text-muted hover:text-accent-red hover:bg-accent-red/10 transition-colors" title="Delete User"><Trash2 className="w-3.5 h-3.5" /></button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {total > 30 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 bg-bg-card border border-border rounded-lg font-mono text-xs text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors">Previous</button>
          <span className="font-mono text-xs text-text-muted">Page {page} of {Math.ceil(total / 30)}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / 30)} className="px-3 py-1.5 bg-bg-card border border-border rounded-lg font-mono text-xs text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors">Next</button>
        </div>
      )}
    </div>
  );
}

// ==================== CATEGORIES TAB ====================
function CategoriesTab({ data, onRefresh }) {
  const [categories, setCategories] = useState(data.categories || []);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', icon: '📁', color: '#8b5cf6', sort_order: 0 });
  const [showForm, setShowForm] = useState(false);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const { data: res } = await adminApi.getCategories();
      setCategories(res || []);
    } catch (err) {
      toast.error('Kategoriler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Kategori adı gerekli');
    try {
      if (editing) {
        await adminApi.updateCategory(editing.id, form);
        toast.success('Kategori güncellendi');
      } else {
        await adminApi.createCategory(form);
        toast.success('Kategori oluşturuldu');
      }
      setShowForm(false);
      setEditing(null);
      setForm({ name: '', description: '', icon: '📁', color: '#8b5cf6', sort_order: 0 });
      loadCategories();
      onRefresh();
    } catch (err) {
      toast.error('İşlem başarısız');
    }
  };

  const handleEdit = (cat) => {
    setEditing(cat);
    setForm({ name: cat.name, description: cat.description || '', icon: cat.icon || '📁', color: cat.color || '#8b5cf6', sort_order: cat.sort_order || 0 });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Bu kategoriyi silmek istediğinize emin misiniz?')) return;
    try {
      await adminApi.deleteCategory(id);
      toast.success('Kategori silindi');
      loadCategories();
      onRefresh();
    } catch (err) {
      toast.error('Silme başarısız');
    }
  };

  const handleReorder = async (id, direction) => {
    const idx = categories.findIndex(c => c.id === id);
    if (idx === -1) return;
    const newOrder = [...categories];
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= newOrder.length) return;
    [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];
    const updates = newOrder.map((c, i) => ({ id: c.id, sort_order: i }));
    try {
      await adminApi.reorderCategories(updates);
      setCategories(newOrder);
      toast.success('Sıralama güncellendi');
    } catch (err) {
      toast.error('Sıralama başarısız');
    }
  };

  if (loading) return <div className="text-center py-8 text-text-muted font-mono text-sm">Kategoriler yükleniyor...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-text-primary font-mono">Kategoriler ({categories.length})</h2>
        <button onClick={() => { setEditing(null); setForm({ name: '', description: '', icon: '📁', color: '#8b5cf6', sort_order: 0 }); setShowForm(true); }} className="px-4 py-2 bg-accent-purple text-white rounded-lg font-mono text-xs hover:opacity-80 transition-opacity">+ Yeni Kategori</button>
      </div>
      {showForm && (
        <div className="bg-bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Kategori adı" className="px-3 py-2 bg-bg-primary border border-border rounded-lg font-mono text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-purple" />
            <input value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} placeholder="İkon (emoji)" className="px-3 py-2 bg-bg-primary border border-border rounded-lg font-mono text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-purple" />
            <input value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} type="color" className="px-1 py-1 bg-bg-primary border border-border rounded-lg h-10 w-20 cursor-pointer" />
            <input value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))} type="number" placeholder="Sıralama" className="px-3 py-2 bg-bg-primary border border-border rounded-lg font-mono text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-purple" />
          </div>
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Açıklama" rows={2} className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg font-mono text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-purple resize-none" />
          <div className="flex gap-2">
            <button onClick={handleSave} className="px-4 py-2 bg-accent-purple text-white rounded-lg font-mono text-xs hover:opacity-80 transition-opacity">{editing ? 'Güncelle' : 'Oluştur'}</button>
            <button onClick={() => { setShowForm(false); setEditing(null); }} className="px-4 py-2 bg-bg-primary border border-border rounded-lg font-mono text-xs text-text-muted hover:text-text-primary transition-colors">İptal</button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {categories.map((cat, idx) => (
          <div key={cat.id} className="bg-bg-card border border-border rounded-xl p-4 flex items-center gap-4 group">
            <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => handleReorder(cat.id, 'up')} disabled={idx === 0} className="text-text-muted hover:text-text-primary disabled:opacity-20 text-xs">▲</button>
              <button onClick={() => handleReorder(cat.id, 'down')} disabled={idx === categories.length - 1} className="text-text-muted hover:text-text-primary disabled:opacity-20 text-xs">▼</button>
            </div>
            <span className="text-2xl">{cat.icon || '📁'}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-text-primary truncate">{cat.name}</span>
                <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: cat.color || '#8b5cf6' }} />
              </div>
              {cat.description && <p className="font-mono text-xs text-text-muted truncate mt-0.5">{cat.description}</p>}
              <p className="font-mono text-xs text-text-muted mt-1">{cat.thread_count || 0} konu · sıra: {cat.sort_order || 0}</p>
            </div>
            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => handleEdit(cat)} className="px-3 py-1.5 bg-bg-primary border border-border rounded-lg font-mono text-xs text-text-muted hover:text-text-primary transition-colors">Düzenle</button>
              <button onClick={() => handleDelete(cat.id)} className="px-3 py-1.5 bg-red-500/10 border border-red-500/30 rounded-lg font-mono text-xs text-red-400 hover:bg-red-500/20 transition-colors">Sil</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== THREADS TAB ====================
function ThreadsTab({ data, onRefresh, search, setSearch, page, setPage }) {
  const [threads, setThreads] = useState(data.threads || []);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [moveModal, setMoveModal] = useState(null);
  const [categories, setCategories] = useState([]);
  const [targetCategory, setTargetCategory] = useState('');

  const loadThreads = async () => {
    try {
      setLoading(true);
      const params = { page, limit: 30, search, filter };
      const { data: res } = await adminApi.getThreads(params);
      setThreads(res?.threads || []);
      setTotal(res?.total || 0);
    } catch (err) {
      toast.error('Konular yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadThreads(); }, [page, filter]);
  useEffect(() => {
    const timer = setTimeout(() => { setPage(1); loadThreads(); }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (moveModal) {
      adminApi.getCategories().then(({ data: res }) => setCategories(res || [])).catch(() => {});
    }
  }, [moveModal]);

  const handlePin = async (id, pinned) => {
    try { await adminApi.pinThread(id, !pinned); toast.success(pinned ? 'Sabitleme kaldırıldı' : 'Konu sabitlendi'); loadThreads(); }
    catch (err) { toast.error('İşlem başarısız'); }
  };

  const handleLock = async (id, locked) => {
    try { await adminApi.lockThread(id, !locked); toast.success(locked ? 'Kilit açıldı' : 'Konu kilitlendi'); loadThreads(); }
    catch (err) { toast.error('İşlem başarısız'); }
  };

  const handleMove = async () => {
    if (!targetCategory) return toast.error('Hedef kategori seçin');
    try { await adminApi.moveThread(moveModal.id, targetCategory); toast.success('Konu taşındı'); setMoveModal(null); setTargetCategory(''); loadThreads(); }
    catch (err) { toast.error('Taşıma başarısız'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Bu konuyu silmek istediğinize emin misiniz?')) return;
    try { await adminApi.deleteThread(id); toast.success('Konu silindi'); loadThreads(); }
    catch (err) { toast.error('Silme başarısız'); }
  };

  const handleHardDelete = async (id) => {
    if (!confirm('Bu konuyu KALICI olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz!')) return;
    try { await adminApi.hardDeleteThread(id); toast.success('Konu kalıcı olarak silindi'); loadThreads(); }
    catch (err) { toast.error('Silme başarısız'); }
  };

  if (loading && threads.length === 0) return <div className="text-center py-8 text-text-muted font-mono text-sm">Konular yükleniyor...</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-text-primary font-mono">Konular ({total})</h2>
        <div className="flex items-center gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Konu ara..." className="px-3 py-2 bg-bg-primary border border-border rounded-lg font-mono text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-purple w-48" />
          <select value={filter} onChange={e => setFilter(e.target.value)} className="px-3 py-2 bg-bg-primary border border-border rounded-lg font-mono text-xs text-text-primary focus:outline-none focus:border-accent-purple">
            <option value="all">Tümü</option>
            <option value="pinned">Sabitlenmiş</option>
            <option value="locked">Kilitli</option>
            <option value="deleted">Silinmiş</option>
          </select>
        </div>
      </div>
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 font-mono text-xs text-text-muted">Konu</th>
                <th className="text-left px-4 py-3 font-mono text-xs text-text-muted">Yazar</th>
                <th className="text-left px-4 py-3 font-mono text-xs text-text-muted">Kategori</th>
                <th className="text-center px-4 py-3 font-mono text-xs text-text-muted">Yanıt</th>
                <th className="text-center px-4 py-3 font-mono text-xs text-text-muted">Gör.</th>
                <th className="text-center px-4 py-3 font-mono text-xs text-text-muted">Durum</th>
                <th className="text-right px-4 py-3 font-mono text-xs text-text-muted">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {threads.map(t => (
                <tr key={t.id} className="border-b border-border hover:bg-bg-primary/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {t.is_pinned && <span className="text-yellow-500 text-xs">📌</span>}
                      {t.is_locked && <span className="text-red-400 text-xs">🔒</span>}
                      <span className="font-mono text-sm text-text-primary truncate max-w-[200px]">{t.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-text-muted">{t.author_username || '?'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-text-muted">{t.category_name || '?'}</td>
                  <td className="px-4 py-3 text-center font-mono text-xs text-text-muted">{t.post_count || 0}</td>
                  <td className="px-4 py-3 text-center font-mono text-xs text-text-muted">{t.view_count || 0}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-xs ${t.deleted_at ? 'bg-red-500/10 text-red-400' : t.is_locked ? 'bg-orange-500/10 text-orange-400' : t.is_pinned ? 'bg-yellow-500/10 text-yellow-400' : 'bg-green-500/10 text-green-400'}`}>
                      {t.deleted_at ? 'Silinmiş' : t.is_locked ? 'Kilitli' : t.is_pinned ? 'Sabit' : 'Aktif'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => handlePin(t.id, t.is_pinned)} className="px-2 py-1 bg-bg-primary border border-border rounded font-mono text-xs text-text-muted hover:text-yellow-400 transition-colors" title={t.is_pinned ? 'Sabitlemeyi kaldır' : 'Sabitle'}>{t.is_pinned ? '📌' : '📍'}</button>
                      <button onClick={() => handleLock(t.id, t.is_locked)} className="px-2 py-1 bg-bg-primary border border-border rounded font-mono text-xs text-text-muted hover:text-orange-400 transition-colors" title={t.is_locked ? 'Kilidi aç' : 'Kitle'}>{t.is_locked ? '🔓' : '🔒'}</button>
                      <button onClick={() => setMoveModal(t)} className="px-2 py-1 bg-bg-primary border border-border rounded font-mono text-xs text-text-muted hover:text-blue-400 transition-colors" title="Taşı">📦</button>
                      <button onClick={() => handleDelete(t.id)} className="px-2 py-1 bg-bg-primary border border-border rounded font-mono text-xs text-text-muted hover:text-red-400 transition-colors" title="Sil">🗑️</button>
                      {t.deleted_at && (
                        <button onClick={() => handleHardDelete(t.id)} className="px-2 py-1 bg-red-500/10 border border-red-500/30 rounded font-mono text-xs text-red-400 hover:bg-red-500/20 transition-colors" title="Kalıcı sil">💀</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {threads.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center font-mono text-sm text-text-muted">Konu bulunamadı</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {total > 30 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 bg-bg-card border border-border rounded-lg font-mono text-xs text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors">Previous</button>
          <span className="font-mono text-xs text-text-muted">Page {page} of {Math.ceil(total / 30)}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / 30)} className="px-3 py-1.5 bg-bg-card border border-border rounded-lg font-mono text-xs text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors">Next</button>
        </div>
      )}
      {moveModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setMoveModal(null)}>
          <div className="bg-bg-card border border-border rounded-xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-mono text-sm font-bold text-text-primary mb-4">Konu Taşı: {moveModal.title}</h3>
            <select value={targetCategory} onChange={e => setTargetCategory(e.target.value)} className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg font-mono text-sm text-text-primary focus:outline-none focus:border-accent-purple mb-4">
              <option value="">Kategori seçin</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="flex gap-2">
              <button onClick={handleMove} className="px-4 py-2 bg-accent-purple text-white rounded-lg font-mono text-xs hover:opacity-80 transition-opacity">Taşı</button>
              <button onClick={() => setMoveModal(null)} className="px-4 py-2 bg-bg-primary border border-border rounded-lg font-mono text-xs text-text-muted hover:text-text-primary transition-colors">İptal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== POSTS TAB ====================
function PostsTab({ data, onRefresh, search, setSearch, page, setPage }) {
  const [posts, setPosts] = useState(data.posts || []);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const loadPosts = async () => {
    try {
      setLoading(true);
      const { data: res } = await adminApi.getPosts({ page, limit: 30, search });
      setPosts(res?.posts || []);
      setTotal(res?.total || 0);
    } catch (err) {
      toast.error('Mesajlar yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPosts(); }, [page]);
  useEffect(() => {
    const timer = setTimeout(() => { setPage(1); loadPosts(); }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const handleRestore = async (id) => {
    try { await adminApi.restorePost(id); toast.success('Mesaj geri yüklendi'); loadPosts(); }
    catch (err) { toast.error('Geri yükleme başarısız'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Bu mesajı silmek istediğinize emin misiniz?')) return;
    try { await adminApi.deletePost(id); toast.success('Mesaj silindi'); loadPosts(); }
    catch (err) { toast.error('Silme başarısız'); }
  };

  const handleHardDelete = async (id) => {
    if (!confirm('Bu mesajı KALICI olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz!')) return;
    try { await adminApi.hardDeletePost(id); toast.success('Mesaj kalıcı olarak silindi'); loadPosts(); }
    catch (err) { toast.error('Silme başarısız'); }
  };

  if (loading && posts.length === 0) return <div className="text-center py-8 text-text-muted font-mono text-sm">Mesajlar yükleniyor...</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-text-primary font-mono">Mesajlar ({total})</h2>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Mesaj ara..." className="px-3 py-2 bg-bg-primary border border-border rounded-lg font-mono text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-purple w-48" />
      </div>
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 font-mono text-xs text-text-muted">Yazar</th>
                <th className="text-left px-4 py-3 font-mono text-xs text-text-muted">İçerik</th>
                <th className="text-left px-4 py-3 font-mono text-xs text-text-muted">Konu</th>
                <th className="text-center px-4 py-3 font-mono text-xs text-text-muted">Tarih</th>
                <th className="text-center px-4 py-3 font-mono text-xs text-text-muted">Durum</th>
                <th className="text-right px-4 py-3 font-mono text-xs text-text-muted">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {posts.map(p => (
                <tr key={p.id} className="border-b border-border hover:bg-bg-primary/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-text-muted">{p.author_username || '?'}</td>
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs text-text-primary line-clamp-2 max-w-[300px]">{p.content}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-text-muted truncate max-w-[150px]">{p.thread_title || '?'}</td>
                  <td className="px-4 py-3 text-center font-mono text-xs text-text-muted">{p.created_at ? format(new Date(p.created_at), 'dd.MM.yy HH:mm') : '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-xs ${p.deleted_at ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
                      {p.deleted_at ? 'Silinmiş' : 'Aktif'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {p.deleted_at ? (
                        <button onClick={() => handleRestore(p.id)} className="px-2 py-1 bg-green-500/10 border border-green-500/30 rounded font-mono text-xs text-green-400 hover:bg-green-500/20 transition-colors">Geri Yükle</button>
                      ) : (
                        <button onClick={() => handleDelete(p.id)} className="px-2 py-1 bg-bg-primary border border-border rounded font-mono text-xs text-text-muted hover:text-red-400 transition-colors">Sil</button>
                      )}
                      {p.deleted_at && (
                        <button onClick={() => handleHardDelete(p.id)} className="px-2 py-1 bg-red-500/10 border border-red-500/30 rounded font-mono text-xs text-red-400 hover:bg-red-500/20 transition-colors">Kalıcı Sil</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {posts.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center font-mono text-sm text-text-muted">Mesaj bulunamadı</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {total > 30 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 bg-bg-card border border-border rounded-lg font-mono text-xs text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors">Previous</button>
          <span className="font-mono text-xs text-text-muted">Page {page} of {Math.ceil(total / 30)}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / 30)} className="px-3 py-1.5 bg-bg-card border border-border rounded-lg font-mono text-xs text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors">Next</button>
        </div>
      )}
    </div>
  );
}

// ==================== BADGES TAB ====================
function BadgesTab({ data, onRefresh }) {
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', icon: '🏅', color: '#fbbf24', description: '' });
  const [showForm, setShowForm] = useState(false);

  const loadBadges = async () => {
    try {
      setLoading(true);
      const { data: res } = await (adminApi.getBadges?.() || Promise.resolve({ data: [] }));
      setBadges(res || []);
    } catch (err) {
      toast.error('Rozetler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadBadges(); }, []);

  const handleCreate = async () => {
    if (!form.name.trim()) return toast.error('Rozet adı gerekli');
    try {
      await (adminApi.createBadge?.(form) || Promise.resolve());
      toast.success('Rozet oluşturuldu');
      setShowForm(false);
      setForm({ name: '', icon: '🏅', color: '#fbbf24', description: '' });
      loadBadges();
      onRefresh();
    } catch (err) {
      toast.error('Oluşturma başarısız');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Bu rozeti silmek istediğinize emin misiniz?')) return;
    try {
      await adminApi.deleteBadge(id);
      toast.success('Rozet silindi');
      loadBadges();
      onRefresh();
    } catch (err) {
      toast.error('Silme başarısız');
    }
  };

  if (loading) return <div className="text-center py-8 text-text-muted font-mono text-sm">Rozetler yükleniyor...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-text-primary font-mono">Rozetler ({badges.length})</h2>
        <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-accent-purple text-white rounded-lg font-mono text-xs hover:opacity-80 transition-opacity">+ Yeni Rozet</button>
      </div>
      {showForm && (
        <div className="bg-bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Rozet adı" className="px-3 py-2 bg-bg-primary border border-border rounded-lg font-mono text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-purple" />
            <input value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} placeholder="İkon (emoji)" className="px-3 py-2 bg-bg-primary border border-border rounded-lg font-mono text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-purple" />
            <input value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} type="color" className="px-1 py-1 bg-bg-primary border border-border rounded-lg h-10 w-full cursor-pointer" />
          </div>
          <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Açıklama" className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg font-mono text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-purple" />
          <div className="flex gap-2">
            <button onClick={handleCreate} className="px-4 py-2 bg-accent-purple text-white rounded-lg font-mono text-xs hover:opacity-80 transition-opacity">Oluştur</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-bg-primary border border-border rounded-lg font-mono text-xs text-text-muted hover:text-text-primary transition-colors">İptal</button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {badges.map(b => (
          <div key={b.id} className="bg-bg-card border border-border rounded-xl p-4 text-center group relative">
            <span className="text-3xl block mb-2">{b.icon || '🏅'}</span>
            <p className="font-mono text-xs font-bold text-text-primary truncate">{b.name}</p>
            {b.description && <p className="font-mono text-xs text-text-muted truncate mt-0.5">{b.description}</p>}
            <button onClick={() => handleDelete(b.id)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300 text-xs">✕</button>
          </div>
        ))}
        {badges.length === 0 && (
          <div className="col-span-full text-center py-8 font-mono text-sm text-text-muted">Henüz rozet eklenmemiş</div>
        )}
      </div>
    </div>
  );
}

// ==================== TAGS TAB ====================
function TagsTab({ data, onRefresh }) {
  const [tags, setTags] = useState(data.tags || []);
  const [loading, setLoading] = useState(false);
  const [newTag, setNewTag] = useState('');

  const loadTags = async () => {
    try {
      setLoading(true);
      const { data: res } = await adminApi.getTags();
      setTags(res || []);
    } catch (err) {
      toast.error('Etiketler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTags(); }, []);

  const handleCreate = async () => {
    if (!newTag.trim()) return toast.error('Etiket adı gerekli');
    try {
      await adminApi.createTag({ name: newTag.trim() });
      toast.success('Etiket oluşturuldu');
      setNewTag('');
      loadTags();
      onRefresh();
    } catch (err) {
      toast.error('Oluşturma başarısız');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Bu etiketi silmek istediğinize emin misiniz?')) return;
    try {
      await adminApi.deleteTag(id);
      toast.success('Etiket silindi');
      loadTags();
      onRefresh();
    } catch (err) {
      toast.error('Silme başarısız');
    }
  };

  if (loading) return    <div className="text-center py-8 text-text-muted font-mono text-sm">Etiketler yükleniyor...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-text-primary font-mono">Etiketler ({tags.length})</h2>
        <div className="flex items-center gap-2">
          <input value={newTag} onChange={e => setNewTag(e.target.value)} placeholder="Yeni etiket adı" className="px-3 py-2 bg-bg-primary border border-border rounded-lg font-mono text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-purple w-40" onKeyDown={e => e.key === 'Enter' && handleCreate()} />
          <button onClick={handleCreate} className="px-4 py-2 bg-accent-purple text-white rounded-lg font-mono text-xs hover:opacity-80 transition-opacity">+ Ekle</button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {tags.map(t => (
          <div key={t.id} className="bg-bg-card border border-border rounded-lg px-3 py-2 flex items-center gap-2 group">
            <span className="font-mono text-sm text-text-primary">{t.name}</span>
            <span className="font-mono text-[10px] text-text-muted">({t.thread_count || 0})</span>
            <button onClick={() => handleDelete(t.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300 text-xs">✕</button>
          </div>
        ))}
        {tags.length === 0 && (
          <p className="font-mono text-sm text-text-muted py-4">Henüz etiket eklenmemiş</p>
        )}
      </div>
    </div>
  );
}

// ==================== IP BANS TAB ====================
function IpBansTab({ data, onRefresh }) {
  const [bans, setBans] = useState(data.ipBans || []);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ ip_address: '', reason: '' });
  const [showForm, setShowForm] = useState(false);

  const loadBans = async () => {
    try {
      setLoading(true);
      const { data: res } = await adminApi.getIpBans();
      setBans(res || []);
    } catch (err) {
      toast.error('IP yasakları yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!form.ip_address.trim()) return toast.error('IP adresi gerekli');
    try {
      await adminApi.createIpBan(form);
      toast.success('IP yasaklandı');
      setShowForm(false);
      setForm({ ip_address: '', reason: '' });
      loadBans();
      onRefresh();
    } catch (err) {
      toast.error('İşlem başarısız');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Bu IP yasağını kaldırmak istediğinize emin misiniz?')) return;
    try {
      await adminApi.deleteIpBan(id);
      toast.success('IP yasağı kaldırıldı');
      loadBans();
      onRefresh();
    } catch (err) {
      toast.error('Silme başarısız');
    }
  };

  if (loading && bans.length === 0) return <div className="text-center py-8 text-text-muted font-mono text-sm">IP yasakları yükleniyor...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-text-primary font-mono">IP Yasakları ({bans.length})</h2>
        <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-accent-purple text-white rounded-lg font-mono text-xs hover:opacity-80 transition-opacity">+ IP Yasakla</button>
      </div>
      {showForm && (
        <div className="bg-bg-card border border-border rounded-xl p-4 space-y-3">
          <input value={form.ip_address} onChange={e => setForm(f => ({ ...f, ip_address: e.target.value }))} placeholder="IP adresi (örn: 192.168.1.1)" className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg font-mono text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-purple" />
          <input value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="Yasaklama sebebi" className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg font-mono text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-purple" />
          <div className="flex gap-2">
            <button onClick={handleCreate} className="px-4 py-2 bg-accent-purple text-white rounded-lg font-mono text-xs hover:opacity-80 transition-opacity">Yasakla</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-bg-primary border border-border rounded-lg font-mono text-xs text-text-muted hover:text-text-primary transition-colors">İptal</button>
          </div>
        </div>
      )}
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3 font-mono text-xs text-text-muted">IP Adresi</th>
              <th className="text-left px-4 py-3 font-mono text-xs text-text-muted">Sebep</th>
              <th className="text-left px-4 py-3 font-mono text-xs text-text-muted">Yasaklayan</th>
              <th className="text-center px-4 py-3 font-mono text-xs text-text-muted">Tarih</th>
              <th className="text-right px-4 py-3 font-mono text-xs text-text-muted">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {bans.map(b => (
              <tr key={b.id} className="border-b border-border hover:bg-bg-primary/50 transition-colors">
                <td className="px-4 py-3 font-mono text-sm text-text-primary">{b.ip_address}</td>
                <td className="px-4 py-3 font-mono text-xs text-text-muted">{b.reason || '—'}</td>
                <td className="px-4 py-3 font-mono text-xs text-text-muted">{b.banned_by_username || '?'}</td>
                <td className="px-4 py-3 text-center font-mono text-xs text-text-muted">{b.created_at ? format(new Date(b.created_at), 'dd.MM.yy HH:mm') : '-'}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleDelete(b.id)} className="px-2 py-1 bg-red-500/10 border border-red-500/30 rounded font-mono text-xs text-red-400 hover:bg-red-500/20 transition-colors">Kaldır</button>
                </td>
              </tr>
            ))}
            {bans.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center font-mono text-sm text-text-muted">IP yasağı bulunamadı</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ==================== SETTINGS TAB ====================
function SettingsTab({ data, onRefresh }) {
  const [settings, setSettings] = useState(data.settings || {});
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data.settings) {
      setSettings(data.settings);
      setForm({ ...data.settings });
    }
  }, [data.settings]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data: res } = await adminApi.getSettings();
      setSettings(res || {});
      setForm({ ...(res || {}) });
    } catch (err) {
      toast.error('Ayarlar yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      await adminApi.updateSettings(form);
      toast.success('Ayarlar kaydedildi');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onRefresh();
    } catch (err) {
      toast.error('Kaydetme başarısız');
    }
  };

  const updateField = (key, value) => {
    setForm(f => ({ ...f, [key]: value }));
  };

  if (loading) return <div className="text-center py-8 text-text-muted font-mono text-sm">Ayarlar yükleniyor...</div>;

  const settingFields = [
    { key: 'site_name', label: 'Site Adı', type: 'text' },
    { key: 'site_description', label: 'Site Açıklaması', type: 'text' },
    { key: 'site_url', label: 'Site URL', type: 'text' },
    { key: 'max_threads_per_page', label: 'Sayfa Başına Konu', type: 'number' },
    { key: 'max_posts_per_page', label: 'Sayfa Başına Mesaj', type: 'number' },
    { key: 'registration_enabled', label: 'Kayıt Açık', type: 'checkbox' },
    { key: 'email_verification_required', label: 'E-posta Doğrulama Zorunlu', type: 'checkbox' },
    { key: 'maintenance_mode', label: 'Bakım Modu', type: 'checkbox' },
    { key: 'min_password_length', label: 'Min. Şifre Uzunluğu', type: 'number' },
    { key: 'max_username_length', label: 'Max. Kullanıcı Adı Uzunluğu', type: 'number' },
    { key: 'default_user_role', label: 'Varsayılan Kullanıcı Rolü', type: 'select', options: ['member', 'moderator'] },
    { key: 'allow_attachments', label: 'Dosya Ekleme İzni', type: 'checkbox' },
    { key: 'max_attachment_size', label: 'Max. Dosya Boyutu (MB)', type: 'number' },
    { key: 'allowed_file_types', label: 'İzin Verilen Dosya Türleri', type: 'text' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-text-primary font-mono">Site Ayarları</h2>
        <div className="flex items-center gap-2">
          {saved && <span className="font-mono text-xs text-accent-green">✓ Kaydedildi</span>}
          <button onClick={handleSave} className="px-4 py-2 bg-accent-purple text-white rounded-lg font-mono text-xs hover:opacity-80 transition-opacity">Kaydet</button>
        </div>
      </div>
      <div className="bg-bg-card border border-border rounded-xl p-4 space-y-4">
        {settingFields.map(({ key, label, type, options }) => (
          <div key={key} className="flex items-center justify-between">
            <label className="font-mono text-sm text-text-primary">{label}</label>
            {type === 'checkbox' ? (
              <input type="checkbox" checked={!!form[key]} onChange={e => updateField(key, e.target.checked)} className="w-5 h-5 rounded border-border bg-bg-primary text-accent-purple focus:ring-accent-purple cursor-pointer" />
            ) : type === 'select' ? (
              <select value={form[key] || ''} onChange={e => updateField(key, e.target.value)} className="px-3 py-1.5 bg-bg-primary border border-border rounded-lg font-mono text-xs text-text-primary focus:outline-none focus:border-accent-purple">
                {options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input type={type} value={form[key] || ''} onChange={e => updateField(key, e.target.value)} className="w-48 px-3 py-1.5 bg-bg-primary border border-border rounded-lg font-mono text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-purple" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== SECURITY TAB ====================
function SecurityTab({ data, onRefresh }) {
  const [loading, setLoading] = useState(false);
  const [securityData, setSecurityData] = useState(null);

  const loadSecurity = async () => {
    try {
      setLoading(true);
      const { data: res } = await (adminApi.getSecurityEvents?.() || Promise.resolve({ data: null }));
      setSecurityData(res);
    } catch (err) {
      // Security events might not be available
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSecurity(); }, []);

  const securityMetrics = [
    { icon: Shield, label: 'Rate Limit İhlalleri', value: securityData?.rate_limits || 0, color: 'text-orange-400' },
    { icon: Bug, label: 'XSS Girişimleri', value: securityData?.xss_attempts || 0, color: 'text-red-400' },
    { icon: Database, label: 'SQL Enjeksiyon', value: securityData?.sql_attempts || 0, color: 'text-red-400' },
    { icon: Scan, label: 'Tarama Tespiti', value: securityData?.scan_detections || 0, color: 'text-yellow-400' },
    { icon: Fingerprint, label: 'Brute Force', value: securityData?.brute_force || 0, color: 'text-orange-400' },
    { icon: GlobeLock, label: 'IP Blokajları', value: securityData?.ip_blocks || 0, color: 'text-purple-400' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-text-primary font-mono">Güvenlik</h2>
        <button onClick={loadSecurity} className="px-3 py-1.5 bg-bg-card border border-border rounded-lg font-mono text-xs text-text-muted hover:text-text-primary transition-colors">Yenile</button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        {securityMetrics.map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-bg-card border border-border rounded-xl p-4 text-center">
            <Icon className={`w-5 h-5 mx-auto mb-2 ${color}`} />
            <div className={`font-mono font-bold text-xl ${color}`}>{value}</div>
            <div className="font-mono text-[9px] text-text-muted mt-1 uppercase tracking-wider">{label}</div>
          </div>
        ))}
      </div>

      <div className="bg-bg-card border border-border rounded-xl p-4">
        <h3 className="font-mono text-sm font-bold text-text-primary mb-3">Güvenlik Önlemleri</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between py-2 border-b border-border">
            <span className="font-mono text-xs text-text-primary">Rate Limiting</span>
            <span className="font-mono text-xs text-accent-green">✓ Aktif</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border">
            <span className="font-mono text-xs text-text-primary">CSRF Koruması</span>
            <span className="font-mono text-xs text-accent-green">✓ Aktif</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border">
            <span className="font-mono text-xs text-text-primary">XSS Filtreleme</span>
            <span className="font-mono text-xs text-accent-green">✓ Aktif</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border">
            <span className="font-mono text-xs text-text-primary">SQL Enjeksiyon Koruması</span>
            <span className="font-mono text-xs text-accent-green">✓ Aktif</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border">
            <span className="font-mono text-xs text-text-primary">Helmet (Güvenlik Headerları)</span>
            <span className="font-mono text-xs text-accent-green">✓ Aktif</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border">
            <span className="font-mono text-xs text-text-primary">Input Sanitizasyonu</span>
            <span className="font-mono text-xs text-accent-green">✓ Aktif</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="font-mono text-xs text-text-primary">JWT Token Doğrulama</span>
            <span className="font-mono text-xs text-accent-green">✓ Aktif</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== BROADCAST TAB ====================
function BroadcastTab({ data, onRefresh }) {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('info');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!message.trim()) return toast.error('Mesaj gerekli');
    setSending(true);
    try {
      await adminApi.sendBroadcast({ title: title.trim(), message: message.trim(), type });
      toast.success('Duyuru gönderildi!');
      setTitle('');
      setMessage('');
      setType('info');
    } catch (err) {
      toast.error('Gönderme başarısız');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-text-primary font-mono">Duyuru Gönder</h2>
      <div className="bg-bg-card border border-border rounded-xl p-4 space-y-4">
        <div>
          <label className="font-mono text-xs text-text-muted mb-1 block">Başlık (opsiyonel)</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Duyuru başlığı" className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg font-mono text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-purple" />
        </div>
        <div>
          <label className="font-mono text-xs text-text-muted mb-1 block">Mesaj</label>
          <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Duyuru mesajı..." rows={4} className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg font-mono text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-purple resize-none" />
        </div>
        <div className="flex items-center gap-3">
          <label className="font-mono text-xs text-text-muted">Tür:</label>
          <select value={type} onChange={e => setType(e.target.value)} className="px-3 py-2 bg-bg-primary border border-border rounded-lg font-mono text-xs text-text-primary focus:outline-none focus:border-accent-purple">
            <option value="info">Bilgi</option>
            <option value="warning">Uyarı</option>
            <option value="alert">Acil</option>
            <option value="announcement">Duyuru</option>
          </select>
          <div className="flex-1" />
          <span className="font-mono text-[10px] text-text-muted">{message.length} karakter</span>
        </div>
        <button onClick={handleSend} disabled={sending || !message.trim()} className="w-full py-3 bg-accent-purple text-white rounded-lg font-mono text-sm font-bold hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity">
          {sending ? 'Gönderiliyor...' : 'Tüm Kullanıcılara Duyuru Gönder'}
        </button>
      </div>
    </div>
  );
}

// ==================== AUDIT LOG TAB ====================
function AuditTab({ data, onRefresh, page, setPage }) {
  const [logs, setLogs] = useState(data.auditLogs || []);
  const [total, setTotal] = useState(data.auditTotal || 0);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');

  const loadLogs = async () => {
    try {
      setLoading(true);
      const params = { page, limit: 50 };
      if (filter !== 'all') params.action = filter;
      const { data: res } = await adminApi.getAuditLog(params);
      setLogs(res?.logs || []);
      setTotal(res?.total || 0);
    } catch (err) {
      toast.error('Denetim kayıtları yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadLogs(); }, [page, filter]);

  const handleClean = async () => {
    if (!confirm('30 günden eski kayıtları silmek istediğinize emin misiniz?')) return;
    try {
      await adminApi.cleanAuditLog();
      toast.success('Eski kayıtlar temizlendi');
      loadLogs();
      onRefresh();
    } catch (err) {
      toast.error('Temizleme başarısız');
    }
  };

  const actionColors = {
    user_created: 'text-accent-green',
    user_deleted: 'text-accent-red',
    user_banned: 'text-accent-red',
    user_unbanned: 'text-accent-green',
    role_changed: 'text-accent-purple',
    thread_deleted: 'text-accent-red',
    post_deleted: 'text-accent-red',
    category_created: 'text-accent-green',
    category_deleted: 'text-accent-red',
    settings_updated: 'text-accent-cyan',
    ip_banned: 'text-accent-red',
    broadcast_sent: 'text-accent-yellow',
    password_reset: 'text-accent-yellow',
    badge_awarded: 'text-accent-yellow',
  };

  if (loading && logs.length === 0) return <div className="text-center py-8 text-text-muted font-mono text-sm">Denetim kayıtları yükleniyor...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-text-primary font-mono">Denetim Kayıtları ({total})</h2>
        <div className="flex items-center gap-2">
          <select value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }} className="px-3 py-2 bg-bg-primary border border-border rounded-lg font-mono text-xs text-text-primary focus:outline-none focus:border-accent-purple">
            <option value="all">Tümü</option>
            <option value="user_created">Kullanıcı Oluşturma</option>
            <option value="user_deleted">Kullanıcı Silme</option>
            <option value="user_banned">Kullanıcı Yasaklama</option>
            <option value="role_changed">Rol Değişikliği</option>
            <option value="thread_deleted">Konu Silme</option>
            <option value="post_deleted">Mesaj Silme</option>
            <option value="settings_updated">Ayar Değişikliği</option>
            <option value="broadcast_sent">Duyuru Gönderme</option>
          </select>
          <button onClick={handleClean} className="px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg font-mono text-xs text-red-400 hover:bg-red-500/20 transition-colors">Eski Kayıtları Temizle</button>
        </div>
      </div>
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 font-mono text-xs text-text-muted">İşlem</th>
                <th className="text-left px-4 py-3 font-mono text-xs text-text-muted">Kullanıcı</th>
                <th className="text-left px-4 py-3 font-mono text-xs text-text-muted">Detay</th>
                <th className="text-left px-4 py-3 font-mono text-xs text-text-muted">IP</th>
                <th className="text-right px-4 py-3 font-mono text-xs text-text-muted">Tarih</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id} className="border-b border-border hover:bg-bg-primary/50 transition-colors">
                  <td className="px-4 py-3">
                    <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider ${actionColors[l.action] || 'text-text-muted'} bg-current/10`}>
                      {l.action?.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-text-primary">{l.admin_username || l.username || '?'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-text-muted max-w-[200px] truncate">{l.details || l.target_username || '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-text-muted">{l.ip_address || '—'}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-text-muted">{l.created_at ? formatDistanceToNow(new Date(l.created_at), { addSuffix: true }) : '—'}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center font-mono text-sm text-text-muted">Kayıt bulunamadı</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {total > 50 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 bg-bg-card border border-border rounded-lg font-mono text-xs text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors">Previous</button>
          <span className="font-mono text-xs text-text-muted">Page {page} of {Math.ceil(total / 50)}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / 50)} className="px-3 py-1.5 bg-bg-card border border-border rounded-lg font-mono text-xs text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors">Next</button>
        </div>
      )}
    </div>
  );
}
