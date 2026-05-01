import React, { useState } from 'react';
import { Rocket, LogIn } from 'lucide-react';

interface Props {
  onLogin: (username: string, password: string) => Promise<void>;
}

export default function LoginPage({ onLogin }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    setError(null);
    try {
      await onLogin(username.trim(), password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
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
              disabled={loading}
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
              disabled={loading}
              placeholder="Enter your password"
            />
          </div>
          {error && <div className="login-error">{error}</div>}
          <button
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 16, padding: '12px 16px', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            type="submit"
            disabled={loading || !username.trim() || !password}
          >
            {loading ? <><span className="spinner" /> Signing in…</> : <><LogIn size={18} /> Sign in</>}
          </button>
        </form>
      </div>
    </div>
  );
}
