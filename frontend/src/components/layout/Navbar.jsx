'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Terminal, Search, Bell, Mail, Menu, X, Shield, LogOut, User, Settings, ChevronDown } from 'lucide-react';
import useAuthStore from '@/store/authStore';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function Navbar() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (user) {
      fetchCounts();
      const interval = setInterval(fetchCounts, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  async function fetchCounts() {
    try {
      const [msgs, notifs] = await Promise.all([
        api.get('/messages/unread/count'),
        api.get('/users/me/notifications'),
      ]);
      setUnreadMessages(msgs.data.count);
      setUnreadNotifs(notifs.data.filter(n => !n.is_read).length);
    } catch {}
  }

  async function handleLogout() {
    await logout();
    toast.success('Logged out');
    router.push('/');
  }

  function handleSearch(e) {
    e.preventDefault();
    if (searchQuery.trim().length < 2) return;
    router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    setSearchQuery('');
  }

  const rankClass = {
    'Newbie': 'text-text-secondary',
    'Member': 'text-emerald-400',
    'Regular': 'text-cyan-400',
    'Veteran': 'text-yellow-400',
    'Expert': 'text-accent-purple',
    'Elite': 'text-accent-green',
    'Legend': 'text-accent-red',
  };

  return (
    <header className="sticky top-0 z-50 bg-bg-secondary border-b border-border">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center h-14 gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <Terminal className="w-5 h-5 text-accent-green" />
            <span className="font-mono font-bold text-accent-green glow-green text-lg tracking-wider">WOLTIX</span>
            <span className="text-text-muted font-mono text-xs hidden sm:block">/forum</span>
          </Link>

          {/* Search */}
          <form onSubmit={handleSearch} className="flex-1 max-w-xs hidden md:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="search..."
                className="w-full bg-bg-tertiary border border-border rounded pl-9 pr-3 py-1.5 text-sm font-mono text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-green/50 transition-colors"
              />
            </div>
          </form>

          <div className="flex-1" />

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-1 text-sm font-mono">
            <Link href="/" className="px-3 py-1.5 text-text-secondary hover:text-accent-green transition-colors rounded hover:bg-bg-tertiary">
              ~/index
            </Link>
            {user?.role === 'admin' || user?.role === 'moderator' ? (
              <Link href="/admin" className="px-3 py-1.5 text-accent-purple hover:text-accent-purple/80 transition-colors rounded hover:bg-bg-tertiary flex items-center gap-1">
                <Shield className="w-3.5 h-3.5" />
                admin
              </Link>
            ) : null}
          </nav>

          {/* Auth */}
          {user ? (
            <div className="flex items-center gap-2">
              {/* Notifications */}
              <Link href="/messages" className="relative p-2 text-text-secondary hover:text-accent-green transition-colors">
                <Mail className="w-4 h-4" />
                {unreadMessages > 0 && (
                  <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-accent-green text-bg-primary text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unreadMessages > 9 ? '9+' : unreadMessages}
                  </span>
                )}
              </Link>

              <button className="relative p-2 text-text-secondary hover:text-accent-green transition-colors">
                <Bell className="w-4 h-4" />
                {unreadNotifs > 0 && (
                  <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-accent-purple text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unreadNotifs > 9 ? '9+' : unreadNotifs}
                  </span>
                )}
              </button>

              {/* User menu */}
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded border border-border hover:border-accent-green/30 bg-bg-tertiary transition-colors"
                >
                  <span className={`font-mono text-sm font-medium ${rankClass[user.rank] || 'text-text-primary'}`}>
                    {user.username}
                  </span>
                  <ChevronDown className="w-3 h-3 text-text-muted" />
                </button>

                {userMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                    <div className="absolute right-0 mt-1 w-48 bg-bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden">
                      <div className="px-3 py-2 border-b border-border">
                        <p className="text-xs text-text-muted font-mono">{user.rank}</p>
                        <p className="text-xs text-text-secondary font-mono">{user.email}</p>
                      </div>
                      <Link
                        href={`/u/${user.username}`}
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-mono text-text-secondary hover:text-accent-green hover:bg-bg-tertiary transition-colors"
                      >
                        <User className="w-3.5 h-3.5" /> Profile
                      </Link>
                      <Link
                        href="/settings"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-mono text-text-secondary hover:text-accent-green hover:bg-bg-tertiary transition-colors"
                      >
                        <Settings className="w-3.5 h-3.5" /> Settings
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm font-mono text-accent-red hover:bg-bg-tertiary transition-colors"
                      >
                        <LogOut className="w-3.5 h-3.5" /> Logout
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/auth/login" className="px-3 py-1.5 text-sm font-mono text-text-secondary hover:text-accent-green transition-colors">
                login
              </Link>
              <Link href="/auth/register" className="px-3 py-1.5 text-sm font-mono bg-accent-green text-bg-primary rounded font-semibold hover:bg-accent-green/90 transition-colors">
                register
              </Link>
            </div>
          )}

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden p-2 text-text-secondary hover:text-accent-green transition-colors"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden py-3 border-t border-border">
            <form onSubmit={handleSearch} className="mb-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="search..."
                  className="w-full bg-bg-tertiary border border-border rounded pl-9 pr-3 py-2 text-sm font-mono"
                />
              </div>
            </form>
            <Link href="/" onClick={() => setMenuOpen(false)} className="block py-2 text-sm font-mono text-text-secondary hover:text-accent-green">~/index</Link>
          </div>
        )}
      </div>
    </header>
  );
}
