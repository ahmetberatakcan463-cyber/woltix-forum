'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Terminal, Eye, EyeOff, Lock } from 'lucide-react';
import api from '@/lib/api';
import useAuthStore from '@/store/authStore';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [form, setForm] = useState({ username: '', password: '', totpCode: '' });
  const [show2FA, setShow2FA] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await api.post('/auth/login', form);

      if (res.data.requires2FA) {
        setShow2FA(true);
        toast('Enter your 2FA code', { icon: '🔐' });
        setLoading(false);
        return;
      }

      setAuth(res.data.user, res.data.accessToken, res.data.refreshToken);
      api.defaults.headers.common['Authorization'] = `Bearer ${res.data.accessToken}`;
      toast.success(`Welcome back, ${res.data.user.username}`);
      router.push('/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Terminal header */}
        <div className="mb-8 text-center">
          <Terminal className="w-8 h-8 text-accent-green mx-auto mb-3" />
          <h1 className="font-mono text-2xl font-bold text-accent-green glow-green">LOGIN</h1>
          <p className="font-mono text-text-muted text-xs mt-1">// authenticate to access woltix</p>
        </div>

        <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
          {/* Terminal bar */}
          <div className="flex items-center gap-2 px-4 py-2 bg-bg-tertiary border-b border-border">
            <div className="w-2.5 h-2.5 rounded-full bg-accent-red" />
            <div className="w-2.5 h-2.5 rounded-full bg-accent-yellow" />
            <div className="w-2.5 h-2.5 rounded-full bg-accent-green" />
            <span className="font-mono text-text-muted text-xs ml-2">woltix — auth</span>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block font-mono text-xs text-text-muted mb-1.5">username</label>
              <input
                type="text"
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                placeholder="your_username"
                required
                autoComplete="username"
                className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2.5 font-mono text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-green/50 transition-colors"
              />
            </div>

            <div>
              <label className="block font-mono text-xs text-text-muted mb-1.5">password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2.5 pr-10 font-mono text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-green/50 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {show2FA && (
              <div>
                <label className="block font-mono text-xs text-accent-green mb-1.5 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> 2FA code
                </label>
                <input
                  type="text"
                  value={form.totpCode}
                  onChange={e => setForm(f => ({ ...f, totpCode: e.target.value }))}
                  placeholder="000000"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  className="w-full bg-bg-tertiary border border-accent-green/30 rounded-lg px-3 py-2.5 font-mono text-sm text-accent-green placeholder-text-muted focus:outline-none focus:border-accent-green/60 transition-colors tracking-widest text-center text-lg"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-accent-green text-bg-primary font-mono font-bold text-sm rounded-lg hover:bg-accent-green/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? 'authenticating...' : '> login'}
            </button>
          </form>

          <div className="px-6 pb-6 text-center">
            <p className="font-mono text-text-muted text-xs">
              no account?{' '}
              <Link href="/auth/register" className="text-accent-green hover:text-accent-purple transition-colors">
                register
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
