import React, { useState, useEffect, useCallback } from 'react';
import { api, getToken, setToken, clearToken, setUnauthorizedHandler } from './api';
import type { Opportunity } from './types';
import Nav from './components/Nav';
import TodayPanel from './components/TodayPanel';
import PipelinePanel from './components/PipelinePanel';
import KanbanPanel from './components/KanbanPanel';
import OppModal from './components/OppModal';
import LoginPage from './components/LoginPage';

type Tab = 'today' | 'pipeline' | 'kanban';

type ModalState = string | null;

export default function App() {
  const [authenticated, setAuthenticated] = useState(() => !!getToken());
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [tab, setTab] = useState<Tab>('today');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalState, setModalState] = useState<ModalState>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setUnauthorizedHandler(() => setAuthenticated(false));
  }, []);

  const reload = useCallback(async () => {
    try {
      const list = await api.opportunities.list();
      setOpps(list);
      setError(null);
    } catch (e) {
      if ((e as Error).message !== 'Session expired. Please log in again.') {
        setError((e as Error).message);
      }
    }
  }, []);

  const updateOpp = useCallback((updated: Opportunity) => {
    setOpps(prev => prev.map(o => o.id === updated.id ? updated : o));
  }, []);

  const removeOpp = useCallback((id: string) => {
    setOpps(prev => prev.filter(o => o.id !== id));
  }, []);

  useEffect(() => {
    if (authenticated) {
      reload().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [authenticated, reload]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModalState(null);
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setModalState('new');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleLogin = async (username: string, password: string) => {
    const { token } = await api.auth.login(username, password);
    setToken(token);
    setAuthenticated(true);
    setLoading(true);
  };

  const handleLogout = () => {
    clearToken();
    setAuthenticated(false);
    setOpps([]);
  };

  if (!authenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  if (loading) {
    return (
      <div id="app">
        <div className="empty-state" style={{ paddingTop: '6rem' }}>
          <span className="spinner" />Loading...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div id="app">
        <div className="empty-state" style={{ paddingTop: '6rem', color: 'var(--red)' }}>
          Failed to connect to backend: {error}
        </div>
      </div>
    );
  }

  const editOpp = modalState && modalState !== 'new'
    ? opps.find(o => o.id === modalState)
    : undefined;

  return (
    <div id="app">
      <Nav
        tab={tab}
        onTabChange={setTab}
        onAddClick={() => setModalState('new')}
        opps={opps}
        onImport={reload}
        onLogout={handleLogout}
      />
      <div>
        {tab === 'today' && (
          <TodayPanel opps={opps} onView={(id) => { setSelectedId(id); setTab('pipeline'); }} />
        )}
        {tab === 'pipeline' && (
          <PipelinePanel
            opps={opps}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onEdit={(id) => setModalState(id)}
            onUpdate={updateOpp}
            onRemove={removeOpp}
          />
        )}
        {tab === 'kanban' && <KanbanPanel opps={opps} onUpdate={updateOpp} />}
      </div>
      {modalState !== null && (
        <OppModal
          editOpp={editOpp}
          onClose={() => setModalState(null)}
          onSaved={async () => { setModalState(null); await reload(); }}
        />
      )}
    </div>
  );
}
