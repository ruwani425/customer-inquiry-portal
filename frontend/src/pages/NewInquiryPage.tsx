import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiClientError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  NewInquiryFields,
  validateNewInquiryForm,
} from '../utils/validation';

export function NewInquiryPage() {
  const navigate = useNavigate();
  const { clearUser } = useAuth();
  const [values, setValues] = useState<NewInquiryFields>({
    customerName: '',
    customerContact: '',
    subject: '',
    description: '',
  });
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof NewInquiryFields, string>>
  >({});
  const [formError, setFormError] = useState<string | null>(null);
  const [duplicateInquiryId, setDuplicateInquiryId] = useState<string | null>(
    null
  );
  const [submitting, setSubmitting] = useState(false);

  function updateField(field: keyof NewInquiryFields, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
    if (formError) setFormError(null);
    if (duplicateInquiryId) setDuplicateInquiryId(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setDuplicateInquiryId(null);

    const clientErrors = validateNewInquiryForm(values);
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      return;
    }

    setSubmitting(true);
    try {
      const { inquiry } = await api.createInquiry({
        customerName: values.customerName.trim(),
        customerContact: values.customerContact.trim(),
        subject: values.subject.trim(),
        description: values.description.trim(),
      });
      navigate(`/inquiries/${inquiry.id}`, { replace: true });
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.status === 401) {
          clearUser();
          return;
        }
        if (err.fields) {
          setFieldErrors(
            err.fields as Partial<Record<keyof NewInquiryFields, string>>
          );
        }
        if (err.code === 'DUPLICATE_INQUIRY' && err.existingInquiryId) {
          setDuplicateInquiryId(err.existingInquiryId);
        }
        setFormError(err.message);
      } else {
        setFormError('Could not save inquiry. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page stack-lg">
      <div className="page-header">
        <div>
          <Link to="/inquiries" className="back-link">
            ← Back to inquiries
          </Link>
          <h1>Log Customer Inquiry</h1>
          <p className="muted">
            New inquiries start in <strong>New</strong> status and are assigned
            to you.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate className="card form-card stack-md">
        {formError && (
          <div className="alert alert--error" role="alert">
            <p>{formError}</p>
            {duplicateInquiryId && (
              <p className="alert__link">
                <Link to={`/inquiries/${duplicateInquiryId}`}>
                  Open existing open inquiry →
                </Link>
              </p>
            )}
          </div>
        )}

        <div className="field">
          <label htmlFor="customerName">Customer Name</label>
          <input
            id="customerName"
            name="customerName"
            type="text"
            placeholder="e.g. Amara Wijesinghe"
            value={values.customerName}
            onChange={(e) => updateField('customerName', e.target.value)}
            aria-invalid={Boolean(fieldErrors.customerName)}
            disabled={submitting}
          />
          {fieldErrors.customerName && (
            <span className="field-error" role="alert">
              {fieldErrors.customerName}
            </span>
          )}
        </div>

        <div className="field">
          <label htmlFor="customerContact">Customer Contact (Email or Phone)</label>
          <input
            id="customerContact"
            name="customerContact"
            type="text"
            placeholder="e.g. amara@example.com or +94 77 412 8890"
            value={values.customerContact}
            onChange={(e) => updateField('customerContact', e.target.value)}
            aria-invalid={Boolean(fieldErrors.customerContact)}
            disabled={submitting}
          />
          {fieldErrors.customerContact && (
            <span className="field-error" role="alert">
              {fieldErrors.customerContact}
            </span>
          )}
        </div>

        <div className="field">
          <label htmlFor="subject">Subject</label>
          <input
            id="subject"
            name="subject"
            type="text"
            placeholder="Short summary of the request"
            value={values.subject}
            onChange={(e) => updateField('subject', e.target.value)}
            aria-invalid={Boolean(fieldErrors.subject)}
            disabled={submitting}
          />
          {fieldErrors.subject && (
            <span className="field-error" role="alert">
              {fieldErrors.subject}
            </span>
          )}
        </div>

        <div className="field">
          <label htmlFor="description">Short Description</label>
          <textarea
            id="description"
            name="description"
            rows={4}
            placeholder="What did the customer ask for, and any important context?"
            value={values.description}
            onChange={(e) => updateField('description', e.target.value)}
            aria-invalid={Boolean(fieldErrors.description)}
            disabled={submitting}
          />
          {fieldErrors.description && (
            <span className="field-error" role="alert">
              {fieldErrors.description}
            </span>
          )}
        </div>

        <div className="form-actions">
          <Link to="/inquiries" className="btn btn--ghost">
            Cancel
          </Link>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={submitting}
          >
            {submitting ? 'Saving Inquiry...' : 'Save Inquiry'}
          </button>
        </div>
      </form>
    </div>
  );
}

