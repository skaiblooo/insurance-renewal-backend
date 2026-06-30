export default function Navigation({ username, onLogout }) {
  return (
    <nav className="top-nav">
      <div className="nav-brand">
        <div className="nav-logo-box">
          <svg className="nav-logo-icon" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="40" height="40" rx="8" fill="var(--gold)" fillOpacity="0.1" />
            <path d="M12 28V12H20C23.3 12 26 14.7 26 18C26 20.76 24.27 23.12 21.8 23.8L26 28H22.4L18.4 24H16V28H12Z" fill="var(--gold)" />
          </svg>
          <div className="nav-brand-text">
            <div className="nav-brand-company">ASTER NATIONAL</div>
            <div className="nav-brand-tagline">Insurance Solutions</div>
          </div>
        </div>
      </div>

      <div className="nav-center"></div>

      <div className="nav-right">
        <button className="nav-action-btn" title="Help">
          <span className="nav-action-icon">?</span>
        </button>
        <button className="nav-action-btn" title="Settings">
          <span className="nav-action-icon">⚙</span>
        </button>
        <div className="nav-divider"></div>
        <div className="user-avatar">{username?.charAt(0).toUpperCase()}</div>
        <button className="nav-logout" onClick={onLogout}>
          Logout
        </button>
      </div>
    </nav>
  );
}