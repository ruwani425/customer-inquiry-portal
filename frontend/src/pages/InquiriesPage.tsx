import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiClientError } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { Inquiry, InquiryStatus } from '../types';
import { formatTimestamp } from '../utils/validation';

const STATUS_OPTIONS: Array<{ value: '' | InquiryStatus; label: string }> = [
  { value: '', label: 'All' },
  { value: 'NEW', label: 'New' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'RESOLVED', label: 'Resolved' },
];

export function InquiriesPage() {
  const { user, clearUser } = useAuth();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [statusFilter, setStatusFilter] = useState<'' | InquiryStatus>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadInquiries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listInquiries({
        status: statusFilter,
        q: searchQuery,
      });
      setInquiries(data.inquiries);
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.status === 401) {
          clearUser();
          return;
        }
        setError(err.message);
      } else {
        setError('Could not load inquiries. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery, clearUser]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadInquiries();
    }, 150);
    return () => window.clearTimeout(timer);
  }, [loadInquiries]);

  const hasActiveFilters = Boolean(statusFilter || searchQuery.trim());

  return (
    <div className="page stack-lg">
      <div className="page-header">
        <div>
          <h1>Customer Inquiries</h1>
          <p className="muted">
            {user?.role === 'supervisor'
              ? 'Viewing all team inquiries as Supervisor.'
              : 'Showing inquiries assigned to you.'}
          </p>
        </div>
        <Link to="/inquiries/new" className="btn btn--primary">
          + Log New Inquiry
        </Link>
      </div>

      <section className="card filter-bar" aria-label="Filter inquiries">
        <div className="status-tabs" role="tablist" aria-label="Status filter">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              type="button"
              role="tab"
              aria-selected={statusFilter === opt.value}
              className={`tab-btn ${statusFilter === opt.value ? 'tab-btn--active' : ''}`}
              onClick={() => setStatusFilter(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="search-box">
          <label htmlFor="inquiry-search" className="sr-only">
            Search inquiries
          </label>
          <input
            id="inquiry-search"
            type="search"
            placeholder="Search customer, contact, subject, or note..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {hasActiveFilters && (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => {
                setStatusFilter('');
                setSearchQuery('');
              }}
            >
              Clear
            </button>
          )}
        </div>
      </section>

      {error && (
        <div className="alert alert--error alert--with-action" role="alert">
          <span>{error}</span>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => void loadInquiries()}
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="card state-box" aria-busy="true">
          <div className="spinner" aria-hidden="true" />
          <p>Loading inquiries...</p>
        </div>
      ) : !error && inquiries.length === 0 ? (
        <div className="card state-box">
          <h2>
            {hasActiveFilters
              ? 'No matching inquiries'
              : 'No inquiries logged yet'}
          </h2>
          <p className="muted">
            {hasActiveFilters
              ? 'Try clearing your search term or switching the status filter.'
              : 'Record a customer inquiry to start tracking who is handling it and what happened last.'}
          </p>
          {hasActiveFilters ? (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setStatusFilter('');
                setSearchQuery('');
              }}
            >
              Reset filters
            </button>
          ) : (
            <Link to="/inquiries/new" className="btn btn--primary">
              + Log First Inquiry
            </Link>
          )}
        </div>
      ) : (
        <div className="inquiry-list">
          {inquiries.map((inquiry) => (
            <Link
              key={inquiry.id}
              to={`/inquiries/${inquiry.id}`}
              className="card inquiry-row"
            >
              <div className="inquiry-row__top">
                <div className="inquiry-row__title">
                  <StatusBadge status={inquiry.status} />
                  <h2>{inquiry.subject}</h2>
                </div>
                <span className="inquiry-row__time">
                  Updated {formatTimestamp(inquiry.updatedAt)}
                </span>
              </div>

              <div className="inquiry-row__meta">
                <span>
                  <strong>{inquiry.customerName}</strong> ({inquiry.customerContact})
                </span>
                <span>Handler: {inquiry.ownerName}</span>
              </div>

              {inquiry.lastNote ? (
                <p className="inquiry-row__note">
                  <strong>Last update:</strong> {inquiry.lastNote}
                </p>
              ) : (
                <p className="inquiry-row__desc">{inquiry.description}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

