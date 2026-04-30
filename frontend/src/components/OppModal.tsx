import React, { useState, useEffect } from 'react';
import type { Opportunity, Stage } from '../types';
import { STAGES } from '../types';
import { api } from '../api';

interface Props {
  opps: Opportunity[];
  editOpp?: Opportunity;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onSelectExisting: (id: string) => void;
}

interface FormData {
  name: string;
  contact: string;
  contactEmail: string;
  contactMobile: string;
  contactTitle: string;
  value: string;
  stage: Stage;
  close: string;
  followup: string;
  nextStep: string;
  notes: string;
}

const empty: FormData = {
  name: '', contact: '', contactEmail: '', contactMobile: '', contactTitle: '',
  value: '', stage: 'Prospecting', close: '', followup: '', nextStep: '', notes: '',
};

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function OppModal({ opps, editOpp, onClose, onSaved, onSelectExisting }: Props) {
  const [form, setForm] = useState<FormData>(empty);
  const [saving, setSaving] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (editOpp) {
      setForm({
        name: editOpp.name,
        contact: editOpp.contact ?? '',
        contactEmail: editOpp.contactEmail ?? '',
        contactMobile: editOpp.contactMobile ?? '',
        contactTitle: editOpp.contactTitle ?? '',
        value: editOpp.value != null ? String(editOpp.value) : '',
        stage: editOpp.stage,
        close: editOpp.close ?? '',
        followup: editOpp.followup ?? '',
        nextStep: editOpp.nextStep ?? '',
        notes: editOpp.notes ?? '',
      });
    }
  }, [editOpp]);

  const set = (field: keyof FormData, value: string) =>
    setForm(f => ({ ...f, [field]: value }));

  const save = async () => {
    if (!form.name.trim()) { alert('Account name is required'); return; }
    
    // Check for duplicates if adding a new opportunity
    if (!editOpp && opps.some(o => o.name.toLowerCase() === form.name.trim().toLowerCase())) {
      alert(`An opportunity for "${form.name.trim()}" already exists. Each client can only have one opportunity.`);
      return;
    }

    if (!form.contactEmail.trim()) { alert('Contact email is required'); return; }
    if (!isValidEmail(form.contactEmail.trim())) { alert('Please enter a valid email address'); return; }
    if (!form.contactMobile.trim()) { alert('Contact mobile number is required'); return; }
    if (!form.contactTitle.trim()) { alert('Contact title / job title is required'); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        contact: form.contact.trim(),
        contactEmail: form.contactEmail.trim(),
        contactMobile: form.contactMobile.trim(),
        contactTitle: form.contactTitle.trim(),
        value: form.value ? Number(form.value) : null,
        stage: form.stage,
        close: form.close,
        followup: form.followup,
        nextStep: form.nextStep.trim(),
        notes: form.notes.trim(),
      };
      if (editOpp) {
        await api.opportunities.update(editOpp.id, payload);
      } else {
        await api.opportunities.create(payload);
      }
      await onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{editOpp ? 'Edit opportunity' : 'Add opportunity'}</span>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="form-row">
          <div className="form-group" style={{ position: 'relative' }}>
            <label>Account name *</label>
            <input 
              type="text" 
              value={form.name} 
              placeholder="Acme Corp" 
              onChange={e => {
                set('name', e.target.value);
                setShowSuggestions(true);
              }} 
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              autoFocus 
            />
            {showSuggestions && form.name.trim().length > 0 && (
              <div className="dropdown-list">
                {Array.from(new Set(opps.map(o => o.name)))
                  .filter(name => name.toLowerCase().includes(form.name.toLowerCase()))
                  .slice(0, 5)
                  .map(name => {
                    const existing = opps.find(o => o.name === name);
                    return (
                      <div 
                        key={name} 
                        className="dropdown-item" 
                        onClick={() => {
                          if (existing) onSelectExisting(existing.id);
                        }}
                      >
                        {name} (Go to Pipeline)
                      </div>
                    );
                  })
                }
              </div>
            )}
          </div>
          <div className="form-group">
            <label>Contact name</label>
            <input type="text" value={form.contact} placeholder="Jane Smith" onChange={e => set('contact', e.target.value)} />
          </div>
        </div>

        <div className="form-group">
          <label>Contact email *</label>
          <input type="email" value={form.contactEmail} placeholder="jane.smith@acme.com" onChange={e => set('contactEmail', e.target.value)} />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Contact mobile *</label>
            <input type="tel" value={form.contactMobile} placeholder="+1 555 000 0000" onChange={e => set('contactMobile', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Contact title / job title *</label>
            <input type="text" value={form.contactTitle} placeholder="VP of Engineering" onChange={e => set('contactTitle', e.target.value)} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Deal value (USD)</label>
            <input type="number" value={form.value} placeholder="50000" onChange={e => set('value', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Stage</label>
            <select value={form.stage} onChange={e => set('stage', e.target.value as Stage)}>
              {STAGES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Close date</label>
            <input type="date" value={form.close} onChange={e => set('close', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Next follow-up date</label>
            <input type="date" value={form.followup} onChange={e => set('followup', e.target.value)} />
          </div>
        </div>

        <div className="form-group">
          <label>Next step</label>
          <input type="text" value={form.nextStep} placeholder="e.g. Send proposal draft by Friday" onChange={e => set('nextStep', e.target.value)} />
        </div>

        <div className="form-group">
          <label>Initial notes</label>
          <textarea value={form.notes} placeholder="Context, background, key contacts…" onChange={e => set('notes', e.target.value)} />
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
