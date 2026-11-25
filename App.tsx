import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Command,
  Database,
  FlaskConical,
  Gauge,
  LayoutDashboard,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Terminal,
  UserRound,
  X,
  Zap,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

type FlagState = 'on' | 'off' | 'paused';
type Accent = 'green' | 'amber' | 'red';
type Filter = 'all' | 'on' | 'off' | 'paused';
type MessageRole = 'assistant' | 'operator';

type FeatureFlag = {
  id: string;
  name: string;
  state: FlagState;
  targeting: string;
  value: string;
  users: number;
  conversion: string;
  accent: Accent;
  created_at?: string;
  updated_at?: string;
};

type AssistantMessage = {
  id: string;
  role: MessageRole;
  content: string;
  created_at?: string;
};

type NewFlag = {
  name: string;
  targeting: string;
  value: string;
  state: FlagState;
};

const initialFlags: FeatureFlag[] = [
  { id: 'checkout_v2', name: 'checkout_v2', state: 'on', targeting: '50/50 split', value: 'Variant A / B', users: 15480, conversion: '+4.2%', accent: 'green' },
  { id: 'ai_suggestions', name: 'ai_suggestions', state: 'on', targeting: 'Segment: beta', value: '20% enabled', users: 2430, conversion: '+8.7%', accent: 'amber' },
  { id: 'pricing_test', name: 'pricing_test', state: 'on', targeting: '45/55 split', value: 'Control / Test', users: 11920, conversion: '+0.9%', accent: 'green' },
  { id: 'search_algos', name: 'search_algos', state: 'on', targeting: '50/50 split', value: 'Algo A / B', users: 7895, conversion: '+2.3%', accent: 'green' },
  { id: 'dark_mode_beta', name: 'dark_mode_beta', state: 'on', targeting: '30/70 split', value: 'Light / Dark', users: 3210, conversion: '+10.5%', accent: 'amber' },
  { id: 'new_onboarding', name: 'new_onboarding', state: 'off', targeting: 'All users', value: 'Enabled (100%)', users: 9105, conversion: '-1.1%', accent: 'red' },
  { id: 'mobile_ui_refresh', name: 'mobile_ui_refresh', state: 'off', targeting: 'iOS only', value: 'Enabled (100%)', users: 4650, conversion: '-0.5%', accent: 'red' },
  { id: 'video_autoplay', name: 'video_autoplay', state: 'paused', targeting: 'All users', value: 'Disabled (0%)', users: 0, conversion: '—', accent: 'amber' },
];

const initialMessages: AssistantMessage[] = [
  {
    id: 'welcome',
    role: 'assistant',
    content: 'Morning, Alex. I have the latest experiment signals ready. Ask me about lift, rollout risk, or a specific flag.',
  },
];

const stateLabel: Record<FlagState, string> = { on: 'LIVE', off: 'OFF', paused: 'PAUSED' };

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}

function getAssistantReply(input: string, flags: FeatureFlag[]) {
  const normalized = input.toLowerCase();
  const bestFlag = [...flags].sort((a, b) => parseFloat(b.conversion) - parseFloat(a.conversion))[0];

  if (normalized.includes('risk') || normalized.includes('safe')) {
    return 'Rollout risk is low overall. Keep video_autoplay paused while its sample is empty, and watch new_onboarding because it is the only active negative signal.';
  }

  if (normalized.includes('best') || normalized.includes('winning') || normalized.includes('lift')) {
    return `${bestFlag.name} is the strongest signal at ${bestFlag.conversion} conversion lift across ${formatNumber(bestFlag.users)} exposed users.`;
  }

  if (normalized.includes('checkout')) {
    return 'checkout_v2 is live on a 50/50 split with +4.2% conversion lift. It has enough traffic for a confident next read after the next daily sync.';
  }

  if (normalized.includes('onboarding')) {
    return 'new_onboarding is currently off after a -1.1% conversion delta. I would keep it paused until the activation drop is understood.';
  }

  return 'I can summarize rollout risk, compare conversion lift, or inspect any flag. Try “what is the strongest experiment?”';
}

function StatusPill({ state, accent }: { state: FlagState; accent: Accent }) {
  return (
    <span className={`status-pill ${accent} ${state}`}>
      <span className="status-dot" />
      {stateLabel[state]}
    </span>
  );
}

function FlagToggle({ state, onChange }: { state: FlagState; onChange: () => void }) {
  return (
    <button
      type="button"
      className={`flag-toggle ${state}`}
      onClick={onChange}
      aria-label={state === 'on' ? 'Turn flag off' : 'Turn flag on'}
      aria-pressed={state === 'on'}
    >
      <span />
    </button>
  );
}

function App() {
  const [flags, setFlags] = useState<FeatureFlag[]>(initialFlags);
  const [messages, setMessages] = useState<AssistantMessage[]>(initialMessages);
  const [activeView, setActiveView] = useState('Overview');
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [isAssistantOpen, setIsAssistantOpen] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [syncLabel, setSyncLabel] = useState('syncing');
  const [newFlag, setNewFlag] = useState<NewFlag>({ name: '', targeting: 'All users', value: 'Enabled (100%)', state: 'off' });

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      if (!supabase) {
        setIsLoading(false);
        setSyncLabel('local preview');
        return;
      }

      const [flagsResult, messagesResult] = await Promise.all([
        supabase.from('feature_flags').select('*').order('created_at', { ascending: true }),
        supabase.from('assistant_messages').select('*').order('created_at', { ascending: true }),
      ]);

      if (!isMounted) return;

      if (!flagsResult.error && flagsResult.data?.length) {
        setFlags(flagsResult.data as FeatureFlag[]);
      }
      if (!messagesResult.error && messagesResult.data?.length) {
        setMessages(messagesResult.data as AssistantMessage[]);
      }
      setSyncLabel(flagsResult.error || messagesResult.error ? 'offline preview' : 'synced');
      setIsLoading(false);
    }

    void loadDashboard();
    return () => {
      isMounted = false;
    };
  }, []);

  const visibleFlags = useMemo(() => {
    const query = search.trim().toLowerCase();
    return flags.filter((flag) => {
      const matchesFilter = filter === 'all' || flag.state === filter;
      const matchesSearch = !query || `${flag.name} ${flag.targeting} ${flag.value}`.toLowerCase().includes(query);
      return matchesFilter && matchesSearch;
    });
  }, [filter, flags, search]);

  const runningCount = flags.filter((flag) => flag.state === 'on').length;
  const pausedCount = flags.filter((flag) => flag.state === 'paused').length;
  const totalUsers = flags.reduce((total, flag) => total + flag.users, 0);
  const positiveSignals = flags.filter((flag) => flag.conversion.startsWith('+')).length;

  async function toggleFlag(flag: FeatureFlag) {
    const nextState: FlagState = flag.state === 'on' ? 'off' : 'on';
    const nextFlag = { ...flag, state: nextState, updated_at: new Date().toISOString() };
    setFlags((current) => current.map((item) => item.id === flag.id ? nextFlag : item));
    setSyncLabel('saving');

    if (supabase) {
      const { error } = await supabase.from('feature_flags').update({ state: nextState, updated_at: nextFlag.updated_at }).eq('id', flag.id);
      setSyncLabel(error ? 'offline preview' : 'synced');
    } else {
      setSyncLabel('local preview');
    }
  }

  async function sendMessage(event?: FormEvent) {
    event?.preventDefault();
    const content = draft.trim();
    if (!content || isSending) return;

    const operatorMessage: AssistantMessage = { id: `operator-${Date.now()}`, role: 'operator', content };
    setMessages((current) => [...current, operatorMessage]);
    setDraft('');
    setIsSending(true);

    if (supabase) {
      await supabase.from('assistant_messages').insert({ role: 'operator', content });
    }

    window.setTimeout(async () => {
      const assistantMessage: AssistantMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: getAssistantReply(content, flags),
      };
      setMessages((current) => [...current, assistantMessage]);
      setIsSending(false);
      if (supabase) {
        await supabase.from('assistant_messages').insert({ role: 'assistant', content: assistantMessage.content });
      }
    }, 520);
  }

  async function createFlag(event: FormEvent) {
    event.preventDefault();
    const name = newFlag.name.trim().toLowerCase().replace(/\s+/g, '_');
    if (!name) return;

    const createdFlag: FeatureFlag = {
      id: name,
      name,
      state: newFlag.state,
      targeting: newFlag.targeting,
      value: newFlag.value,
      users: 0,
      conversion: '—',
      accent: newFlag.state === 'on' ? 'green' : 'red',
    };
    setFlags((current) => [createdFlag, ...current]);
    setNewFlag({ name: '', targeting: 'All users', value: 'Enabled (100%)', state: 'off' });
    setIsCreateOpen(false);
    setSyncLabel('saving');

    if (supabase) {
      const { error } = await supabase.from('feature_flags').insert(createdFlag);
      setSyncLabel(error ? 'offline preview' : 'synced');
    } else {
      setSyncLabel('local preview');
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark"><span>λ</span></div>
          <span className="brand-name">FlagPilot</span>
          <span className="brand-version">v0.9.4</span>
        </div>

        <nav className="top-nav" aria-label="Primary navigation">
          {['Overview', 'Experiments', 'Segments', 'Audit log'].map((item) => (
            <button key={item} type="button" className={activeView === item ? 'active' : ''} onClick={() => setActiveView(item)}>
              {item}
              {item === 'Experiments' && <span className="nav-count">8</span>}
            </button>
          ))}
        </nav>

        <div className="topbar-actions">
          <div className="command-search">
            <Search size={15} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search flags" aria-label="Search flags" />
            <kbd><Command size={11} /> K</kbd>
          </div>
          <button type="button" className="icon-button" aria-label="Help"><CircleHelp size={17} /></button>
          <button type="button" className="avatar" aria-label="Account menu">AL</button>
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <div className="workspace-switcher">
            <div className="workspace-icon">N</div>
            <div>
              <span className="eyebrow">WORKSPACE</span>
              <strong>northstar / prod</strong>
            </div>
            <ChevronDown size={15} />
          </div>

          <div className="sidebar-section">
            <span className="sidebar-label">Control room</span>
            <button type="button" className={activeView === 'Overview' ? 'sidebar-link active' : 'sidebar-link'} onClick={() => setActiveView('Overview')}><LayoutDashboard size={16} /> Overview</button>
            <button type="button" className={activeView === 'Experiments' ? 'sidebar-link active' : 'sidebar-link'} onClick={() => setActiveView('Experiments')}><FlaskConical size={16} /> Experiments <span className="sidebar-badge">8</span></button>
            <button type="button" className={activeView === 'Segments' ? 'sidebar-link active' : 'sidebar-link'} onClick={() => setActiveView('Segments')}><SlidersHorizontal size={16} /> Segments</button>
          </div>

          <div className="sidebar-section">
            <span className="sidebar-label">Observe</span>
            <button type="button" className="sidebar-link"><Activity size={16} /> Analytics</button>
            <button type="button" className="sidebar-link"><Terminal size={16} /> Event stream <span className="live-dot" /></button>
            <button type="button" className={activeView === 'Audit log' ? 'sidebar-link active' : 'sidebar-link'} onClick={() => setActiveView('Audit log')}><Database size={16} /> Audit log</button>
          </div>

          <div className="sidebar-section">
            <span className="sidebar-label">Configure</span>
            <button type="button" className="sidebar-link"><Zap size={16} /> Integrations</button>
            <button type="button" className="sidebar-link"><Settings2 size={16} /> Workspace settings</button>
          </div>

          <div className="sidebar-footer">
            <div className="connection-card">
              <span className="connection-icon"><Check size={14} /></span>
              <div>
                <strong>Flagsmith bridge</strong>
                <span><i /> {syncLabel}</span>
              </div>
              <MoreHorizontal size={16} />
            </div>
            <div className="user-card">
              <div className="avatar small">AL</div>
              <div><strong>Alex Lee</strong><span>admin / northstar</span></div>
              <ChevronRight size={15} />
            </div>
          </div>
        </aside>

        <main className="main-content">
          <div className="content-header">
            <div>
              <div className="breadcrumbs"><span>Control room</span><ChevronRight size={13} /><span className="current">Experiments</span></div>
              <h1>Experiments</h1>
              <p className="page-description">Ship with confidence. Watch the signal before you widen the rollout.</p>
            </div>
            <div className="header-actions">
              <button type="button" className="button secondary"><Gauge size={15} /> Live metrics</button>
              <button type="button" className="button primary" onClick={() => setIsCreateOpen(true)}><Plus size={16} /> New flag</button>
            </div>
          </div>

          <section className="metric-strip" aria-label="Experiment summary">
            <div className="metric-card"><span className="metric-label">Total flags</span><strong>{flags.length.toString().padStart(2, '0')}</strong><span className="metric-note">across workspace</span></div>
            <div className="metric-card"><span className="metric-label">Running now</span><strong className="green-text">{runningCount.toString().padStart(2, '0')}</strong><span className="metric-note"><span className="pulse-dot" /> live</span></div>
            <div className="metric-card"><span className="metric-label">Paused</span><strong className="amber-text">{pausedCount.toString().padStart(2, '0')}</strong><span className="metric-note">awaiting signal</span></div>
            <div className="metric-card"><span className="metric-label">Exposed users</span><strong>{formatNumber(totalUsers)}</strong><span className="metric-note"><ArrowUpRight size={13} /> 12.8% this week</span></div>
            <div className="signal-card"><div className="signal-icon"><Sparkles size={17} /></div><div><span className="metric-label">Signal quality</span><strong>Healthy</strong></div><div className="signal-bars"><i /><i /><i /><i /><i /></div><span className="signal-score">{positiveSignals}/{flags.length}</span></div>
          </section>

          <section className="table-card">
            <div className="table-toolbar">
              <div className="toolbar-title"><span className="section-kicker">Feature flags</span><span className="toolbar-count">{visibleFlags.length} visible</span></div>
              <div className="toolbar-controls">
                <div className="filter-tabs">
                  {(['all', 'on', 'off', 'paused'] as Filter[]).map((item) => <button key={item} type="button" className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item === 'all' ? 'All flags' : item === 'on' ? 'Running' : item[0].toUpperCase() + item.slice(1)}</button>)}
                </div>
                <button type="button" className="toolbar-icon" aria-label="Filter options"><SlidersHorizontal size={16} /></button>
              </div>
            </div>
            <div className="table-scroll">
              <table>
                <thead><tr><th>Flag name</th><th>Status</th><th>Targeting</th><th>Value</th><th>Exposed users</th><th>Conversion</th><th aria-label="Actions" /></tr></thead>
                <tbody>
                  {isLoading ? <tr><td colSpan={7} className="empty-state">Loading workspace signals<span className="loading-line" /></td></tr> : visibleFlags.length ? visibleFlags.map((flag) => (
                    <tr key={flag.id}>
                      <td><div className="flag-name"><span className={`flag-signal ${flag.accent}`} /><div><strong>{flag.name}</strong><span>key: {flag.id}</span></div></div></td>
                      <td><StatusPill state={flag.state} accent={flag.accent} /></td>
                      <td><span className="table-muted">{flag.targeting}</span></td>
                      <td><span className="value-text">{flag.value}</span></td>
                      <td><span className="users-number">{formatNumber(flag.users)}</span></td>
                      <td>{flag.conversion === '—' ? <span className="table-muted">—</span> : <span className={flag.conversion.startsWith('+') ? 'conversion positive' : 'conversion negative'}>{flag.conversion}{flag.conversion.startsWith('+') ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}</span>}</td>
                      <td><div className="row-actions"><FlagToggle state={flag.state} onChange={() => void toggleFlag(flag)} /><button type="button" className="row-more" aria-label={`More options for ${flag.name}`}><MoreHorizontal size={16} /></button></div></td>
                    </tr>
                  )) : <tr><td colSpan={7} className="empty-state">No flags match this view.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="table-footer"><span><span className="footer-live-dot" /> Data refreshes every 60 seconds</span><span>Last synced just now <ChevronRight size={13} /></span></div>
          </section>

          <section className="bottom-grid">
            <div className="activity-card">
              <div className="card-heading"><div><span className="section-kicker">Recent activity</span><h2>What changed</h2></div><button type="button" className="text-button">View audit log <ArrowUpRight size={14} /></button></div>
              <div className="activity-list">
                <div className="activity-item"><div className="activity-avatar lime"><UserRound size={14} /></div><div><p><strong>Alex Lee</strong> turned on <code>ai_suggestions</code></p><span>12 min ago · 20% rollout</span></div><span className="activity-status">LIVE</span></div>
                <div className="activity-item"><div className="activity-avatar blue"><Activity size={14} /></div><div><p><strong>Analytics sync</strong> recorded a positive signal</p><span>28 min ago · checkout_v2 · +4.2%</span></div><span className="activity-status blue-text">SYNCED</span></div>
                <div className="activity-item"><div className="activity-avatar amber"><SlidersHorizontal size={14} /></div><div><p><strong>Targeting updated</strong> for <code>dark_mode_beta</code></p><span>1 hr ago · Segment: beta</span></div><span className="activity-status amber-text">UPDATED</span></div>
              </div>
            </div>
            <div className="rollout-card"><div className="rollout-header"><div><span className="section-kicker">Rollout health</span><h2>Across environments</h2></div><button type="button" className="row-more" aria-label="More rollout options"><MoreHorizontal size={16} /></button></div><div className="environment"><div><span className="env-status live" /><strong>production</strong></div><span>8 / 8 synced</span><div className="env-progress"><i style={{ width: '100%' }} /></div></div><div className="environment"><div><span className="env-status live" /><strong>staging</strong></div><span>8 / 8 synced</span><div className="env-progress"><i style={{ width: '82%' }} /></div></div><div className="environment"><div><span className="env-status muted" /><strong>development</strong></div><span>6 / 8 synced</span><div className="env-progress"><i style={{ width: '62%' }} /></div></div></div>
          </section>
        </main>

        <aside className={isAssistantOpen ? 'assistant-panel open' : 'assistant-panel'}>
          <div className="assistant-header"><div className="assistant-title"><div className="bot-avatar"><Bot size={17} /></div><div><strong>FlagPilot AI</strong><span><i /> context: experiments</span></div></div><button type="button" className="panel-close" onClick={() => setIsAssistantOpen(false)} aria-label="Close assistant"><X size={17} /></button></div>
          <div className="assistant-context"><span><Sparkles size={13} /> AI copilot</span><span className="context-model">signal-v1</span></div>
          <div className="chat-thread">
            <div className="chat-date">TODAY · 09:41</div>
            {messages.map((message) => <div key={message.id} className={`message ${message.role}`}><div className="message-meta">{message.role === 'assistant' ? <><Bot size={12} /> FLAGPILOT AI</> : <><UserRound size={12} /> YOU</>}</div><div className="message-bubble">{message.content}</div></div>)}
            {isSending && <div className="message assistant"><div className="message-meta"><Bot size={12} /> FLAGPILOT AI</div><div className="message-bubble typing"><i /><i /><i /></div></div>}
          </div>
          <form className="chat-composer" onSubmit={sendMessage}><textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask about your experiments..." rows={2} /><div className="composer-footer"><span>Enter to send · Shift + Enter for new line</span><button type="submit" className="send-button" aria-label="Send message"><Send size={15} /></button></div></form>
          <div className="assistant-suggestions"><span>Try asking</span><button type="button" onClick={() => setDraft('What is the strongest experiment right now?')}>strongest experiment <ArrowUpRight size={12} /></button><button type="button" onClick={() => setDraft('What is the rollout risk?')}>rollout risk <ArrowUpRight size={12} /></button></div>
        </aside>

        {!isAssistantOpen && <button type="button" className="assistant-reopen" onClick={() => setIsAssistantOpen(true)}><Bot size={17} /> Open AI copilot</button>}
      </div>

      {isCreateOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) setIsCreateOpen(false); }}><div className="create-modal"><div className="modal-header"><div><span className="section-kicker">New control</span><h2>Create a feature flag</h2></div><button type="button" className="panel-close" onClick={() => setIsCreateOpen(false)} aria-label="Close create flag dialog"><X size={17} /></button></div><form onSubmit={createFlag}><label>Flag name<input autoFocus value={newFlag.name} onChange={(event) => setNewFlag((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. recommendations_v3" /></label><label>Targeting<input value={newFlag.targeting} onChange={(event) => setNewFlag((current) => ({ ...current, targeting: event.target.value }))} placeholder="All users" /></label><label>Variation<input value={newFlag.value} onChange={(event) => setNewFlag((current) => ({ ...current, value: event.target.value }))} placeholder="Enabled (100%)" /></label><label>Initial status<select value={newFlag.state} onChange={(event) => setNewFlag((current) => ({ ...current, state: event.target.value as FlagState }))}><option value="off">Off</option><option value="on">Live</option><option value="paused">Paused</option></select></label><div className="modal-actions"><button type="button" className="button secondary" onClick={() => setIsCreateOpen(false)}>Cancel</button><button type="submit" className="button primary"><Plus size={15} /> Create flag</button></div></form></div></div>}
    </div>
  );
}

export default App;
