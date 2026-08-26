import { TenantApiRoutePlannerGateway } from './tenant-api-route-planner-gateway';

const calculation = {
  calculationId: '11111111-1111-4111-8111-111111111111',
  calculatedAt: '2026-08-18T12:00:00.000Z',
  locations: {
    origin: {
      coordinates: { lat: -18.9186, lng: -48.2772 },
      label: 'Uberlândia',
      address: 'Uberlândia - MG',
      source: 'pelias',
    },
    waypoints: [],
    destination: {
      coordinates: { lat: -19.9167, lng: -43.9345 },
      label: 'Belo Horizonte',
      address: 'Belo Horizonte - MG',
      source: 'pelias',
    },
  },
  travelDate: '2026-08-18',
  roundTrip: false,
  route: {
    outbound: {
      direction: 'outbound',
      distanceKm: 541.7,
      durationMinutes: 425,
      geometry: {
        type: 'LineString',
        coordinates: [
          [-48.2772, -18.9186],
          [-43.9345, -19.9167],
        ],
      },
      segments: [],
    },
    return: null,
    total: {
      distanceKm: 541.7,
      durationMinutes: 425,
      distanceEstimated: true,
      durationEstimated: true,
    },
  },
  tolls: {
    outbound: {
      count: 0,
      total: 0,
      complete: false,
      dataStatus: 'unavailable',
      items: [],
    },
    return: null,
    count: 0,
    total: 0,
    complete: false,
    dataStatus: 'unavailable',
  },
  fuel: {
    consumptionKmPerLiter: 3.1,
    estimatedLiters: 174.742,
    pricePerLiter: 6.2,
    estimatedCost: 1083.4,
    estimated: true,
  },
  cost: {
    fuel: 1083.4,
    tolls: 0,
    total: 1083.4,
    estimated: true,
    complete: false,
  },
};

describe('TenantApiRoutePlannerGateway', () => {
  it('envia o cálculo somente para a Tenant API autenticada', async () => {
    const fetcher = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>().mockResolvedValue(
      new Response(JSON.stringify(calculation), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const gateway = new TenantApiRoutePlannerGateway(
      'https://tenant-api.test/api/v1',
      'access-token',
      fetcher,
    );

    const result = await gateway.calculate({
      origin: { address: 'Uberlândia - MG' },
      destination: { address: 'Belo Horizonte - MG' },
      waypoints: [],
      roundTrip: false,
      vehicle: {
        type: 'bus',
        axles: 3,
        fuelType: 'diesel',
        consumptionKmPerLiter: 3.1,
      },
      fuelPricePerLiter: 6.2,
      travelDate: '2026-08-18',
    });

    expect(result.route.total.distanceKm).toBe(541.7);
    expect(fetcher).toHaveBeenCalledWith(
      'https://tenant-api.test/api/v1/routing/calculations',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer access-token' }),
      }),
    );
  });

  it('recusa resposta fora do contrato público', async () => {
    const fetcher = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>().mockResolvedValue(
      new Response(JSON.stringify({ route: {} }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const gateway = new TenantApiRoutePlannerGateway(
      'https://tenant-api.test/api/v1',
      'access-token',
      fetcher,
    );

    await expect(
      gateway.calculate({
        origin: { lat: -18.9186, lng: -48.2772 },
        destination: { lat: -19.9167, lng: -43.9345 },
        waypoints: [],
        roundTrip: false,
        vehicle: {
          type: 'bus',
          axles: 3,
          fuelType: 'diesel',
          consumptionKmPerLiter: 3.1,
        },
        fuelPricePerLiter: 6.2,
        travelDate: '2026-08-18',
      }),
    ).rejects.toMatchObject({ code: 'invalid-response' });
  });
});
