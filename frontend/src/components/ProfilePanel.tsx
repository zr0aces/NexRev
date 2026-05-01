import React, { useState, useEffect } from 'react';
import { api } from '../api';

export default function ProfilePanel() {
  const [username, setUsername] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [linking, setLinking] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    api.auth.getMe().then(data => {
      setUsername(data.username);
      setTelegramChatId(data.telegram_chat_id ?? '');
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleSaveTelegram = async () => {
    setSaving(true);
    try {
      await api.auth.updateTelegram(telegramChatId.trim() || null);
      setMessage({ text: 'Telegram settings updated!', type: 'success' });
    } catch (err) {
      setMessage({ text: 'Failed to update Telegram settings.', type: 'error' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleAutoLink = async () => {
    setLinking(true);
    setMessage({ text: 'Generating link… Please check Telegram.', type: 'success' });
    try {
      const { token, botName } = await api.auth.getTelegramLinkToken();
      if (!botName) {
        setMessage({ text: 'Telegram bot name not configured in backend.', type: 'error' });
        setLinking(false);
        return;
      }

      // Open Telegram deep link
      window.open(`https://t.me/${botName}?start=${token}`, '_blank');

      // Start polling
      let attempts = 0;
      const interval = setInterval(async () => {
        attempts++;
        if (attempts > 30) { // 30s timeout
          clearInterval(interval);
          setLinking(false);
          setMessage({ text: 'Linking timed out. Please try again.', type: 'error' });
          return;
        }

        const { chatId } = await api.auth.pollTelegramLink(token);
        if (chatId) {
          clearInterval(interval);
          setTelegramChatId(chatId);
          await api.auth.updateTelegram(chatId);
          setLinking(false);
          setMessage({ text: 'Telegram linked successfully!', type: 'success' });
          setTimeout(() => setMessage(null), 3000);
        }
      }, 2000);
    } catch (err) {
      setLinking(false);
      setMessage({ text: 'Failed to initiate linking.', type: 'error' });
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword) {
      setMessage({ text: 'Please enter a new password.', type: 'error' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ text: 'Passwords do not match.', type: 'error' });
      return;
    }
    setSaving(true);
    try {
      await api.auth.updatePassword(newPassword);
      setMessage({ text: 'Password updated successfully!', type: 'success' });
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setMessage({ text: 'Failed to update password.', type: 'error' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  if (loading) return <div className="empty-state">Loading profile…</div>;

  return (
    <div className="profile-panel">
      <div className="section-label">User Profile: {username}</div>

      <div className="profile-section">
        <h3>Telegram Integration</h3>
        <p className="text-secondary" style={{ fontSize: 13, marginBottom: 15 }}>
          Receive daily reminders at 8:30 AM directly on Telegram.
        </p>
        <div className="form-group">
          <label>Telegram Chat ID</label>
          <div style={{ display: 'flex', gap: 10 }}>
            <input 
              type="text" 
              value={telegramChatId} 
              placeholder="e.g. 123456789" 
              onChange={e => setTelegramChatId(e.target.value)} 
              style={{ flex: 1 }}
            />
            <button className="btn" onClick={handleAutoLink} disabled={linking}>
              {linking ? 'Linking…' : '🔗 Link Automatically'}
            </button>
            <button className="btn btn-primary" onClick={handleSaveTelegram} disabled={saving}>
              Update Manually
            </button>
          </div>
          <p className="text-tertiary" style={{ fontSize: 11, marginTop: 8 }}>
            Click <strong>Link Automatically</strong> to connect via Telegram app, or enter your Chat ID manually.
          </p>
        </div>
      </div>

      <div className="profile-section" style={{ marginTop: 30 }}>
        <h3>Security</h3>
        <p className="text-secondary" style={{ fontSize: 13, marginBottom: 15 }}>
          Update your account password.
        </p>
        <div className="form-row">
          <div className="form-group">
            <label>New Password</label>
            <input 
              type="password" 
              value={newPassword} 
              placeholder="••••••••" 
              onChange={e => setNewPassword(e.target.value)} 
            />
          </div>
          <div className="form-group">
            <label>Confirm Password</label>
            <input 
              type="password" 
              value={confirmPassword} 
              placeholder="••••••••" 
              onChange={e => setConfirmPassword(e.target.value)} 
            />
          </div>
        </div>
        <button className="btn btn-primary" onClick={handleUpdatePassword} disabled={saving}>
          Update Password
        </button>
      </div>

      {message && (
        <div className={`message-toast message-toast--${message.type}`}>
          {message.text}
        </div>
      )}
    </div>
  );
}
