import { FormEvent, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ApiClientError } from '../api/client';
import { useAuth } from '../context/AuthContext';

const DEMO_ACCOUNTS = [
  {
    label: 'Maya Perera (Staff)',
    email: 'maya@coffeeninja.local',
    password: 'StaffPassword123!',
  },
  {
    label: 'Liam Fernando (Staff)',
    email: 'liam@coffeeninja.local',
    password: 'StaffPassword123!',
  },
  {
    label: 'Nadia Silva (Supervisor)',
    email: 'nadia@coffeeninja.local',
    password: 'LeadPassword123!',
  },
];

export function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectTo =
    (location.state as { from?: { pathname?: string } } | null)?.from
      ?.pathname ?? '/inquiries';

  if (!loading && user) {
    return <Navigate to={redirectTo} replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Enter both your work email and password.');
      return;
    }

    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Unable to sign in right now. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-layout">
      <div className="card auth-card">
        <div className="auth-card__header">
          <span className="brand__mark brand__mark--lg" aria-hidden="true">
            CN
          </span>
          <h1>Customer Inquiry Desk</h1>
          <p className="muted">
            Sign in with your Coffee Ninja staff account to log and track
            customer requests.
          </p>
        </div>

        {error && (
          <div className="alert alert--error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="stack-md">
          <div className="field">
            <label htmlFor="login-email">Work Email</label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder="maya@coffeeninja.local"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn--primary btn--full"
            disabled={submitting}
          >
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="demo-accounts">
          <p className="demo-accounts__title">Seeded Demo Accounts</p>
          <div className="demo-accounts__list">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                className="btn btn--ghost btn--xs"
                onClick={() => {
                  setEmail(account.email);
                  setPassword(account.password);
                  setError(null);
                }}
              >
                Use {account.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

