'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Terminal, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import api from '@/lib/api';
import useAuthStore from '@/store/authStore';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const checks = {
    username: form.username.length >= 3 && /^[a-zA-Z0-9_-]+$/.test(form.username),
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email),
    password: form.password.length >= 8,
  };

  async function handleSubmit(e) {
    e.preventDefault();
    if (!Object.values(checks).every(Boolean)) return;

    setLoading(true);
    try {
      const res = await api.post('/auth/register', form);
      setAuth(res.data.user, res.data.accessToken, res.data.refreshToken);
      api.defaults.headers.common['Authorization'] = `Bearer ${res.data.accessToken}`;
      toast.success(`Welcome to Woltix, ${res.data.user.username}!`);
      router.push('/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  const Check = ({ ok }) => ok
    ? <CheckCircle className="w-3.5 h-3.5 text-accent-green shrink-0" />
    : <XCircle className="w-3.5 h-3.5 text-text-muted shrink-0" />;

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Terminal className="w-8 h-8 text-accent-green mx-auto mb-3" />
          <h1 className="font-mono text-2xl font-bold text-accent-green glow-green">REGISTER</h1>
          <p className="font-mono text-text-muted text-xs mt-1">// create your woltix identity</p>
        </div>

        <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 bg-bg-tertiary border-b border-border">
            <div className="w-2.5 h-2.5 rounded-full bg-accent-red" />
            <div className="w-2.5 h-2.5 rounded-full bg-accent-yellow" />
            <div className="w-2.5 h-2.5 rounded-full bg-accent-green" />
            <span className="font-mono text-text-muted text-xs ml-2">woltix — new user</span>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block font-mono text-xs text-text-muted mb-1.5">username</label>
              <input
                type="text"
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                placeholder="h4x0r_name"
                required
                className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2.5 font-mono text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-green/50 transition-colors"
              />
              <div className="flex items-center gap-1.5 mt-1.5">
                <Check ok={checks.username} />
                <span className="font-mono text-xs text-text-muted">3+ chars, letters/numbers/_/-</span>
              </div>
            </div>

            <div>
              <label className="block font-mono text-xs text-text-muted mb-1.5">email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="you@example.com"
                required
                className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2.5 font-mono text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-green/50 transition-colors"
              />
              <div className="flex items-center gap-1.5 mt-1.5">
                <Check ok={checks.email} />
                <span className="font-mono text-xs text-text-muted">valid email address</span>
              </div>
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
              <div className="flex items-center gap-1.5 mt-1.5">
                <Check ok={checks.password} />
                <span className="font-mono text-xs text-text-muted">minimum 8 characters</span>
              </div>
            </div>

            {/* Password strength */}
            {form.password && (
              <div className="space-y-1">
                <div className="flex gap-1">
                  {[1,2,3,4].map(i => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        form.password.length >= i * 4
                          ? i <= 1 ? 'bg-accent-red'
                            : i <= 2 ? 'bg-accent-yellow'
                            : i <= 3 ? 'bg-accent-cyan'
                            : 'bg-accent-green'
                          : 'bg-border'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !Object.values(checks).every(Boolean)}
              className="w-full py-2.5 bg-accent-green text-bg-primary font-mono font-bold text-sm rounded-lg hover:bg-accent-green/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed mt-2"
            >
              {loading ? 'creating account...' : '> register'}
            </button>
          </form>

          <div className="px-6 pb-6 text-center">
            <p className="font-mono text-text-muted text-xs">
              already a member?{' '}
              <Link href="/auth/login" className="text-accent-green hover:text-accent-purple transition-colors">
                login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
