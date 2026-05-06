import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Link as LinkIcon, 
  Lock, 
  RefreshCw, 
  Check, 
  AlertCircle,
  Bell,
  Key,
  BookOpen,
  Fingerprint,
  Trash2,
  Plus
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

  const handleSaveTelegram = async (id?: string) => {
    setSaving(true);
    const value = id !== undefined ? id : telegramChatId;
    try {
      await api.auth.updateTelegram(value.trim() || null);
      addToast('Telegram settings updated!', 'success');
    } catch (err) {
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

      // Open Telegram deep link
      window.open(`https://t.me/${botName}?start=${token}`, '_blank');

      // Start polling
      let attempts = 0;
      pollIntervalRef.current = setInterval(() => {
        void (async () => {
          try {
            attempts++;
            if (attempts > 30) { // 30s timeout
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
    } catch (err) {
      setLinking(false);
      addToast('Failed to initiate linking.', 'error');
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword) {
      addToast('Please enter a new password.', 'error');
      return;
    }
    if (newPassword.length < 8) {
      addToast('Password must be at least 8 characters.', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      addToast('Passwords do not match.', 'error');
      return;
    }
    setSaving(true);
    try {
      await api.auth.updatePassword(newPassword);
      addToast('Password updated successfully!', 'success');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      addToast('Failed to update password.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePasskey = async (id: string) => {
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
      <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        User Profile: {username.toUpperCase()}
      </div>

      <div className="profile-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 }}>
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
              <Send size={18} /> Telegram Notifications
            </h3>
            <p className="text-secondary" style={{ fontSize: 13, marginTop: 4 }}>
              Receive AI-powered daily digests at 8:30 AM.
            </p>
          </div>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 6, 
            padding: '4px 10px', 
            borderRadius: '20px', 
            fontSize: '12px', 
            fontWeight: 600,
            background: telegramChatId ? 'var(--bg-success)' : 'var(--bg-error)',
            color: telegramChatId ? 'var(--text-success)' : 'var(--text-error)',
            border: `1px solid ${telegramChatId ? 'var(--text-success)' : 'var(--text-error)'}22`
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
            {telegramChatId ? 'Linked' : 'Not Linked'}
          </div>
        </div>

        <div style={{ 
          background: 'var(--bg-secondary)', 
          border: '1px solid var(--border)', 
          borderRadius: '12px', 
          padding: '20px',
          textAlign: 'center'
        }}>
          {telegramChatId ? (
            <div>
              <div style={{ 
                width: 48, 
                height: 48, 
                borderRadius: '50%', 
                background: 'var(--bg-success)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                margin: '0 auto 12px',
                color: 'var(--text-success)'
              }}>
                <Check size={24} />
              </div>
              <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Connected to Telegram</p>
              <p className="text-tertiary" style={{ fontSize: 12, marginBottom: 20 }}>
                ID: {telegramChatId.slice(0, 4)}••••{telegramChatId.slice(-4)}
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button 
                  className="btn" 
                  onClick={handleAutoLink} 
                  disabled={linking}
                  style={{ fontSize: 13, padding: '8px 16px' }}
                >
                  {linking ? <RefreshCw size={14} className="spinner" /> : <RefreshCw size={14} />}
                  Re-link Account
                </button>
                <button 
                  className="btn btn-danger" 
                  onClick={() => {
                    setTelegramChatId('');
                    handleSaveTelegram('');
                  }}
                  disabled={saving}
                  style={{ fontSize: 13, padding: '8px 16px', color: 'var(--text-error)', border: '1px solid var(--bg-error)', background: 'transparent' }}
                >
                  Unlink
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ 
                width: 48, 
                height: 48, 
                borderRadius: '50%', 
                background: 'var(--bg-secondary)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                margin: '0 auto 12px',
                color: 'var(--text-tertiary)'
              }}>
                <Bell size={24} />
              </div>
              <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Never miss an update</p>
              <p className="text-tertiary" style={{ fontSize: 12, marginBottom: 20 }}>
                Link your Telegram to get daily pipeline summaries and action reminders.
              </p>
              <button 
                className="btn btn-primary" 
                onClick={handleAutoLink} 
                disabled={linking}
                style={{ fontSize: 14, padding: '10px 24px', borderRadius: '8px' }}
              >
                {linking ? <RefreshCw size={14} className="spinner" /> : <LinkIcon size={14} />}
                {linking ? 'Linking…' : 'Link Telegram Account'}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="profile-section" style={{ marginTop: 30 }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Lock size={18} /> Security
        </h3>
        <p className="text-secondary" style={{ fontSize: 13, marginBottom: 15 }}>
          Update your account password.
        </p>
        <div className="form-row">
          <div className="form-group">
            <label><Key size={12} /> New Password</label>
            <input 
              type="password" 
              value={newPassword} 
              placeholder="••••••••" 
              onChange={e => setNewPassword(e.target.value)} 
            />
          </div>
          <div className="form-group">
            <label><Check size={12} /> Confirm Password</label>
            <input 
              type="password" 
              value={confirmPassword} 
              placeholder="••••••••" 
              onChange={e => setConfirmPassword(e.target.value)} 
            />
          </div>
        </div>
        <button className="btn btn-primary" onClick={handleUpdatePassword} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {saving ? <RefreshCw size={14} className="spinner" /> : <Lock size={14} />}
          Update Password
        </button>
      </div>

      <div className="profile-section" style={{ marginTop: 30 }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Fingerprint size={18} /> Passkeys
        </h3>
        <p className="text-secondary" style={{ fontSize: 13, marginBottom: 15 }}>
          Sign in with biometrics or a device PIN — no password required.
        </p>

        {passkeys.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            {passkeys.map(pk => (
              <div key={pk.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)',
                background: 'var(--bg-secondary)', marginBottom: 8
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Fingerprint size={16} style={{ color: 'var(--orange)' }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{pk.name}</div>
                    <div className="text-tertiary" style={{ fontSize: 11 }}>
                      Added {new Date(pk.createdAt).toLocaleDateString()}
                      {pk.lastUsedAt && ` · Last used ${new Date(pk.lastUsedAt).toLocaleDateString()}`}
                      {pk.backedUp && ' · Synced'}
                    </div>
                  </div>
                </div>
                <button
                  className="btn"
                  onClick={() => handleDeletePasskey(pk.id)}
                  title="Remove passkey"
                  style={{ padding: '6px 10px', color: 'var(--text-error)', border: '1px solid var(--bg-error)', background: 'transparent' }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            className="btn btn-primary"
            onClick={() => setShowAddPasskeyModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <Plus size={14} />
            Add Passkey
          </button>
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

      <div className="profile-section" style={{ marginTop: 30 }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BookOpen size={18} /> Help & Documentation
        </h3>
        <p className="text-secondary" style={{ fontSize: 13, marginBottom: 15 }}>
          Learn how to master your pipeline and use AI tools effectively.
        </p>
        <div className="profile-actions-row" style={{ gap: 12 }}>
          <a href="/docs/user_guide_en.html" target="_blank" rel="noopener noreferrer" className="btn" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'var(--text-secondary)' }}>
            <BookOpen size={14} /> User Guide (English)
          </a>
          <a href="/docs/user_guide_th.html" target="_blank" rel="noopener noreferrer" className="btn" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'var(--text-secondary)' }}>
            <BookOpen size={14} /> คู่มือการใช้งาน (Thai)
          </a>
        </div>
      </div>

      <div className="profile-section" style={{ marginTop: 30, textAlign: 'center', background: 'transparent', border: 'none', padding: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-tertiary)' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: aiEnabled ? 'var(--text-success)' : 'var(--text-error)' }} />
            AI Service: {aiEnabled ? 'Active' : 'Not Configured (Ollama)'}
          </div>
        </div>
        <p className="text-tertiary" style={{ fontSize: 12 }}>
          NexRev System &bull; Version {version || 'Loading...'}
        </p>
      </div>
    </div>
  );
}
