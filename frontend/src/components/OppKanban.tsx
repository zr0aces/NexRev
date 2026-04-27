import React, { useState, useRef } from 'react';
import type { KanbanColumn, Opportunity } from '../types';
import { api } from '../api';

interface Props {
  opp: Opportunity;
  onUpdate: (opp: Opportunity) => void;
}

const COLUMNS: { key: KanbanColumn; label: string }[] = [
  { key: 'todo',     label: 'To Do'       },
  { key: 'followup', label: 'Follow-ups'  },
  { key: 'done',     label: 'Done'        },
];

export default function OppKanban({ opp, onUpdate }: Props) {
  const [draggedIdx, setDraggedIdx]   = useState<number | null>(null);
  const [dragOver,   setDragOver]     = useState<KanbanColumn | null>(null);
  const [addingTo,   setAddingTo]     = useState<KanbanColumn | null>(null);
  const [addText,    setAddText]      = useState('');
  const [busy,       setBusy]         = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);

  /* ── drag helpers ─────────────────────────────────────── */
  const onDragStart = (e: React.DragEvent, idx: number) => {
    setDraggedIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(idx));
  };

  const onDragEnd = () => {
    setDraggedIdx(null);
    setDragOver(null);
  };

  const onColDragEnter = (e: React.DragEvent, col: KanbanColumn) => {
    e.preventDefault();
    setDragOver(col);
  };

  const onColDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const onColDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null);
  };

  const onDrop = async (e: React.DragEvent, targetCol: KanbanColumn) => {
    e.preventDefault();
    setDragOver(null);
    const idx = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (isNaN(idx)) return;
    const step = opp.nextSteps[idx];
    if (!step || step.column === targetCol) return;
    setBusy(true);
    try {
      const updated = await api.steps.update(opp.id, idx, { column: targetCol });
      onUpdate(updated);
    } finally {
      setBusy(false);
      setDraggedIdx(null);
    }
  };

  /* ── inline add ───────────────────────────────────────── */
  const startAdding = (col: KanbanColumn) => {
    setAddingTo(col);
    setAddText('');
    setTimeout(() => addInputRef.current?.focus(), 0);
  };

  const cancelAdding = () => {
    setAddingTo(null);
    setAddText('');
  };

  const commitAdd = async (col: KanbanColumn) => {
    const text = addText.trim();
    if (!text) { cancelAdding(); return; }
    setBusy(true);
    try {
      const updated = await api.steps.add(opp.id, text, col);
      onUpdate(updated);
      setAddText('');
      // Keep the same column open for rapid entry
    } finally {
      setBusy(false);
      setTimeout(() => addInputRef.current?.focus(), 0);
    }
  };

  const removeStep = async (idx: number) => {
    setBusy(true);
    try {
      const updated = await api.steps.remove(opp.id, idx);
      onUpdate(updated);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`opp-kanban${busy ? ' opp-kanban--busy' : ''}`}>
      {COLUMNS.map(col => {
        const steps = opp.nextSteps
          .map((s, i) => ({ ...s, _i: i }))
          .filter(s => (s.column ?? 'todo') === col.key);

        const isOver = dragOver === col.key;

        return (
          <div
            key={col.key}
            className={`opp-kanban-col opp-kanban-col--${col.key}${isOver ? ' drag-over' : ''}`}
            onDragEnter={e => onColDragEnter(e, col.key)}
            onDragOver={onColDragOver}
            onDragLeave={onColDragLeave}
            onDrop={e => onDrop(e, col.key)}
          >
            {/* column header */}
            <div className="opp-kanban-col-hd">
              <span className="opp-kanban-col-title">{col.label}</span>
              <span className="opp-kanban-col-count">{steps.length}</span>
            </div>

            {/* cards */}
            <div className="opp-kanban-cards">
              {steps.map(step => (
                <div
                  key={step._i}
                  className={`opp-kanban-card${draggedIdx === step._i ? ' dragging' : ''}`}
                  draggable
                  onDragStart={e => onDragStart(e, step._i)}
                  onDragEnd={onDragEnd}
                >
                  <span className="opp-kanban-card-drag" title="Drag to move">⠿</span>
                  <span className="opp-kanban-card-text">{step.text}</span>
                  <button
                    className="rm-btn"
                    onClick={() => removeStep(step._i)}
                    title="Remove"
                  >&times;</button>
                </div>
              ))}

              {/* drop hint when dragging over an empty column */}
              {isOver && steps.length === 0 && (
                <div className="opp-kanban-drop-hint">Drop here</div>
              )}
            </div>

            {/* inline add */}
            <div className="opp-kanban-add">
              {addingTo === col.key ? (
                <div className="opp-kanban-add-form">
                  <input
                    ref={addInputRef}
                    type="text"
                    value={addText}
                    placeholder="New item…"
                    onChange={e => setAddText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter')  { e.preventDefault(); commitAdd(col.key); }
                      if (e.key === 'Escape') cancelAdding();
                    }}
                  />
                  <div className="opp-kanban-add-actions">
                    <button
                      className="btn btn-xs btn-primary"
                      onClick={() => commitAdd(col.key)}
                      disabled={!addText.trim()}
                    >Add</button>
                    <button className="btn btn-xs" onClick={cancelAdding}>✕</button>
                  </div>
                </div>
              ) : (
                <button className="opp-kanban-add-btn" onClick={() => startAdding(col.key)}>
                  + Add item
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
