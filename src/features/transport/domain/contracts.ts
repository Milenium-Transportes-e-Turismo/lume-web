import { z } from 'zod';

const nullableText = z.string().nullable();
const base = z.object({ id: z.string(), version: z.number().int().nonnegative() }).passthrough();
export const companySchema = base.extend({
  registrationId: z.string().optional(),
  cnpj: z.string(),
  legalName: z.string(),
  tradeName: nullableText,
  active: z.boolean(),
});
export const fleetSchema = base.extend({
  fleetCode: z.string(),
  supplierRegistrationId: z.string(),
  plate: nullableText.optional(),
  serviceTypeId: nullableText.optional(),
  vehicleTypeId: nullableText.optional(),
  categoryId: nullableText.optional(),
  axles: z.number().nullable().optional(),
  passengers: z.number().nullable().optional(),
  model: nullableText.optional(),
  provider: nullableText.optional(),
  externalVehicleId: nullableText.optional(),
  active: z.boolean(),
});
export const catalogSchema = base.extend({
  kind: z.enum(['service-type', 'vehicle-type', 'category']),
  code: z.string(),
  name: z.string(),
  active: z.boolean(),
});
export const affiliationSchema = base.extend({
  registrationId: z.string(),
  supplierRegistrationId: z.string(),
  role: z.enum(['client', 'employee']),
  validFrom: z.string(),
  validUntil: nullableText.optional(),
});
export const conditionSchema = z
  .object({
    id: z.string(),
    validFrom: z.string(),
    validUntil: nullableText.optional(),
    period: z.enum(['daily', 'monthly']),
    allowanceKm: nullableText.optional(),
    includeGarage: z.boolean(),
    transitionMonth: nullableText.optional(),
    transitionAllowanceKm: nullableText.optional(),
  })
  .passthrough();
export const contractSchema = base.extend({
  clientRegistrationId: z.string(),
  supplierRegistrationId: z.string(),
  code: z.string(),
  name: z.string(),
  modality: z.enum(['continuous', 'occasional', 'rental']),
  validFrom: z.string(),
  validUntil: nullableText.optional(),
  status: z.enum(['draft', 'active', 'suspended', 'ended']),
  conditions: z.array(conditionSchema).optional(),
});
export const assignmentSchema = z
  .object({
    id: z.string(),
    contractId: z.string(),
    validFrom: z.string(),
    validUntil: nullableText.optional(),
  })
  .passthrough();
export const routeSchema = base.extend({
  provider: z.string(),
  externalId: nullableText.optional(),
  name: z.string(),
  assignments: z.array(assignmentSchema).optional(),
});
export const recordSchema = base.extend({
  externalId: z.string(),
  vehicleExternalId: z.string(),
  driverExternalId: nullableText.optional(),
  driverName: nullableText.optional(),
  customerExternalId: nullableText.optional(),
  customerName: nullableText.optional(),
  fleet: nullableText,
  routeExternalId: nullableText,
  routeName: nullableText,
  startedAt: nullableText,
  endedAt: nullableText,
  startKm: nullableText,
  endKm: nullableText,
  reportedKm: nullableText,
  source: z.literal('DRIVER_REPORTED'),
  mappingStatus: z.string().optional(),
  history: z.array(z.record(z.string(), z.unknown())).optional(),
});
export const issueSchema = base.extend({
  recordId: z.string(),
  vehicleExternalId: z.string(),
  code: z.string(),
  status: z.enum(['OPEN', 'RESOLVED']),
  verificationState: z.enum(['VERIFIED', 'PENDING', 'UNAVAILABLE']),
  context: z.record(z.string(), z.unknown()),
  guidance: z.string(),
  detectedAt: z.string(),
  lastVerifiedAt: nullableText,
  history: z.array(z.record(z.string(), z.unknown())).optional(),
});
export const importSchema = base.extend({
  status: z.string(),
  from: z.string(),
  to: z.string(),
  vehicleIds: z.array(z.string()),
  vehicleIndex: z.number(),
  skip: z.number(),
  imported: z.number(),
  rejected: z.number().optional(),
  lastError: nullableText,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export const integrationSchema = base.extend({
  id: z.string().nullable(),
  provider: z.literal('avic'),
  enabled: z.boolean(),
  configured: z.boolean(),
  settings: z.object({
    externalIdField: z.string(),
    sourceUtcOffset: z.string(),
    scheduleTime: z.string(),
    timezone: z.string(),
    lookbackDays: z.number(),
    maxTripKm: z.number().nullable(),
    maxGapKm: z.number().nullable(),
    sequenceComplete: z.boolean(),
  }),
  activationRequirements: z.array(z.string()),
});
export const summarySchema = z.object({
  contractId: z.string(),
  unmappedRecords: z.number().optional(),
  source: z.literal('DRIVER_REPORTED'),
  periods: z.array(
    z.object({
      period: z.string(),
      version: z.number().optional(),
      periodicity: z.enum(['DAILY', 'MONTHLY']),
      state: z.enum(['OPEN', 'CLOSED', 'UNCONFIGURED']),
      contractedKm: nullableText,
      registeredKm: nullableText,
      differenceKm: nullableText,
      dataStatus: z.string(),
    }),
  ),
});
export const catalogSchemas = {
  companies: companySchema,
  fleet: fleetSchema,
  catalogs: catalogSchema,
  affiliations: affiliationSchema,
  contracts: contractSchema,
  routes: routeSchema,
};
export type CatalogResource = keyof typeof catalogSchemas;
export type CatalogItem = z.infer<(typeof catalogSchemas)[CatalogResource]>;
export type TransportIssue = z.infer<typeof issueSchema>;
export type TransportRecord = z.infer<typeof recordSchema>;
export type TransportIntegration = z.infer<typeof integrationSchema>;
export type TransportSummary = z.infer<typeof summarySchema>;

export class TransportError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code: string,
  ) {
    super(message);
  }
}

const idPattern = '[a-zA-Z0-9-]{1,100}';
const catalogPattern = '(companies|fleet|catalogs|affiliations|contracts|routes)';
export function allowedTransportPath(path: string, method: string): boolean {
  const id = idPattern;
  const patterns: Record<string, string[]> = {
    GET: [
      'contracts/candidates',
      catalogPattern + '(?:/' + id + ')?',
      'imports(?:/' + id + '(?:/rejections)?)?',
      'records(?:/' + id + ')?',
      'issues(?:/' + id + ')?',
      'analysis',
      'integration',
      'summary',
      'lookups/registrations(?:/' + id + ')?',
    ],
    POST: [
      catalogPattern,
      'catalogs/initialize',
      'contracts/' + id + '/conditions',
      'routes/' + id + '/assignments',
      'fleet/' + id + '/ownerships',
      'imports(?:/' + id + '/resume)?',
      'issues/' + id + '/justifications',
      'analysis',
      'summary/period-state',
    ],
    PATCH: [
      catalogPattern + '/' + id,
      'contracts/' + id + '/conditions/' + id,
      'routes/' + id + '/assignments/' + id,
      'fleet/' + id + '/ownerships/' + id,
      'integration',
    ],
    DELETE: ['companies/' + id],
  };
  return (patterns[method] ?? []).some((pattern) => new RegExp('^(?:' + pattern + ')$').test(path));
}

export function transportResponseSchema(path: string, method: string): z.ZodType {
  const [resource, id] = path.split('/');
  if (path === 'contracts/candidates')
    return z.object({
      items: z.array(
        base.extend({
          clientRegistrationId: z.string(),
          code: z.string(),
          name: z.string(),
          status: z.string(),
          validFrom: z.string(),
          validUntil: nullableText,
        }),
      ),
      total: z.number(),
      page: z.number(),
      pageSize: z.number(),
    });
  if (path.endsWith('/rejections'))
    return z.object({
      items: z.array(
        z.object({
          id: z.string(),
          vehicleIndex: z.number(),
          pageSkip: z.number(),
          position: z.number(),
          reason: z.string(),
          createdAt: z.string(),
        }),
      ),
      nextCursor: nullableText,
    });
  if (path === 'catalogs/initialize') return z.object({ initialized: z.literal(true) });
  if (path === 'summary/period-state')
    return z.object({ id: z.string(), version: z.number(), state: z.string() }).passthrough();
  if (resource in catalogSchemas) {
    const schema = catalogSchemas[resource as CatalogResource];
    return method === 'GET' && !id
      ? z.object({
          items: z.array(schema),
          total: z.number(),
          page: z.number(),
          pageSize: z.number(),
        })
      : schema;
  }
  if (path.startsWith('lookups/registrations')) {
    const registration = z.object({
      id: z.string(),
      displayName: z.string(),
      type: z.enum(['pf', 'pj']),
    });
    return path === 'lookups/registrations'
      ? z.object({ items: z.array(registration), total: z.number() })
      : registration;
  }
  if (resource === 'integration')
    return method === 'GET'
      ? integrationSchema
      : integrationSchema.pick({ id: true, version: true, enabled: true, settings: true });
  if (resource === 'summary') return summarySchema;
  if (resource === 'analysis') {
    const job = z.object({
      id: z.string(),
      status: z.string(),
      processed: z.number(),
      lastError: nullableText.optional(),
      createdAt: z.string().optional(),
    });
    return method === 'GET' ? z.object({ items: z.array(job), nextCursor: nullableText }) : job;
  }
  const schema =
    resource === 'issues' ? issueSchema : resource === 'records' ? recordSchema : importSchema;
  return method === 'GET' && !id
    ? z.object({ items: z.array(schema), nextCursor: nullableText })
    : schema;
}
