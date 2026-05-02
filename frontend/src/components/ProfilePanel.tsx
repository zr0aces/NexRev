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
  BookOpen
} from 'lucide-react';
import { api } from '../api';
import { useToast } from '../context/ToastContext';

export default function ProfilePanel() {
  const { addToast } = useToast();
  const [username, setUsername] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [linking, setLinking] = useState(false);
  const [version, setVersion] = useState('');
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

    api.auth.getHealth().then(data => {
      setVersion(data.version);
    }).catch(() => {});
  }, []);

  const handleSaveTelegram = async () => {
    setSaving(true);
    try {
      await api.auth.updateTelegram(telegramChatId.trim() || null);
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
      pollIntervalRef.current = setInterval(async () => {
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

  if (loading) return (
    <div className="empty-state" style={{ paddingTop: '4rem' }}>
      <RefreshCw className="spinner" />
      <div>Loading profile…</div>
    </div>
  );

  return (
    <div className="profile-panel">
      <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        User Profile: {username}
      </div>

      <div className="profile-section">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Send size={18} /> Telegram Integration
        </h3>
        <p className="text-secondary" style={{ fontSize: 13, marginBottom: 15 }}>
          Receive daily reminders at 8:30 AM directly on Telegram.
        </p>
        <div className="form-group">
          <label>Telegram Chat ID</label>
          <div className="profile-actions-row">
            <input 
              type="text" 
              value={telegramChatId} 
              placeholder="e.g. 123456789" 
              onChange={e => setTelegramChatId(e.target.value)} 
              style={{ flex: 1 }}
            />
            <button className="btn" onClick={handleAutoLink} disabled={linking} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {linking ? <RefreshCw size={14} className="spinner" /> : <LinkIcon size={14} />}
              {linking ? 'Linking…' : 'Link Automatically'}
            </button>
            <button className="btn btn-primary" onClick={handleSaveTelegram} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {saving ? <RefreshCw size={14} className="spinner" /> : <Check size={14} />}
              Update Manually
            </button>
          </div>
          <p className="text-tertiary" style={{ fontSize: 11, marginTop: 8 }}>
            Click <strong>Link Automatically</strong> to connect via Telegram app, or enter your Chat ID manually.
          </p>
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
        <p className="text-tertiary" style={{ fontSize: 12 }}>
          NexRev System &bull; Version {version || 'Loading...'}
        </p>
      </div>
    </div>
  );
}
