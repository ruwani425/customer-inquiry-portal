import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiClientError } from '../api/client';
import { formatStatusLabel, StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { Inquiry, InquiryStatus } from '../types';
import { formatTimestamp } from '../utils/validation';

const NEXT_STATUS_BY_CURRENT: Record<
  InquiryStatus,
  { next: InquiryStatus; buttonLabel: string; notePlaceholder: string } | null
> = {
  NEW: {
    next: 'IN_PROGRESS',
    buttonLabel: 'Start Handling (Move to In Progress)',
    notePlaceholder: 'Optional note: what action are you taking?',
  },
  IN_PROGRESS: {
    next: 'RESOLVED',
    buttonLabel: 'Mark as Resolved',
    notePlaceholder: 'Optional resolution note: what happened last?',
  },
  RESOLVED: null,
};

type LoadErrorKind = 'forbidden' | 'not_found' | 'invalid_id' | 'generic';

export function InquiryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { clearUser } = useAuth();

  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{
    kind: LoadErrorKind;
    message: string;
  } | null>(null);

  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [staleInquiry, setStaleInquiry] = useState<Inquiry | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadInquiry = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setLoadError(null);
    setStaleInquiry(null);
    setActionError(null);

    try {
      const data = await api.getInquiry(id);
      setInquiry(data.inquiry);
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.status === 401) {
          clearUser();
          return;
        }
        if (err.status === 403) {
          setLoadError({ kind: 'forbidden', message: err.message });
        } else if (err.status === 404) {
          setLoadError({ kind: 'not_found', message: err.message });
        } else if (err.status === 400) {
          setLoadError({ kind: 'invalid_id', message: err.message });
        } else {
          setLoadError({ kind: 'generic', message: err.message });
        }
      } else {
        setLoadError({
          kind: 'generic',
          message: 'Unable to load inquiry. Please try again.',
        });
      }
    } finally {
      setLoading(false);
    }
  }, [id, clearUser]);

  useEffect(() => {
    void loadInquiry();
  }, [loadInquiry]);

  async function handleTransition(e: FormEvent) {
    e.preventDefault();
    if (!inquiry) return;

    const transition = NEXT_STATUS_BY_CURRENT[inquiry.status];
    if (!transition) return;

    setSaving(true);
    setActionError(null);
    setSuccessMessage(null);
    setStaleInquiry(null);

    try {
      const { inquiry: updated } = await api.updateInquiryStatus(inquiry.id, {
        status: transition.next,
        expectedVersion: inquiry.version,
        lastNote: note.trim() || undefined,
      });
      setInquiry(updated);
      setNote('');
      setSuccessMessage(
        `Status updated to ${formatStatusLabel(updated.status)}.`
      );
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.status === 401) {
          clearUser();
          return;
        }
        if (err.code === 'STALE_INQUIRY') {
          setActionError(err.message);
          if (err.currentInquiry) {
            setStaleInquiry(err.currentInquiry);
          }
          return;
        }
        setActionError(err.message);
      } else {
        setActionError('Failed to save status update. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  }

  function applyLatestState() {
    if (staleInquiry) {
      setInquiry(staleInquiry);
      setStaleInquiry(null);
      setActionError(null);
      setSuccessMessage('Loaded the latest inquiry state.');
    } else {
      void loadInquiry();
    }
  }

  if (loading) {
    return (
      <div className="page">
        <div className="card state-box" aria-busy="true">
          <div className="spinner" aria-hidden="true" />
          <p>Loading inquiry details...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    const title =
      loadError.kind === 'forbidden'
        ? 'Access Restricted'
        : loadError.kind === 'invalid_id'
          ? 'Invalid Inquiry Link'
          : loadError.kind === 'not_found'
            ? 'Inquiry Not Found'
            : 'Unable to Load Inquiry';

    return (
      <div className="page stack-md">
        <Link to="/inquiries" className="back-link">
          ← Back to inquiries
        </Link>
        <div className="card state-box" role="alert">
          <h1>{title}</h1>
          <p className="muted">{loadError.message}</p>
          <div className="state-box__actions">
            <Link to="/inquiries" className="btn btn--primary">
              Return to Inquiry Overview
            </Link>
            {loadError.kind === 'generic' && (
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => void loadInquiry()}
              >
                Retry
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!inquiry) return null;

  const transition = NEXT_STATUS_BY_CURRENT[inquiry.status];

  return (
    <div className="page stack-lg">
      <div className="page-header">
        <div>
          <Link to="/inquiries" className="back-link">
            ← Back to inquiries
          </Link>
          <div className="detail-title">
            <StatusBadge status={inquiry.status} />
            <h1>{inquiry.subject}</h1>
          </div>
        </div>
      </div>

      {successMessage && (
        <div className="alert alert--success" role="status">
          {successMessage}
        </div>
      )}

      {actionError && (
        <div
          className={`alert ${staleInquiry ? 'alert--warning' : 'alert--error'} alert--with-action`}
          role="alert"
        >
          <div>
            <strong>
              {staleInquiry
                ? 'Inquiry changed in another tab or session'
                : 'Could not update inquiry'}
            </strong>
            <p>{actionError}</p>
            {staleInquiry && (
              <p className="muted">
                Latest server state: <strong>{formatStatusLabel(staleInquiry.status)}</strong>{' '}
                (updated by {staleInquiry.updatedByName} at{' '}
                {formatTimestamp(staleInquiry.updatedAt)}).
              </p>
            )}
          </div>
          {staleInquiry && (
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={applyLatestState}
            >
              Load Latest State
            </button>
          )}
        </div>
      )}

      <div className="detail-grid">
        <section className="card stack-md">
          <h2>Customer Request</h2>
          <dl className="meta-list">
            <div>
              <dt>Customer</dt>
              <dd>{inquiry.customerName}</dd>
            </div>
            <div>
              <dt>Contact</dt>
              <dd>{inquiry.customerContact}</dd>
            </div>
            <div>
              <dt>Handler</dt>
              <dd>{inquiry.ownerName}</dd>
            </div>
            <div>
              <dt>Last Updated</dt>
              <dd>
                {formatTimestamp(inquiry.updatedAt)} by {inquiry.updatedByName}
              </dd>
            </div>
          </dl>

          <div className="detail-section">
            <h3>Description</h3>
            <p className="detail-description">{inquiry.description}</p>
          </div>

          <div className="detail-section">
            <h3>What Happened Last</h3>
            <p className={inquiry.lastNote ? '' : 'muted'}>
              {inquiry.lastNote ?? 'No status update notes recorded yet.'}
            </p>
          </div>
        </section>

        <aside className="card stack-md">
          <h2>Inquiry Lifecycle</h2>
          <ol className="lifecycle-steps" aria-label="Inquiry lifecycle stages">
            <li className={inquiry.status === 'NEW' ? 'is-current' : 'is-complete'}>
              1. New
            </li>
            <li
              className={
                inquiry.status === 'IN_PROGRESS'
                  ? 'is-current'
                  : inquiry.status === 'RESOLVED'
                    ? 'is-complete'
                    : ''
              }
            >
              2. In Progress
            </li>
            <li className={inquiry.status === 'RESOLVED' ? 'is-current' : ''}>
              3. Resolved
            </li>
          </ol>

          {transition ? (
            <form onSubmit={handleTransition} className="stack-md">
              <div className="field">
                <label htmlFor="lastNote">Handoff / Update Note (optional)</label>
                <textarea
                  id="lastNote"
                  rows={3}
                  maxLength={280}
                  placeholder={transition.notePlaceholder}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  disabled={saving}
                />
                <small className="muted">{note.length}/280 characters</small>
              </div>

              <button
                type="submit"
                className="btn btn--primary btn--full"
                disabled={saving}
              >
                {saving ? 'Updating Status...' : transition.buttonLabel}
              </button>
            </form>
          ) : (
            <div className="resolved-notice">
              <p>
                <strong>This inquiry is resolved.</strong>
              </p>
              <p className="muted">
                Resolved inquiries are locked to preserve a clean audit trail. If
                the customer reaches back out,{' '}
                <Link to="/inquiries/new">log a new follow-up inquiry</Link>.
              </p>
            </div>
          )}

          <p className="version-tag">
            Record version v{inquiry.version} · Created{' '}
            {formatTimestamp(inquiry.createdAt)}
          </p>
        </aside>
      </div>
    </div>
  );
}

