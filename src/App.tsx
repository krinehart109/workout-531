import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import Today from './screens/Today';
import Program from './screens/Program';
import Progress from './screens/Progress';
import SettingsScreen from './screens/SettingsScreen';

type Tab = 'today' | 'program' | 'progress' | 'settings';

const ICONS: Record<Tab, string> = {
  // barbell / grid / trend / gear — single-path 24×24 icons
  today: 'M6.5 6.5v11M4 9v6M17.5 6.5v11M20 9v6M6.5 12h11',
  program: 'M4 5h16v14H4V5M4 10h16M4 15h16M9.3 5v14M14.6 5v14',
  progress: 'M4 19 9.5 12l4 3.5L20 6M20 6h-5M20 6v5',
  settings:
    'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7.4-2 1.6-1.2-1.5-3-1.9.5a6 6 0 0 0-1.7-1L15.5 5h-3.4l-.4 2.3a6 6 0 0 0-1.7 1l-1.9-.5-1.5 3L8.2 12l-1.6 1.2 1.5 3 1.9-.5a6 6 0 0 0 1.7 1l.4 2.3h3.4l.4-2.3a6 6 0 0 0 1.7-1l1.9.5 1.5-3-1.6-1.2Z',
};

const LABELS: Record<Tab, string> = {
  today: 'Today',
  program: 'Program',
  progress: 'Progress',
  settings: 'Settings',
};

export default function App() {
  const [tab, setTab] = useState<Tab>('today');
  const settings = useLiveQuery(() => db.settings.get(1));

  if (!settings) {
    return (
      <div className="splash">
        <span className="num">FORGE</span>
      </div>
    );
  }

  return (
    <div className="app">
      <main>
        {tab === 'today' && <Today settings={settings} />}
        {tab === 'program' && <Program settings={settings} />}
        {tab === 'progress' && <Progress settings={settings} />}
        {tab === 'settings' && <SettingsScreen settings={settings} />}
      </main>
      <nav className="tabbar">
        {(Object.keys(LABELS) as Tab[]).map((t) => (
          <button key={t} className={`tab ${tab === t ? 'tab-active' : ''}`} onClick={() => setTab(t)}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
              <path
                d={ICONS[t]}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>{LABELS[t]}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
