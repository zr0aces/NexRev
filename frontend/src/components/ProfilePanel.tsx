import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Link as LinkIcon,
  Lock,
  RefreshCw,
  Check,
  Bell,
  Key,
  BookOpen,
  Fingerprint,
  Trash2,
  Plus,
  Shield,
  User as UserIcon,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { api } from '../api';
import { useToast } from '../context/ToastContext';
import AddPasskeyModal from './AddPasskeyModal';

interface Props {
  version: string;
  aiEnabled: boolean;
}

export default function ProfilePanel({ version, aiEnabled }: Props) {
  const { addToast } = useToast();
  const [username, setUsername] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [linking, setLinking] = useState(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  type PasskeyInfo = {
    id: string;
    name: string;
    createdAt: string;
    lastUsedAt: string | null;
    deviceType: string;
    backedUp: boolean;
  };
  const [passkeys, setPasskeys] = useState<PasskeyInfo[]>([]);
  const [showAddPasskeyModal, setShowAddPasskeyModal] = useState(false);

  // Password strength state
  const [pwStrength, setPwStrength] = useState<0 | 1 | 2 | 3>(0);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current !== null) clearInterval(pollIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    api.auth.getMe().then(data => {
      setUsername(data.username);
      setTelegramChatId(data.telegram_chat_id ?? '');
      setLoading(false);
    }).catch(() => setLoading(false));

    api.auth.passkey.listCredentials().then(setPasskeys).catch(() => {});
  }, []);

  // Password strength scorer
  useEffect(() => {
    if (!newPassword) { setPwStrength(0); return; }
    let score = 0;
    if (newPassword.length >= 8) score++;
    if (/[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword)) score++;
    if (/[0-9!@#$%^&*]/.test(newPassword)) score++;
    setPwStrength(score as 0 | 1 | 2 | 3);
  }, [newPassword]);

  const pwStrengthLabel = ['', 'Weak', 'Fair', 'Strong'];
  const pwStrengthColor = ['', 'var(--red-mid)', 'var(--amber-mid)', 'var(--green-mid)'];

  const handleSaveTelegram = async (id?: string) => {
    setSaving(true);
    const value = id !== undefined ? id : telegramChatId;
    try {
      await api.auth.updateTelegram(value.trim() || null);
      addToast('Telegram settings updated!', 'success');
    } catch {
      addToast('Failed to update Telegram settings.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAutoLink = async () => {
    setLinking(true);
    addToast('Generating link… Please check Telegram.', 'info');
    try {
      const { token, botName } = await api.auth.getTelegramLinkToken();
      if (!botName) {
        addToast('Telegram bot name not configured in backend.', 'error');
        setLinking(false);
        return;
      }
      window.open(`https://t.me/${botName}?start=${token}`, '_blank');
      let attempts = 0;
      pollIntervalRef.current = setInterval(() => {
        void (async () => {
          try {
            attempts++;
            if (attempts > 30) {
              clearInterval(pollIntervalRef.current!);
              pollIntervalRef.current = null;
              setLinking(false);
              addToast('Linking timed out. Please try again.', 'error');
              return;
            }
            const { chatId } = await api.auth.pollTelegramLink(token);
            if (chatId) {
              clearInterval(pollIntervalRef.current!);
              pollIntervalRef.current = null;
              setTelegramChatId(chatId);
              await api.auth.updateTelegram(chatId);
              setLinking(false);
              addToast('Telegram linked successfully!', 'success');
            }
          } catch {
            clearInterval(pollIntervalRef.current!);
            pollIntervalRef.current = null;
            setLinking(false);
            addToast('Linking failed. Please try again.', 'error');
          }
        })();
      }, 2000);
    } catch {
      setLinking(false);
      addToast('Failed to initiate linking.', 'error');
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword) { addToast('Please enter a new password.', 'error'); return; }
    if (newPassword.length < 8) { addToast('Password must be at least 8 characters.', 'error'); return; }
    if (newPassword !== confirmPassword) { addToast('Passwords do not match.', 'error'); return; }
    setSaving(true);
    try {
      await api.auth.updatePassword(newPassword);
      addToast('Password updated successfully!', 'success');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      addToast('Failed to update password.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePasskey = async (id: string) => {
    if (!confirm('Remove this passkey? You can always add it back later.')) return;
    try {
      await api.auth.passkey.deleteCredential(id);
      setPasskeys(prev => prev.filter(pk => pk.id !== id));
      addToast('Passkey removed.', 'success');
    } catch {
      addToast('Failed to remove passkey.', 'error');
    }
  };

  if (loading) return (
    <div className="empty-state" style={{ paddingTop: '4rem' }}>
      <RefreshCw className="spinner" />
      <div>Loading profile…</div>
    </div>
  );

  return (
    <div className="profile-panel">

      {/* ── Identity Card ─────────────────────────────────── */}
      <div className="profile-identity-card">
        <div className="profile-avatar-lg">
          {username.slice(0, 2).toUpperCase()}
        </div>
        <div className="profile-identity-info">
          <div className="profile-identity-name">{username.toUpperCase()}</div>
          <div className="profile-identity-meta">
            <span className={`profile-status-dot ${aiEnabled ? 'active' : 'inactive'}`} />
            <span>AI Service {aiEnabled ? 'Active' : 'Not Configured'}</span>
            <span className="profile-identity-sep">·</span>
            <span>v{version}</span>
          </div>
        </div>
      </div>

      {/* ── Two-column grid for the main sections ─────────── */}
      <div className="profile-grid">

        {/* LEFT COLUMN */}
        <div className="profile-col">

          {/* ── Telegram ── */}
          <section className="profile-section">
            <div className="profile-section-hd">
              <div className="profile-section-icon" style={{ background: 'rgba(37,212,191,0.1)', color: 'var(--teal)' }}>
                <Send size={16} />
              </div>
              <div>
                <div className="profile-section-title">Telegram Notifications</div>
                <div className="profile-section-sub">Daily digest at 8:30 AM on weekdays</div>
              </div>
              <div className={`profile-status-badge ${telegramChatId ? 'connected' : 'disconnected'}`}>
                <span className={`profile-status-dot ${telegramChatId ? 'active' : 'inactive'}`} />
                {telegramChatId ? 'Linked' : 'Not Linked'}
              </div>
            </div>

            {telegramChatId ? (
              <div className="profile-telegram-connected">
                <div className="profile-telegram-icon connected">
                  <Check size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>Connected</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                    ID: {telegramChatId.slice(0, 3)}•••{telegramChatId.slice(-3)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-sm" onClick={handleAutoLink} disabled={linking} title="Re-link">
                    {linking ? <RefreshCw size={13} className="spinner" /> : <RefreshCw size={13} />}
                    Re-link
                  </button>
                  <button
                    className="btn btn-sm"
                    onClick={() => { setTelegramChatId(''); handleSaveTelegram(''); }}
                    disabled={saving}
                    style={{ color: 'var(--text-error)', borderColor: 'rgba(248,81,73,0.3)' }}
                  >
                    Unlink
                  </button>
                </div>
              </div>
            ) : (
              <div className="profile-telegram-empty">
                <Bell size={20} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 2 }}>Not connected</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                    Get pipeline summaries and follow-up reminders.
                  </div>
                </div>
                <button className="btn btn-sm btn-primary" onClick={handleAutoLink} disabled={linking}>
                  {linking ? <RefreshCw size={13} className="spinner" /> : <LinkIcon size={13} />}
                  {linking ? 'Linking…' : 'Link'}
                </button>
              </div>
            )}
          </section>

          {/* ── Documentation ── */}
          <section className="profile-section">
            <div className="profile-section-hd">
              <div className="profile-section-icon" style={{ background: 'rgba(249,115,22,0.1)', color: 'var(--orange)' }}>
                <BookOpen size={16} />
              </div>
              <div>
                <div className="profile-section-title">Help & Documentation</div>
                <div className="profile-section-sub">Guides for pipeline and AI features</div>
              </div>
            </div>
            <div className="profile-doc-links">
              <a
                href="/docs/user_guide_en.html"
                target="_blank"
                rel="noopener noreferrer"
                className="profile-doc-link"
              >
                <BookOpen size={14} />
                <span>User Guide</span>
                <span className="profile-doc-lang">EN</span>
                <ExternalLink size={11} style={{ marginLeft: 'auto', opacity: 0.4 }} />
              </a>
              <a
                href="/docs/user_guide_th.html"
                target="_blank"
                rel="noopener noreferrer"
                className="profile-doc-link"
              >
                <BookOpen size={14} />
                <span>คู่มือการใช้งาน</span>
                <span className="profile-doc-lang">TH</span>
                <ExternalLink size={11} style={{ marginLeft: 'auto', opacity: 0.4 }} />
              </a>
            </div>
          </section>

        </div>

        {/* RIGHT COLUMN */}
        <div className="profile-col">

          {/* ── Password ── */}
          <section className="profile-section">
            <div className="profile-section-hd">
              <div className="profile-section-icon" style={{ background: 'rgba(139,92,246,0.1)', color: '#c4b5fd' }}>
                <Lock size={16} />
              </div>
              <div>
                <div className="profile-section-title">Change Password</div>
                <div className="profile-section-sub">Minimum 8 characters</div>
              </div>
            </div>

            <div className="profile-pw-fields">
              <div className="form-group" style={{ marginBottom: 10 }}>
                <label><Key size={11} /> New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  placeholder="••••••••"
                  onChange={e => setNewPassword(e.target.value)}
                />
                {newPassword && (
                  <div className="profile-pw-strength">
                    <div className="profile-pw-bars">
                      {[1, 2, 3].map(n => (
                        <div
                          key={n}
                          className="profile-pw-bar"
                          style={{ background: pwStrength >= n ? pwStrengthColor[pwStrength] : 'var(--border)' }}
                        />
                      ))}
                    </div>
                    <span style={{ fontSize: 11, color: pwStrengthColor[pwStrength] }}>
                      {pwStrengthLabel[pwStrength]}
                    </span>
                  </div>
                )}
              </div>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label><Check size={11} /> Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  placeholder="••••••••"
                  onChange={e => setConfirmPassword(e.target.value)}
                  style={confirmPassword && confirmPassword !== newPassword
                    ? { borderColor: 'var(--red-mid)' }
                    : confirmPassword && confirmPassword === newPassword
                      ? { borderColor: 'var(--green-mid)' }
                      : {}}
                />
                {confirmPassword && confirmPassword !== newPassword && (
                  <div style={{ fontSize: 11, color: 'var(--text-error)', marginTop: 4 }}>Passwords don't match</div>
                )}
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleUpdatePassword}
                disabled={saving || !newPassword || !confirmPassword}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {saving ? <RefreshCw size={13} className="spinner" /> : <Lock size={13} />}
                Update Password
              </button>
            </div>
          </section>

          {/* ── Passkeys ── */}
          <section className="profile-section">
            <div className="profile-section-hd">
              <div className="profile-section-icon" style={{ background: 'rgba(249,115,22,0.1)', color: 'var(--orange)' }}>
                <Fingerprint size={16} />
              </div>
              <div style={{ flex: 1 }}>
                <div className="profile-section-title">Passkeys</div>
                <div className="profile-section-sub">Biometric or PIN sign-in</div>
              </div>
              <button
                className="btn btn-sm"
                onClick={() => setShowAddPasskeyModal(true)}
                style={{ flexShrink: 0 }}
              >
                <Plus size={13} /> Add
              </button>
            </div>

            {passkeys.length === 0 ? (
              <div className="profile-passkey-empty">
                <Shield size={18} style={{ opacity: 0.4 }} />
                <span>No passkeys registered — add one for faster, passwordless sign-in.</span>
              </div>
            ) : (
              <div className="profile-passkey-list">
                {passkeys.map(pk => (
                  <div key={pk.id} className="profile-passkey-item">
                    <Fingerprint size={15} style={{ color: 'var(--orange)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pk.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
                        Added {new Date(pk.createdAt).toLocaleDateString()}
                        {pk.lastUsedAt && ` · Used ${new Date(pk.lastUsedAt).toLocaleDateString()}`}
                        {pk.backedUp && ' · Synced'}
                      </div>
                    </div>
                    <button
                      className="btn btn-sm"
                      onClick={() => handleDeletePasskey(pk.id)}
                      title="Remove passkey"
                      style={{ padding: '4px 8px', color: 'var(--text-error)', borderColor: 'rgba(248,81,73,0.25)', flexShrink: 0 }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

        </div>
      </div>

      {/* ── System footer ──────────────────────────────────── */}
      <div className="profile-footer">
        <div className="profile-footer-item">
          <Sparkles size={12} />
          <span>AI {aiEnabled ? 'Active' : 'Inactive'}</span>
        </div>
        <div className="profile-footer-sep" />
        <div className="profile-footer-item">
          <UserIcon size={12} />
          <span>{username.toUpperCase()}</span>
        </div>
        <div className="profile-footer-sep" />
        <div className="profile-footer-item">
          <span>NexRev {version}</span>
        </div>
      </div>

      {showAddPasskeyModal && (
        <AddPasskeyModal
          onClose={() => setShowAddPasskeyModal(false)}
          onAdded={(passkey) => {
            setPasskeys(prev => [...prev, passkey]);
            addToast('Passkey registered successfully!', 'success');
          }}
        />
      )}
    </div>
  );
}
