import { z } from 'zod';

import {
  RoutePlannerError,
  type CalculateRoutePayload,
  type RoutePlannerGateway,
} from '../application/route-planner-gateway';

type Fetcher = typeof fetch;
const coordinatesSchema = z.object({ lat: z.number(), lng: z.number() });
const locationSchema = z.object({
  coordinates: coordinatesSchema,
  label: z.string(),
  address: z.string().nullable(),
  source: z.enum(['coordinates', 'pelias', 'nominatim']),
});
const geometrySchema = z.object({
  type: z.literal('LineString'),
  coordinates: z.array(z.tuple([z.number(), z.number()])),
});
const legSchema = z
  .object({
    direction: z.enum(['outbound', 'return']),
    distanceKm: z.number(),
    durationMinutes: z.number(),
    geometry: geometrySchema,
    segments: z.array(
      z.object({
        sequence: z.number().int(),
        instruction: z.string(),
        distanceKm: z.number(),
        durationMinutes: z.number(),
        roadName: z.string().nullable(),
      }),
    ),
  })
  .passthrough();
const tollItemSchema = z
  .object({
    tollPointId: z.string().uuid(),
    sequence: z.number().int(),
    name: z.string(),
    type: z.enum(['physical-plaza', 'free-flow']),
    road: z.string(),
    kilometer: z.number().nullable(),
    state: z.string(),
    direction: z.string(),
    concessionaire: z.string().nullable(),
    latitude: z.number(),
    longitude: z.number(),
    tariffStatus: z.enum(['found', 'missing']),
    price: z.number().nullable(),
  })
  .passthrough();
const tollSchema = z
  .object({
    count: z.number().int(),
    total: z.number(),
    complete: z.boolean(),
    dataStatus: z.enum(['available', 'unavailable']),
    items: z.array(tollItemSchema),
  })
  .passthrough();
const calculationSchema = z
  .object({
    calculationId: z.string().uuid(),
    calculatedAt: z.string(),
    locations: z.object({
      origin: locationSchema,
      waypoints: z.array(locationSchema),
      destination: locationSchema,
    }),
    travelDate: z.string(),
    roundTrip: z.boolean(),
    route: z.object({
      outbound: legSchema,
      return: legSchema.nullable(),
      total: z.object({
        distanceKm: z.number(),
        durationMinutes: z.number(),
        distanceEstimated: z.boolean(),
        durationEstimated: z.boolean(),
      }),
    }),
    tolls: z.object({
      outbound: tollSchema,
      return: tollSchema.nullable(),
      count: z.number().int(),
      total: z.number(),
      complete: z.boolean(),
      dataStatus: z.enum(['available', 'unavailable']),
    }),
    fuel: z.object({
      consumptionKmPerLiter: z.number(),
      estimatedLiters: z.number(),
      pricePerLiter: z.number(),
      estimatedCost: z.number(),
      estimated: z.literal(true),
    }),
    cost: z
      .object({
        fuel: z.number(),
        tolls: z.number(),
        total: z.number(),
        estimated: z.literal(true),
        complete: z.boolean(),
      })
      .passthrough(),
  })
  .passthrough();

export class TenantApiRoutePlannerGateway implements RoutePlannerGateway {
  constructor(
    private readonly baseUrl: string,
    private readonly accessToken: string,
    private readonly fetcher: Fetcher = fetch,
    private readonly timeoutMs = 30_000,
  ) {}

  async calculate(payload: CalculateRoutePayload) {
    let response: Response;
    try {
      response = await this.fetcher(`${this.baseUrl.replace(/\/+$/, '')}/routing/calculations`, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      throw new RoutePlannerError(
        'service-unavailable',
        'Não foi possível conectar ao núcleo de roteirização.',
      );
    }
    if (!response.ok) await this.throwResponseError(response);
    let value: unknown;
    try {
      value = await response.json();
    } catch {
      throw new RoutePlannerError('invalid-response', 'A API retornou uma resposta inválida.');
    }
    const parsed = calculationSchema.safeParse(value);
    if (!parsed.success) {
      throw new RoutePlannerError(
        'invalid-response',
        'A API retornou um cálculo de rota incompatível.',
      );
    }
    return parsed.data;
  }

  private async throwResponseError(response: Response): Promise<never> {
    let message = `A API respondeu com o status ${response.status}.`;
    let publicCode: string | undefined;
    try {
      const body = (await response.json()) as {
        code?: string;
        message?: string | string[];
      };
      publicCode = body.code;
      if (body.message)
        message = Array.isArray(body.message) ? body.message.join(' ') : body.message;
    } catch {}
    const code =
      response.status === 401
        ? 'unauthorized'
        : response.status === 403
          ? 'forbidden'
          : response.status === 404
            ? 'not-found'
            : response.status < 500
              ? 'validation'
              : 'service-unavailable';
    throw new RoutePlannerError(code, message, publicCode);
  }
}
