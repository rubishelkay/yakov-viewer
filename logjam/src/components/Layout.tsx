import { Link } from "../router";
import { useDecisions } from "../state/Decisions";

export function Layout({ children }: { children: React.ReactNode }) {
  const { error, clearError } = useDecisions();
  return (
    <div className="app-shell">
      <header className="site-header">
        <Link className="site-wordmark" to="/" aria-label="LogJam album library">
          LogJam
        </Link>
        <Link className="account-link" to="/account">
          My edit
        </Link>
      </header>
      {error && (
        <div className="global-notice" role="alert">
          <span>{error}</span>
          <button type="button" onClick={clearError} aria-label="Dismiss message">×</button>
        </div>
      )}
      {children}
      <footer className="site-footer">
        <span>LogJam</span>
        <a href="https://yakov.shmol.cc">Yakov Shmol</a>
      </footer>
    </div>
  );
}
