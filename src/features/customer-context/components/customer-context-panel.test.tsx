import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  decideCustomerProfileSuggestionAction,
  loadCustomerContextAction,
  loadCustomerContextDetailsAction,
} from '../actions';
import type { CustomerContextSummary, CustomerProfileSuggestion } from '../domain';
import { CustomerContextPanel } from './customer-context-panel';

jest.mock('../actions', () => ({
  decideCustomerProfileSuggestionAction: jest.fn(),
  loadCustomerContextAction: jest.fn(),
  loadCustomerContextDetailsAction: jest.fn(),
}));

const sessionId = '00000000-0000-4000-8000-000000000101';
const suggestion: CustomerProfileSuggestion = {
  id: '00000000-0000-4000-8000-000000000102',
  whatsappContactId: '00000000-0000-4000-8000-000000000103',
  registrationId: null,
  serviceSessionId: sessionId,
  agentExecutionId: '00000000-0000-4000-8000-000000000104',
  profileKey: 'preferred-contact-channel',
  suggestedValue: 'WhatsApp',
  rationale: 'Cliente pediu retorno por mensagem.',
  origin: { messageId: 'message-1' },
  status: 'pending',
  reviewedByUserId: null,
  reviewedAt: null,
  reviewReason: null,
  createdAt: '2026-08-29T10:00:00.000Z',
  updatedAt: '2026-08-29T10:00:00.000Z',
};
const summary: CustomerContextSummary = {
  serviceSessionId: sessionId,
  whatsappContactId: suggestion.whatsappContactId,
  identity: {
    registrationId: '00000000-0000-4000-8000-000000000105',
    kind: 'personal',
    displayName: 'Cliente Teste',
    confirmedAt: '2026-08-28T10:00:00.000Z',
  },
  relatedCompanies: [],
  approvedProfile: [],
  recentServices: [],
  recentQuotes: [],
  pending: [],
  limits: {
    relatedCompanies: 5,
    approvedProfile: 10,
    recentServices: 5,
    recentQuotes: 5,
    pending: 10,
  },
};

describe('CustomerContextPanel', () => {
  beforeEach(() => {
    jest.mocked(loadCustomerContextAction).mockResolvedValue({
      success: true,
      summary,
      suggestions: [suggestion],
    });
    jest.mocked(loadCustomerContextDetailsAction).mockResolvedValue({
      success: true,
      details: { section: 'profile', items: [], limit: 20, hasMore: false },
    });
    jest.mocked(decideCustomerProfileSuggestionAction).mockResolvedValue({
      success: true,
      message: 'Sugestão aprovada e incorporada ao perfil.',
      summary,
      suggestions: [{ ...suggestion, status: 'approved' }],
    });
  });

  afterEach(() => jest.clearAllMocks());

  it('loads native context on demand, filters dynamically and sends a versioned decision', async () => {
    const user = userEvent.setup();
    render(<CustomerContextPanel serviceSessionId={sessionId} nativeSession canView canRespond />);

    expect(loadCustomerContextAction).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Carregar contexto' }));
    expect(await screen.findByText('Cliente Teste')).toBeInTheDocument();
    expect(screen.getByText('WhatsApp')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Buscar sugestões de perfil'), 'inexistente');
    expect(screen.getByText('Nenhuma sugestão corresponde aos filtros.')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Buscar sugestões de perfil'));
    await user.click(screen.getByRole('button', { name: 'Aprovar' }));

    await waitFor(() =>
      expect(decideCustomerProfileSuggestionAction).toHaveBeenCalledWith(
        expect.objectContaining({
          serviceSessionId: sessionId,
          suggestionId: suggestion.id,
          commandId: expect.stringMatching(/^[0-9a-f-]{36}$/u),
          expectedUpdatedAt: suggestion.updatedAt,
          decision: 'approved',
        }),
      ),
    );
  });

  it('does not call CustomerContext endpoints for a legacy projection', () => {
    render(
      <CustomerContextPanel
        serviceSessionId={sessionId}
        nativeSession={false}
        canView
        canRespond
      />,
    );

    expect(screen.getByText(/somente para sessões nativas/iu)).toBeInTheDocument();
    expect(loadCustomerContextAction).not.toHaveBeenCalled();
  });
});
