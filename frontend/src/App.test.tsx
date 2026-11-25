import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from './App';
import { AuthProvider } from './context/AuthContext';
import { Inquiry, PublicUser } from './types';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function renderAtRoute(initialPath: string) {
  return render(
    <MemoryRouter
      initialEntries={[initialPath]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </MemoryRouter>
  );
}

const staffUser: PublicUser = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'maya@coffeeninja.local',
  name: 'Maya Perera',
  role: 'staff',
};

const sampleInquiry: Inquiry = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  customerName: 'Amara Wijesinghe',
  customerContact: 'amara@example.com',
  subject: 'Invoice correction',
  description: 'Need updated billing address on invoice #INV-2041.',
  status: 'NEW',
  lastNote: null,
  ownerId: staffUser.id,
  ownerName: staffUser.name,
  updatedById: staffUser.id,
  updatedByName: staffUser.name,
  version: 1,
  createdAt: '2026-11-25T10:00:00.000Z',
  updatedAt: '2026-11-25T10:00:00.000Z',
};

describe('Customer Inquiry UI', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('guides the user with inline validation before submitting and preserves input on error', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input) => {
        const url = String(input);
        if (url.endsWith('/api/auth/me')) {
          return jsonResponse(200, { user: staffUser });
        }
        if (url.endsWith('/api/inquiries')) {
          return jsonResponse(409, {
            error: {
              code: 'DUPLICATE_INQUIRY',
              message:
                'An open inquiry with this contact and subject already exists.',
              existingInquiryId: sampleInquiry.id,
            },
          });
        }
        return jsonResponse(404, { error: { code: 'NOT_FOUND', message: 'Not found' } });
      });

    const user = userEvent.setup();
    renderAtRoute('/inquiries/new');

    const submitBtn = await screen.findByRole('button', {
      name: /save inquiry/i,
    });
    await user.click(submitBtn);

    // Client-side validation stops invalid submission and shows clear field messages
    expect(
      await screen.findByText(/customer name must be at least 2 characters/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/please enter a customer email or phone number/i)
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1); // only /api/auth/me

    // Fill valid values and receive server-side 409 DUPLICATE_INQUIRY
    await user.type(screen.getByLabelText(/customer name/i), 'Amara Wijesinghe');
    await user.type(
      screen.getByLabelText(/customer contact/i),
      'amara@example.com'
    );
    await user.type(screen.getByLabelText(/subject/i), 'Invoice correction');
    await user.type(
      screen.getByLabelText(/short description/i),
      'Need updated billing address on invoice.'
    );
    await user.click(submitBtn);

    expect(
      await screen.findByText(/an open inquiry with this contact and subject already exists/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /open existing open inquiry/i })
    ).toHaveAttribute('href', `/inquiries/${sampleInquiry.id}`);
  });

  it('displays stale-data conflict banner and lets the user load latest state', async () => {
    const latestFromOtherTab: Inquiry = {
      ...sampleInquiry,
      status: 'IN_PROGRESS',
      version: 2,
      lastNote: 'Picked up in another browser tab.',
      updatedAt: '2026-11-25T10:15:00.000Z',
    };

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/api/auth/me')) {
        return jsonResponse(200, { user: staffUser });
      }
      if (url.endsWith(`/api/inquiries/${sampleInquiry.id}`) && !init?.method) {
        return jsonResponse(200, { inquiry: sampleInquiry });
      }
      if (url.endsWith(`/api/inquiries/${sampleInquiry.id}/status`)) {
        return jsonResponse(409, {
          error: {
            code: 'STALE_INQUIRY',
            message:
              'This inquiry was updated elsewhere. Refresh to see the latest status before saving.',
            currentInquiry: latestFromOtherTab,
          },
        });
      }
      return jsonResponse(404, { error: { code: 'NOT_FOUND', message: 'Not found' } });
    });

    const user = userEvent.setup();
    renderAtRoute(`/inquiries/${sampleInquiry.id}`);

    const transitionBtn = await screen.findByRole('button', {
      name: /start handling/i,
    });
    await user.click(transitionBtn);

    expect(
      await screen.findByText(/inquiry changed in another tab or session/i)
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: /load latest state/i })
    );

    await waitFor(() => {
      expect(
        screen.getByText(/picked up in another browser tab\./i)
      ).toBeInTheDocument();
    });
    expect(
      screen.getByRole('button', { name: /mark as resolved/i })
    ).toBeInTheDocument();
  });

  it('renders an access-restricted state when the API returns 403 Forbidden', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/api/auth/me')) {
        return jsonResponse(200, { user: staffUser });
      }
      if (url.includes('/api/inquiries/')) {
        return jsonResponse(403, {
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to view this inquiry.',
          },
        });
      }
      return jsonResponse(404, { error: { code: 'NOT_FOUND', message: 'Not found' } });
    });

    renderAtRoute('/inquiries/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

    expect(
      await screen.findByRole('heading', { name: /access restricted/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/you do not have permission to view this inquiry\./i)
    ).toBeInTheDocument();
  });
});
