import { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar__inner">
          <Link to="/inquiries" className="brand">
            <span className="brand__mark" aria-hidden="true">
              CN
            </span>
            <span>
              <strong>Coffee Ninja</strong>
              <small>Inquiry Desk</small>
            </span>
          </Link>

          {user && (
            <div className="topbar__right">
              <div className="user-pill">
                <span className="user-pill__name">{user.name}</span>
                <span className="user-pill__role">
                  {user.role === 'supervisor' ? 'Supervisor' : 'Staff'}
                </span>
              </div>
              <Link to="/inquiries/new" className="btn btn--primary btn--sm">
                + Log Inquiry
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="btn btn--ghost btn--sm"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="main-content">{children}</main>
    </div>
  );
}

