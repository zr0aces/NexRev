import React, { useState, useEffect, useCallback } from 'react';
import { 
  Sun, 
  LayoutDashboard, 
  ScrollText, 
  User, 
  Plus 
} from 'lucide-react';
import { api, getToken, setToken, clearToken, setUnauthorizedHandler } from './api';
import type { Opportunity } from './types';
import Nav from './components/Nav';
import TodayPanel from './components/TodayPanel';
import PipelinePanel from './components/PipelinePanel';
import ActivityLogPanel from './components/ActivityLogPanel';
import OppModal from './components/OppModal';
import LoginPage from './components/LoginPage';
import ProfilePanel from './components/ProfilePanel';
import { useToast } from './context/ToastContext';

type Tab = 'today' | 'pipeline' | 'log' | 'profile';
type ModalState = string | null;

export default function App() {
  const { addToast } = useToast();
  const [authenticated, setAuthenticated] = useState(() => !!getToken());
  const [username, setUsername]           = useState(() => localStorage.getItem('auth_user') || '');
  const [opps, setOpps]         = useState<Opportunity[]>([]);
  const [tab, setTab]           = useState<Tab>('today');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalState, setModalState] = useState<ModalState>(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    setUnauthorizedHandler(() => setAuthenticated(false));
  }, []);

  const reload = useCallback(async () => {
    try {
      const list = await api.opportunities.list();
      setOpps(list);
    } catch (e) {
      if ((e as Error).message !== 'Session expired. Please log in again.') {
        addToast('Failed to connect to backend: ' + (e as Error).message, 'error');
      }
    }
  }, [addToast]);

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
    const { token, username: user } = await api.auth.login(username, password);
    setToken(token);
    localStorage.setItem('auth_user', user);
    setUsername(user);
    setAuthenticated(true);
    setLoading(true);
    addToast('Logged in as ' + user, 'success');
  };

  const handleLogout = () => {
    clearToken();
    localStorage.removeItem('auth_user');
    setAuthenticated(false);
    setUsername('');
    setOpps([]);
    addToast('Logged out.', 'info');
  };

  if (!authenticated) return <LoginPage onLogin={handleLogin} />;

  if (loading) {
    return (
      <div id="app">
        <div className="empty-state" style={{ paddingTop: '6rem' }}>
          <span className="spinner" />Loading…
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
        username={username}
      />
      <div className="animate-entry" key={tab}>
        {tab === 'today' && (
          <TodayPanel
            opps={opps}
            onSelect={(id) => {
              setTab('pipeline');
              setSelectedId(id);
            }}
            onEdit={(id) => setModalState(id)}
            onUpdate={updateOpp}
            onRemove={removeOpp}
          />
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
        {tab === 'log' && <ActivityLogPanel opps={opps} />}
        {tab === 'profile' && <ProfilePanel />}
      </div>
      {modalState !== null && (
        <OppModal
          opps={opps}
          editOpp={editOpp}
          onClose={() => setModalState(null)}
          onSaved={async () => { setModalState(null); await reload(); }}
          onSelectExisting={(id) => {
            setModalState(null);
            setTab('pipeline');
            setSelectedId(id);
          }}
        />
      )}

      {/* Mobile-only Bottom Nav */}
      <div className="bottom-nav show-mobile">
        <button className={`bottom-nav-item${tab === 'today' ? ' active' : ''}`} onClick={() => setTab('today')}>
          <div className="bottom-nav-icon"><Sun size={20} /></div>
          <span className="bottom-nav-label">Today</span>
        </button>
        <button className={`bottom-nav-item${tab === 'pipeline' ? ' active' : ''}`} onClick={() => setTab('pipeline')}>
          <div className="bottom-nav-icon"><LayoutDashboard size={20} /></div>
          <span className="bottom-nav-label">Pipeline</span>
        </button>
        <button className={`bottom-nav-item${tab === 'log' ? ' active' : ''}`} onClick={() => setTab('log')}>
          <div className="bottom-nav-icon"><ScrollText size={20} /></div>
          <span className="bottom-nav-label">Logs</span>
        </button>
        <button className={`bottom-nav-item${tab === 'profile' ? ' active' : ''}`} onClick={() => setTab('profile')}>
          <div className="bottom-nav-icon"><User size={20} /></div>
          <span className="bottom-nav-label">Profile</span>
        </button>
      </div>

      {/* Floating Action Button for Mobile */}
      <div className="fab-container show-mobile">
        <button className="fab" onClick={() => setModalState('new')}>
          <Plus size={28} />
        </button>
      </div>
    </div>
  );
}
