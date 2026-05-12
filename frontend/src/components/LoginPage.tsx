import React, { useState, useEffect } from 'react';
import { Rocket, LogIn, Fingerprint, ArrowRight, Key } from 'lucide-react';
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
  const [rememberMe, setRememberMe] = useState(false);
  const [step, setStep] = useState<'username' | 'auth'>('username');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);

  // Focus username on load and check for remembered user
  useEffect(() => {
    const remembered = localStorage.getItem('nexrev_remembered_user');
    if (remembered) {
      setUsername(remembered);
      setRememberMe(true);
    }
    const input = document.getElementById('login-username');
    if (input) input.focus();
  }, []);

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      if (rememberMe) {
        localStorage.setItem('nexrev_remembered_user', username.trim().toLowerCase());
      } else {
        localStorage.removeItem('nexrev_remembered_user');
      }
      setStep('auth');
    }
  };

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    try {
      await onLogin(username.trim().toLowerCase(), password);
    } catch (err) {
      addToast((err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeyLogin = async () => {
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
        // Automatically show password as backup on failure
        setShowPassword(true);
      }
    } finally {
      setPasskeyLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card animate-entry" style={{ position: 'relative', overflow: 'hidden' }}>
        {/* Subtle background glow */}
        <div style={{ position: 'absolute', top: -100, right: -100, width: 200, height: 200, background: 'var(--orange-light)', filter: 'blur(60px)', borderRadius: '50%', pointerEvents: 'none' }} />
        
        <div className="login-brand">
          <div className="login-brand-icon">
            <Rocket size={20} />
          </div>
          <div>
            <div className="login-brand-name">NexRev</div>
            <div className="login-brand-sub">Platform Intelligence</div>
          </div>
        </div>

        {step === 'username' ? (
          <form onSubmit={handleContinue} className="animate-entry">
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                Account Identifier
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="login-username"
                  type="text"
                  className="search-bar"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  autoComplete="username webauthn"
                  placeholder="e.g. jdoe"
                  style={{ paddingRight: 40, height: 48 }}
                />
                <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}>
                  <ArrowRight size={18} />
                </div>
              </div>
            </div>

            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                id="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                style={{ cursor: 'pointer', width: 16, height: 16, accentColor: 'var(--orange)' }}
              />
              <label htmlFor="remember-me" style={{ fontSize: 13, color: 'var(--text-tertiary)', cursor: 'pointer', userSelect: 'none' }}>
                Remember my username
              </label>
            </div>

            <button
              className="btn btn-primary"
              style={{ width: '100%', marginTop: 24, height: 48, justifyContent: 'center' }}
              type="submit"
              disabled={!username.trim()}
            >
              Continue <ArrowRight size={16} />
            </button>
          </form>
        ) : (
          <div className="animate-entry">
            <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
              <button 
                onClick={() => { setStep('username'); setShowPassword(false); }}
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <ArrowRight size={14} style={{ transform: 'rotate(180deg)' }} />
              </button>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{username}</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Choose your sign-in method</div>
              </div>
            </div>

            {!showPassword ? (
              <div className="animate-entry">
                <button
                  className="btn btn-primary"
                  style={{ width: '100%', height: 56, justifyContent: 'center', fontSize: 15 }}
                  onClick={handlePasskeyLogin}
                  disabled={passkeyLoading}
                >
                  {passkeyLoading ? (
                    <><span className="spinner" /> Verification...</>
                  ) : (
                    <><Fingerprint size={20} /> Sign in with Passkey</>
                  )}
                </button>
                
                <button
                  className="btn btn-ghost"
                  style={{ width: '100%', marginTop: 12, height: 48, justifyContent: 'center', fontSize: 13 }}
                  onClick={() => setShowPassword(true)}
                >
                  <Key size={16} /> Use password instead
                </button>
              </div>
            ) : (
              <form onSubmit={submitPassword} className="animate-entry">
                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Password
                  </label>
                  <input
                    type="password"
                    className="search-bar"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete="current-password"
                    autoFocus
                    placeholder="••••••••"
                    style={{ height: 48 }}
                    disabled={loading}
                  />
                </div>
                <button
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: 16, height: 48, justifyContent: 'center' }}
                  type="submit"
                  disabled={loading || !password}
                >
                  {loading ? <><span className="spinner" /> Signing in…</> : <><LogIn size={18} /> Sign in</>}
                </button>
                <button
                  className="btn btn-ghost"
                  style={{ width: '100%', marginTop: 12, height: 40, justifyContent: 'center', fontSize: 12 }}
                  onClick={() => setShowPassword(false)}
                  type="button"
                >
                  Back to Passkey
                </button>
              </form>
            )}
          </div>
        )}

        <div style={{ marginTop: 40, textAlign: 'center', borderTop: '1px solid var(--border)', paddingTop: 20 }}>
          <p style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
            NexRev &bull; v{version || '2.0'}
          </p>
        </div>
      </div>
    </div>
  );
}
