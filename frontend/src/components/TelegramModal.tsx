import React, { useState } from 'react';
import { api } from '../api';

interface Props {
  onClose: () => void;
}

export default function TelegramModal({ onClose }: Props) {
  const [chatId, setChatId] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    try {
      await api.auth.updateTelegram(chatId.trim() || null);
      setMessage('Telegram settings updated successfully!');
      setTimeout(onClose, 1500);
    } catch (err) {
      setMessage('Failed to update Telegram settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal" style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <span className="modal-title">Telegram Notifications</span>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="form-group" style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 15 }}>
            To receive daily reminders at 8:30 AM, please enter your Telegram Chat ID below.
          </p>
          <label>Telegram Chat ID</label>
          <input 
            type="text" 
            value={chatId} 
            placeholder="e.g. 123456789" 
            onChange={e => setChatId(e.target.value)} 
            autoFocus 
          />
          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8 }}>
            Tip: Message <strong>@userinfobot</strong> on Telegram to find your Chat ID.
          </p>
        </div>

        {message && (
          <div style={{ 
            padding: '8px 12px', 
            borderRadius: 4, 
            background: message.includes('Failed') ? 'var(--red-light)' : 'var(--green-light)',
            color: message.includes('Failed') ? 'var(--red-text)' : 'var(--green-text)',
            fontSize: 13,
            marginBottom: 15
          }}>
            {message}
          </div>
        )}

        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
