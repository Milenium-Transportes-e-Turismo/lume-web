import {
  allowedTransportPath,
  recordSchema,
  summarySchema,
  transportResponseSchema,
} from './contracts';

describe('Transport API boundary', () => {
  test.each([
    ['GET', 'records/11111111-1111-4111-8111-111111111111'],
    ['GET', 'lookups/registrations/11111111-1111-4111-8111-111111111111'],
    ['POST', 'fleet/11111111-1111-4111-8111-111111111111/ownerships'],
    [
      'PATCH',
      'contracts/11111111-1111-4111-8111-111111111111/conditions/22222222-2222-4222-8222-222222222222',
    ],
    ['POST', 'issues/11111111-1111-4111-8111-111111111111/justifications'],
  ])('accepts the published %s %s operation', (method, path) =>
    expect(allowedTransportPath(path, method)).toBe(true),
  );
  test.each([
    ['PATCH', 'records/11111111-1111-4111-8111-111111111111'],
    ['POST', 'issues/11111111-1111-4111-8111-111111111111/resolve'],
    ['DELETE', 'fleet/11111111-1111-4111-8111-111111111111'],
    ['GET', '../users'],
    ['GET', 'https://avic.example/api'],
    ['POST', 'records'],
    ['GET', 'records/%2e%2e'],
  ])('rejects unsupported %s %s operation', (method, path) =>
    expect(allowedTransportPath(path, method)).toBe(false),
  );

  const record = {
    id: 'r1',
    version: 1,
    externalId: '9223372036854775807',
    vehicleExternalId: '6',
    fleet: '99660',
    routeExternalId: '231',
    routeName: 'Linha',
    startedAt: null,
    endedAt: null,
    startKm: '638533.000',
    endKm: '638612.000',
    reportedKm: '79.000',
    source: 'DRIVER_REPORTED',
    mappingStatus: 'REVIEW_MAPPING',
  };
  it('keeps large external IDs and KM as strings and missing timestamps as null', () => {
    expect(recordSchema.parse(record)).toEqual(record);
    expect(recordSchema.safeParse({ ...record, externalId: 9223372036854775807 }).success).toBe(
      false,
    );
    expect(recordSchema.safeParse({ ...record, startKm: 638533 }).success).toBe(false);
  });
  it('preserves absent allowance and unverified comparison instead of coercing to zero', () => {
    const response = summarySchema.parse({
      contractId: 'c1',
      source: 'DRIVER_REPORTED',
      periods: [
        {
          period: '2026-07',
          periodicity: 'MONTHLY',
          state: 'OPEN',
          contractedKm: null,
          registeredKm: '152',
          differenceKm: null,
          dataStatus: 'INSUFFICIENT_DATA',
        },
      ],
    });
    expect(response.periods[0].contractedKm).toBeNull();
    expect(response.periods[0].differenceKm).toBeNull();
  });
  it('validates paginated cursor responses and fails on missing authoritative fields', () => {
    const schema = transportResponseSchema('records', 'GET');
    expect(schema.safeParse({ items: [record], nextCursor: null }).success).toBe(true);
    expect(schema.safeParse({ items: [record] }).success).toBe(false);
  });
  it('accepts inactive configuration without inventing activation readiness after PATCH', () => {
    const settings = {
      externalIdField: '',
      sourceUtcOffset: '',
      scheduleTime: '04:00',
      timezone: 'America/Sao_Paulo',
      lookbackDays: 7,
      maxTripKm: null,
      maxGapKm: null,
      sequenceComplete: false,
    };
    expect(
      transportResponseSchema('integration', 'GET').safeParse({
        id: null,
        provider: 'avic',
        version: 0,
        enabled: false,
        configured: false,
        settings,
        activationRequirements: ['Confirme o ID'],
      }).success,
    ).toBe(true);
    const mutation = transportResponseSchema('integration', 'PATCH').parse({
      id: 'i1',
      version: 1,
      enabled: false,
      settings,
    });
    expect(mutation).not.toHaveProperty('configured');
  });
});
