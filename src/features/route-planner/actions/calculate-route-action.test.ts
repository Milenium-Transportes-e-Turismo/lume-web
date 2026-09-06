import { calculateRouteAction } from './calculate-route-action';
const mockCalculate = jest.fn().mockResolvedValue({ calculationId: 'test' });
jest.mock('../server/execute-authenticated-route-planner-request', () => ({
  executeAuthenticatedRoutePlannerMutation: (
    operation: (gateway: { calculate: typeof mockCalculate }) => unknown,
  ) => operation({ calculate: mockCalculate }),
}));
it('sends map coordinates and ordered address stops through the authenticated API gateway', async () => {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    origin: '-18.918000, -48.278000',
    destination: 'São Paulo - SP',
    vehicleType: 'bus',
    axles: '3',
    fuelType: 'diesel',
    consumptionKmPerLiter: '3.1',
    fuelPricePerLiter: '6.20',
    travelDate: '2026-09-07',
  }))
    form.set(key, value);
  form.append('waypoint', '-20.100000, -47.100000');
  form.append('waypoint', 'Ribeirão Preto - SP');
  await calculateRouteAction({ status: 'idle', result: null, message: null, code: null }, form);
  expect(mockCalculate).toHaveBeenCalledWith(
    expect.objectContaining({
      origin: { lat: -18.918, lng: -48.278 },
      destination: { address: 'São Paulo - SP' },
      waypoints: [{ lat: -20.1, lng: -47.1 }, { address: 'Ribeirão Preto - SP' }],
    }),
  );
});

it('uses coordinates from the selected suggestion instead of geocoding its label again', async () => {
  const data = new FormData();
  data.set('origin', 'Uberlândia, MG, Brasil');
  data.set('originLat', '-18.91');
  data.set('originLng', '-48.27');
  data.set('destination', 'São Paulo, SP');
  await calculateRouteAction({ status: 'idle', result: null, message: null, code: null }, data);
  expect(mockCalculate).toHaveBeenLastCalledWith(
    expect.objectContaining({ origin: { lat: -18.91, lng: -48.27 } }),
  );
});
