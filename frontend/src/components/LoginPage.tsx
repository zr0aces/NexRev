import React, { useState } from 'react';
import { Rocket, LogIn, Fingerprint } from 'lucide-react';
import { startAuthentication } from '@simplewebauthn/browser';
import { useToast } from '../context/ToastContext';
import { api } from '../api';

interface Props {
  onLogin: (username: string, password: string) => Promise<void>;
  onPasskeyLogin: (username: string, token: string) => void;
  version: string;
}

export default function LoginPage({ onLogin, onPasskeyLogin, version }: Props) {
  const { addToast } = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    try {
      await onLogin(username.trim(), password);
    } catch (err) {
      addToast((err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeyLogin = async () => {
    if (!username.trim()) {
      addToast('Enter your username first', 'error');
      return;
    }
    setPasskeyLoading(true);
    try {
      const options = await api.auth.passkey.getLoginOptions(username.trim().toLowerCase());
      const authResponse = await startAuthentication({ optionsJSON: options as any });
      const { token, username: user } = await api.auth.passkey.login(
        username.trim().toLowerCase(),
        authResponse
      );
      onPasskeyLogin(user, token);
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('cancel') || msg.includes('abort') || msg.includes('NotAllowedError')) {
        addToast('Passkey sign-in cancelled.', 'info');
      } else {
        addToast(msg || 'Passkey sign-in failed', 'error');
      }
    } finally {
      setPasskeyLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-brand-icon">
            <Rocket size={24} />
          </div>
          <div>
            <div className="login-brand-name">NexRev</div>
            <div className="login-brand-sub">Sign in to continue</div>
          </div>
        </div>
        <form onSubmit={submit}>
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
              disabled={loading || passkeyLoading}
              placeholder="Enter your username"
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={loading || passkeyLoading}
              placeholder="Enter your password"
            />
          </div>
          <button
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 16, padding: '12px 16px', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            type="submit"
            disabled={loading || passkeyLoading || !username.trim() || !password}
          >
            {loading ? <><span className="spinner" /> Signing in…</> : <><LogIn size={18} /> Sign in</>}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border-light)' }} />
          <span className="text-tertiary" style={{ fontSize: 12 }}>or</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border-light)' }} />
        </div>

        <button
          className="btn"
          style={{ width: '100%', padding: '12px 16px', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          type="button"
          onClick={handlePasskeyLogin}
          disabled={loading || passkeyLoading || !username.trim()}
        >
          {passkeyLoading
            ? <><span className="spinner" /> Waiting for passkey…</>
            : <><Fingerprint size={18} /> Sign in with Passkey</>}
        </button>

        <div style={{ marginTop: 24, textAlign: 'center', borderTop: '1px solid var(--border-light)', paddingTop: 16 }}>
          <p className="text-tertiary" style={{ fontSize: 11, margin: 0 }}>
            NexRev System &bull; Version {version || 'Loading...'}
          </p>
        </div>
      </div>
    </div>
  );
}
