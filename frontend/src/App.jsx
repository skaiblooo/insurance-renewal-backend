import { useState, useEffect, useMemo } from 'react';
import './App.css';
import Login from './Login';
import ChatPanel from './ChatPanel';
import Navigation from './Navigation';

const REASON_STYLES = {
  'Contr Bond Susp': { color: 'var(--alert)', label: 'Bond cancelled' },
  'Work Comp Susp': { color: 'var(--gold)', label: "Workers' comp lapsed" },
};

function getReasonStyle(reason) {
  return REASON_STYLES[reason] || { color: 'var(--ink-muted)', label: reason };
}

function formatDate(isoString) {
  if (!isoString) return 'Not available';
  const d = new Date(isoString);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

function daysAgo(isoString) {
  if (!isoString) return null;
  const d = new Date(isoString);
  const now = new Date();
  const utcDate = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const utcNow = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((utcNow - utcDate) / 86400000);
}

function formatPhone(phone) {
  if (!phone) return null;
  return phone;
}

function getDateGroup(isoString) {
  const age = daysAgo(isoString);
  if (age === null) return 'Date unknown';
  if (age <= 0) return 'Today';
  if (age <= 7) return 'This week';
  if (age <= 30) return 'This month';
  return 'Earlier';
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('auth_token'));
  const [contractors, setContractors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [contacted, setContacted] = useState(() => new Set());

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    fetch('https://insurance-renewal-backend-1.onrender.com/api/suspended-contractors', {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json();
      })
      .then((data) => {
        setContractors(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [token]);

  const reasonCounts = useMemo(() => {
    const counts = {};
    contractors.forEach((c) => {
      counts[c.primary_status] = (counts[c.primary_status] || 0) + 1;
    });
    return counts;
  }, [contractors]);

  const filtered = useMemo(() => {
    let list = contractors;
    if (filter !== 'all') {
      list = list.filter((c) => c.primary_status === filter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.business_name?.toLowerCase().includes(q) ||
          c.license_no?.includes(q)
      );
    }
    return list;
  }, [contractors, filter, search]);

  function toggleContacted(licenseNo) {
    setContacted((prev) => {
      const next = new Set(prev);
      if (next.has(licenseNo)) next.delete(licenseNo);
      else next.add(licenseNo);
      return next;
    });
  }

  function handleLogout() {
    localStorage.removeItem('auth_token');
    setToken(null);
    setContractors([]);
  }

  if (!token) {
    return <Login onLoginSuccess={setToken} />;
  }

  return (
    <div className="page">
      <Navigation username="admin" onLogout={handleLogout} />

      <div className="page-wrapper">
        <header className="masthead">
          <div>
            <h1 className="masthead-title">Renewal Call Queue</h1>
            <p className="masthead-sub">
              Contractors currently suspended for lapsed insurance or bond coverage,
              ranked by priority to call.
            </p>
          </div>
        </header>

        <section className="summary-strip">
          <div className="summary-card">
            <span className="summary-number">{contractors.length}</span>
            <span className="summary-label">Total flagged</span>
          </div>
          {Object.entries(reasonCounts).slice(0, 3).map(([reason, count]) => {
            const style = getReasonStyle(reason);
            return (
              <div className="summary-card" key={reason}>
                <span className="summary-number" style={{ color: style.color }}>
                  {count}
                </span>
                <span className="summary-label">{style.label}</span>
              </div>
            );
          })}
          <div className="summary-card">
            <span className="summary-number" style={{ color: 'var(--sage)' }}>
              {contacted.size}
            </span>
            <span className="summary-label">Marked contacted</span>
          </div>
        </section>

        <section className="controls">
          <input
            className="search-input"
            type="text"
            placeholder="Search by business name or license number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="filter-pills">
            <button
              className={`pill ${filter === 'all' ? 'pill-active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            {Object.keys(reasonCounts).slice(0, 4).map((reason) => (
              <button
                key={reason}
                className={`pill ${filter === reason ? 'pill-active' : ''}`}
                onClick={() => setFilter(reason)}
              >
                {getReasonStyle(reason).label}
              </button>
            ))}
          </div>
        </section>

        <section className="queue">
          {loading && (
            <div className="skeleton-list">
              {[1, 2, 3, 4, 5].map((i) => (
                <div className="skeleton-row" key={i}>
                  <div className="skeleton-block skeleton-score" />
                  <div className="skeleton-lines">
                    <div className="skeleton-block skeleton-line-wide" />
                    <div className="skeleton-block skeleton-line-narrow" />
                  </div>
                  <div className="skeleton-block skeleton-phone" />
                </div>
              ))}
            </div>
          )}
          {error && (
            <div className="state-message state-error">
              Couldn't reach the server. Is the backend running on port 3001?
            </div>
          )}
          {!loading && !error && filtered.length === 0 && (
            <div className="state-message">No records match this filter.</div>
          )}
          {!loading &&
            !error &&
            (() => {
              const groups = {};
              const order = ['Today', 'This week', 'This month', 'Earlier', 'Date unknown'];
              filtered.forEach((c) => {
                const g = getDateGroup(c.suspension_date);
                if (!groups[g]) groups[g] = [];
                groups[g].push(c);
              });

              return order
                .filter((g) => groups[g]?.length)
                .map((groupName) => (
                  <div className="date-group" key={groupName}>
                    <div className="date-group-header">
                      {groupName}
                      <span className="date-group-count">{groups[groupName].length}</span>
                    </div>
                    {groups[groupName].map((c) => {
                      const style = getReasonStyle(c.primary_status);
                      const age = daysAgo(c.suspension_date);
                      const isContacted = contacted.has(c.license_no);
                      return (
                        <article
                          className={`row ${isContacted ? 'row-contacted' : ''}`}
                          key={c.license_no}
                          style={{ borderLeftColor: style.color }}
                        >
                          <div className="row-score">
                            <span
                              className="score-badge"
                              style={{
                                background:
                                  c.priority_score >= 80
                                    ? 'var(--alert)'
                                    : c.priority_score >= 50
                                    ? 'var(--gold)'
                                    : 'var(--ink-muted)',
                              }}
                            >
                              {c.priority_score ?? '–'}
                            </span>
                            <span className="score-label">priority</span>
                          </div>
                          <div className="row-main">
                            <div className="row-name-line">
                              <h2 className="row-name">{c.business_name || 'Unnamed business'}</h2>
                              <span className="row-license">#{c.license_no}</span>
                            </div>
                            <div className="row-meta">
                              <span className="row-reason" style={{ color: style.color }}>
                                {style.label}
                              </span>
                              <span className="row-dot">·</span>
                              <span className="row-date">
                                {c.has_reliable_date
                                  ? `Suspended ${formatDate(c.suspension_date)}`
                                  : 'Suspension date not available'}
                              </span>
                              {age !== null && age <= 3 && (
                                <span className="row-fresh">New</span>
                              )}
                            </div>
                          </div>
                          <div className="row-action">
                            {formatPhone(c.business_phone) ? (
                              <a className="row-phone" href={`tel:${c.business_phone}`}>
                                {c.business_phone}
                              </a>
                            ) : (
                              <span className="row-phone row-phone-missing">No phone on file</span>
                            )}
                            <button
                              className={`contact-toggle ${isContacted ? 'contact-toggle-done' : ''}`}
                              onClick={() => toggleContacted(c.license_no)}
                            >
                              {isContacted ? 'Contacted ✓' : 'Mark contacted'}
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ));
            })()}
        </section>

        <ChatPanel />
      </div>
    </div>
  );
}