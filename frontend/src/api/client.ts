import { ApiErrorBody, Inquiry, InquiryStatus, PublicUser } from '../types';

export class ApiClientError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly fields?: Record<string, string>;
  public readonly existingInquiryId?: string;
  public readonly currentInquiry?: Inquiry;

  constructor(
    status: number,
    code: string,
    message: string,
    extra?: {
      fields?: Record<string, string>;
      existingInquiryId?: string;
      currentInquiry?: Inquiry;
    }
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.fields = extra?.fields;
    this.existingInquiryId = extra?.existingInquiryId;
    this.currentInquiry = extra?.currentInquiry;
  }
}

async function requestJson<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers ?? {}),
      },
    });
  } catch {
    throw new ApiClientError(
      0,
      'NETWORK_ERROR',
      'Unable to reach the server. Please check your connection and try again.'
    );
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const parsed = body as ApiErrorBody | null;
    const err = parsed?.error;
    throw new ApiClientError(
      response.status,
      err?.code ?? 'REQUEST_FAILED',
      err?.message ?? `Request failed (${response.status}).`,
      {
        fields: err?.fields,
        existingInquiryId: err?.existingInquiryId,
        currentInquiry: err?.currentInquiry,
      }
    );
  }

  return body as T;
}

export const api = {
  async login(email: string, password: string): Promise<{ user: PublicUser }> {
    return requestJson('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  async logout(): Promise<{ ok: boolean }> {
    return requestJson('/api/auth/logout', { method: 'POST' });
  },

  async getMe(): Promise<{ user: PublicUser }> {
    return requestJson('/api/auth/me');
  },

  async listInquiries(params?: {
    status?: InquiryStatus | '';
    q?: string;
  }): Promise<{ inquiries: Inquiry[] }> {
    const search = new URLSearchParams();
    if (params?.status) search.set('status', params.status);
    if (params?.q?.trim()) search.set('q', params.q.trim());
    const qs = search.toString();
    return requestJson(`/api/inquiries${qs ? `?${qs}` : ''}`);
  },

  async getInquiry(id: string): Promise<{ inquiry: Inquiry }> {
    return requestJson(`/api/inquiries/${encodeURIComponent(id)}`);
  },

  async createInquiry(input: {
    customerName: string;
    customerContact: string;
    subject: string;
    description: string;
  }): Promise<{ inquiry: Inquiry }> {
    return requestJson('/api/inquiries', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async updateInquiryStatus(
    id: string,
    input: {
      status: InquiryStatus;
      expectedVersion: number;
      lastNote?: string;
    }
  ): Promise<{ inquiry: Inquiry }> {
    return requestJson(`/api/inquiries/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },
};

