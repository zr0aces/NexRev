import React, { useState, useEffect, useRef } from 'react';
import { X, Fingerprint, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { startRegistration } from '@simplewebauthn/browser';
import { api } from '../api';

type Step = 'name' | 'waiting' | 'success' | 'error';

interface PasskeyInfo {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
  deviceType: string;
  backedUp: boolean;
}

interface Props {
  onClose: () => void;
  onAdded: (passkey: PasskeyInfo) => void;
}

export default function AddPasskeyModal({ onClose, onAdded }: Props) {
  const [step, setStep] = useState<Step>('name');
  const [passkeyName, setPasskeyName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the name input when the modal opens
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on Escape only when on the name step
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && step === 'name') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [step, onClose]);

  const handleRegister = async () => {
    setStep('waiting');
    setErrorMsg('');
    try {
      const options = await api.auth.passkey.getRegisterOptions();
      const regResponse = await startRegistration({ optionsJSON: options as any });
      const passkey = await api.auth.passkey.register(regResponse, passkeyName.trim() || 'Passkey');
      onAdded(passkey);
      setStep('success');
    } catch (err) {
      const msg = (err as Error).message ?? '';
      if (
        msg.includes('cancel') ||
        msg.includes('abort') ||
        msg.toLowerCase().includes('notallowederror')
      ) {
        setErrorMsg('Registration was cancelled. You can try again.');
      } else {
        setErrorMsg(msg || 'Something went wrong. Please try again.');
      }
      setStep('error');
    }
  };

  const handleRetry = () => {
    setStep('name');
    setErrorMsg('');
  };

  return (
    <div
      className="modal-overlay"
      onClick={e => { if (e.target === e.currentTarget && step === 'name') onClose(); }}
    >
      <div className="modal" style={{ width: 440 }}>
        {/* ── Header ── */}
        <div className="modal-header">
          <span className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Fingerprint size={18} style={{ color: 'var(--orange)' }} />
            Add Passkey
          </span>
          {step !== 'waiting' && (
            <button className="modal-close" onClick={onClose} aria-label="Close">
              <X size={20} />
            </button>
          )}
        </div>

        {/* ── Step: Name ── */}
        {step === 'name' && (
          <div>
            <p className="text-secondary" style={{ fontSize: 13, marginBottom: 20 }}>
              A passkey lets you sign in with biometrics or a device PIN — no password needed.
              Give this passkey a recognizable name so you can manage it later.
            </p>
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label htmlFor="passkey-name">Passkey name</label>
              <input
                id="passkey-name"
                ref={inputRef}
                type="text"
                value={passkeyName}
                onChange={e => setPasskeyName(e.target.value)}
                placeholder="e.g. MacBook Touch ID, iPhone Face ID"
                onKeyDown={e => { if (e.key === 'Enter') handleRegister(); }}
                maxLength={80}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={onClose}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleRegister}
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <Fingerprint size={15} />
                Continue
              </button>
            </div>
          </div>
        )}

        {/* ── Step: Waiting for authenticator ── */}
        {step === 'waiting' && (
          <div style={{ textAlign: 'center', padding: '12px 0 8px' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'var(--orange-light)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <Fingerprint size={32} style={{ color: 'var(--orange)' }} />
            </div>
            <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
              Follow the prompt on your device
            </p>
            <p className="text-secondary" style={{ fontSize: 13, marginBottom: 24 }}>
              Use your fingerprint, face, or device PIN to register the passkey.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text-tertiary)', fontSize: 13 }}>
              <RefreshCw size={14} className="spinner" />
              Waiting for authenticator…
            </div>
          </div>
        )}

        {/* ── Step: Success ── */}
        {step === 'success' && (
          <div style={{ textAlign: 'center', padding: '12px 0 8px' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'var(--bg-success)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
              color: 'var(--text-success)',
            }}>
              <CheckCircle size={32} />
            </div>
            <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
              Passkey registered!
            </p>
            <p className="text-secondary" style={{ fontSize: 13, marginBottom: 24 }}>
              {passkeyName.trim() ? `"${passkeyName.trim()}"` : 'Your passkey'} is ready. You can now use it to sign in.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        )}

        {/* ── Step: Error ── */}
        {step === 'error' && (
          <div style={{ textAlign: 'center', padding: '12px 0 8px' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'var(--bg-error)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
              color: 'var(--text-error)',
            }}>
              <AlertCircle size={32} />
            </div>
            <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
              Registration failed
            </p>
            <p className="text-secondary" style={{ fontSize: 13, marginBottom: 24 }}>
              {errorMsg}
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button className="btn" onClick={onClose}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleRetry}
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <RefreshCw size={14} />
                Try again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
