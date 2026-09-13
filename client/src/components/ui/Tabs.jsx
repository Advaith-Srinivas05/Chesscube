import { useRef } from 'react';
import styles from './Tabs.module.css';

const tabId = (id, value) => `${id}-tab-${value}`;
const panelId = (id, value) => `${id}-panel-${value}`;

// Controlled tabs. `id` ties the tab buttons to their <TabPanel>s; the page keeps `value` in sync with the URL.
export default function Tabs({ id, items, value, onChange, label, className = '' }) {
  const listRef = useRef(null);

  function select(index) {
    const item = items[(index + items.length) % items.length];
    onChange(item.value);
    listRef.current?.querySelector(`#${CSS.escape(tabId(id, item.value))}`)?.focus();
  }

  function handleKeyDown(event) {
    const current = items.findIndex((item) => item.value === value);
    const moves = { ArrowRight: current + 1, ArrowLeft: current - 1, Home: 0, End: items.length - 1 };
    if (!(event.key in moves)) return;
    event.preventDefault();
    select(moves[event.key]);
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      className={`${styles.list} ${className}`}
      onKeyDown={handleKeyDown}
    >
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            id={tabId(id, item.value)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId(id, item.value)}
            tabIndex={selected ? 0 : -1}
            className={`${styles.tab} ${selected ? styles.selected : ''}`}
            onClick={() => onChange(item.value)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

// Render only the active panel, with the same `tabsId` as its <Tabs>.
export function TabPanel({ tabsId, value, children, className = '' }) {
  return (
    <div
      id={panelId(tabsId, value)}
      role="tabpanel"
      aria-labelledby={tabId(tabsId, value)}
      tabIndex={0}
      className={`${styles.panel} ${className}`}
    >
      {children}
    </div>
  );
}
