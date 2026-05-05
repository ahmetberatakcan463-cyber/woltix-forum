'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Settings, Shield, Key, User, QrCode } from 'lucide-react';
import api from '@/lib/api';
import useAuthStore from '@/store/authStore';
import toast from 'react-hot-toast';
import Image from 'next/image';

export default function SettingsPage() {
  const { user, updateUser, logout } = useAuthStore();
  const router = useRouter();
  const [profile, setProfile] = useState({ bio: '', website: '', signature: '', avatar_url: '' });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' });
  const [twofa, setTwofa] = useState({ setup: null, code: '', enabled: false });
  const [tab, setTab] = useState('profile');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) { router.push('/auth/login'); return; }
    setProfile({ bio: user.bio || '', website: user.website || '', signature: user.signature || '', avatar_url: user.avatar_url || '' });
    setTwofa(f => ({ ...f, enabled: user.totp_enabled }));
  }, [user]);

  async function saveProfile(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.patch('/users/me', profile);
      updateUser(res.data);
      toast.success('Profile updated');
    } catch {
      toast.error('Update failed');
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(e) {
    e.preventDefault();
    if (passwords.newPassword.length < 8) { toast.error('Password too short'); return; }
    setSaving(true);
    try {
      await api.patch('/users/me/password', passwords);
      toast.success('Password changed. Please login again.');
      await logout();
      router.push('/auth/login');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    } finally {
      setSaving(false);
    }
  }

  async function setup2FA() {
    try {
      const res = await api.get('/auth/2fa/setup');
      setTwofa(f => ({ ...f, setup: res.data }));
    } catch {
      toast.error('2FA setup failed');
    }
  }

  async function verify2FA(e) {
    e.preventDefault();
    try {
      await api.post('/auth/2fa/verify', { code: twofa.code });
      toast.success('2FA enabled');
      updateUser({ totp_enabled: true });
      setTwofa(f => ({ ...f, enabled: true, setup: null }));
    } catch {
      toast.error('Invalid code');
    }
  }

  async function disable2FA(e) {
    e.preventDefault();
    try {
      await api.delete('/auth/2fa', { data: { code: twofa.code } });
      toast.success('2FA disabled');
      updateUser({ totp_enabled: false });
      setTwofa(f => ({ ...f, enabled: false, code: '' }));
    } catch {
      toast.error('Invalid code');
    }
  }

  const TABS = [
    { key: 'profile', icon: User, label: 'profile' },
    { key: 'security', icon: Key, label: 'security' },
    { key: '2fa', icon: Shield, label: '2FA' },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-6">
        <Settings className="w-5 h-5 text-accent-green" />
        <h1 className="font-mono font-bold text-lg text-accent-green">settings</h1>
      </div>

      <div className="flex gap-1 mb-6 bg-bg-card border border-border rounded-xl p-1">
        {TABS.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg font-mono text-xs transition-colors ${tab === key ? 'bg-accent-green text-bg-primary font-semibold' : 'text-text-muted hover:text-text-primary'}`}
          >
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      {/* Profile */}
      {tab === 'profile' && (
        <form onSubmit={saveProfile} className="bg-bg-card border border-border rounded-xl p-6 space-y-4">
          <div>
            <label className="font-mono text-xs text-text-muted mb-1.5 block">avatar URL</label>
            <input
              value={profile.avatar_url}
              onChange={e => setProfile(f => ({ ...f, avatar_url: e.target.value }))}
              placeholder="https://example.com/avatar.jpg"
              className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2.5 font-mono text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-green/50"
            />
          </div>
          <div>
            <label className="font-mono text-xs text-text-muted mb-1.5 block">bio</label>
            <textarea
              value={profile.bio}
              onChange={e => setProfile(f => ({ ...f, bio: e.target.value }))}
              placeholder="Tell the community about yourself..."
              rows={3}
              maxLength={500}
              className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2.5 font-mono text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-green/50 resize-none"
            />
          </div>
          <div>
            <label className="font-mono text-xs text-text-muted mb-1.5 block">website</label>
            <input
              value={profile.website}
              onChange={e => setProfile(f => ({ ...f, website: e.target.value }))}
              placeholder="https://yoursite.com"
              className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2.5 font-mono text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-green/50"
            />
          </div>
          <div>
            <label className="font-mono text-xs text-text-muted mb-1.5 block">signature</label>
            <input
              value={profile.signature}
              onChange={e => setProfile(f => ({ ...f, signature: e.target.value }))}
              placeholder="Your post signature..."
              maxLength={200}
              className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2.5 font-mono text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-green/50"
            />
          </div>
          <button type="submit" disabled={saving} className="w-full py-2.5 bg-accent-green text-bg-primary font-mono font-bold text-sm rounded-lg hover:bg-accent-green/90 disabled:opacity-40 transition-colors">
            {saving ? 'saving...' : 'save profile'}
          </button>
        </form>
      )}

      {/* Security */}
      {tab === 'security' && (
        <form onSubmit={changePassword} className="bg-bg-card border border-border rounded-xl p-6 space-y-4">
          <h2 className="font-mono text-sm font-semibold text-text-secondary">change password</h2>
          <div>
            <label className="font-mono text-xs text-text-muted mb-1.5 block">current password</label>
            <input
              type="password"
              value={passwords.currentPassword}
              onChange={e => setPasswords(f => ({ ...f, currentPassword: e.target.value }))}
              required
              className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2.5 font-mono text-sm text-text-primary focus:outline-none focus:border-accent-green/50"
            />
          </div>
          <div>
            <label className="font-mono text-xs text-text-muted mb-1.5 block">new password</label>
            <input
              type="password"
              value={passwords.newPassword}
              onChange={e => setPasswords(f => ({ ...f, newPassword: e.target.value }))}
              minLength={8}
              required
              className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2.5 font-mono text-sm text-text-primary focus:outline-none focus:border-accent-green/50"
            />
          </div>
          <button type="submit" disabled={saving} className="w-full py-2.5 bg-accent-green text-bg-primary font-mono font-bold text-sm rounded-lg hover:bg-accent-green/90 disabled:opacity-40 transition-colors">
            {saving ? 'changing...' : 'change password'}
          </button>
        </form>
      )}

      {/* 2FA */}
      {tab === '2fa' && (
        <div className="bg-bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield className={`w-5 h-5 ${twofa.enabled ? 'text-accent-green' : 'text-text-muted'}`} />
            <div>
              <h2 className="font-mono text-sm font-semibold text-text-primary">Two-Factor Authentication</h2>
              <p className={`font-mono text-xs ${twofa.enabled ? 'text-accent-green' : 'text-text-muted'}`}>
                {twofa.enabled ? '● enabled' : '○ disabled'}
              </p>
            </div>
          </div>

          {!twofa.enabled && !twofa.setup && (
            <button onClick={setup2FA} className="w-full py-2.5 bg-accent-purple text-white font-mono font-bold text-sm rounded-lg hover:bg-accent-purple/90 transition-colors">
              setup 2FA
            </button>
          )}

          {twofa.setup && !twofa.enabled && (
            <div className="space-y-4">
              <div className="text-center">
                <p className="font-mono text-xs text-text-muted mb-3">scan with your authenticator app</p>
                <div className="inline-block p-3 bg-white rounded-xl">
                  <img src={twofa.setup.qrCode} alt="2FA QR Code" width={180} height={180} />
                </div>
                <p className="font-mono text-[10px] text-text-muted mt-2 break-all">or enter: {twofa.setup.secret}</p>
              </div>
              <form onSubmit={verify2FA}>
                <label className="font-mono text-xs text-text-muted mb-1.5 block">enter code from app</label>
                <input
                  value={twofa.code}
                  onChange={e => setTwofa(f => ({ ...f, code: e.target.value }))}
                  placeholder="000000"
                  maxLength={6}
                  required
                  className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2.5 font-mono text-lg text-center text-accent-green tracking-widest focus:outline-none focus:border-accent-green/50 mb-3"
                />
                <button type="submit" className="w-full py-2.5 bg-accent-green text-bg-primary font-mono font-bold text-sm rounded-lg hover:bg-accent-green/90 transition-colors">
                  verify & enable
                </button>
              </form>
            </div>
          )}

          {twofa.enabled && (
            <form onSubmit={disable2FA} className="space-y-3">
              <p className="font-mono text-xs text-text-muted">enter your 2FA code to disable</p>
              <input
                value={twofa.code}
                onChange={e => setTwofa(f => ({ ...f, code: e.target.value }))}
                placeholder="000000"
                maxLength={6}
                required
                className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2.5 font-mono text-lg text-center text-accent-green tracking-widest focus:outline-none focus:border-accent-green/50"
              />
              <button type="submit" className="w-full py-2.5 bg-accent-red/10 text-accent-red border border-accent-red/20 font-mono font-bold text-sm rounded-lg hover:bg-accent-red/20 transition-colors">
                disable 2FA
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
