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
    expect.objectContaining({
      origin: { lat: -18.91, lng: -48.27, address: 'Uberlândia, MG, Brasil' },
    }),
  );
});

it('preserves named, selected waypoints in their submitted order', async () => {
  const data = new FormData();
  data.set('origin', 'Uberlândia');
  data.set('destination', 'São Paulo');
  data.append('waypointKey', 'waypoint-2');
  data.append('waypointKey', 'waypoint-1');
  data.set('waypoint-2', 'Praça da Sé, São Paulo · CEP 01001-000');
  data.set('waypoint-2Lat', '-23.55');
  data.set('waypoint-2Lng', '-46.63');
  data.set('waypoint-1', 'Uberaba');
  await calculateRouteAction({ status: 'idle', result: null, message: null, code: null }, data);
  expect(mockCalculate).toHaveBeenLastCalledWith(
    expect.objectContaining({
      waypoints: [
        { lat: -23.55, lng: -46.63, address: 'Praça da Sé, São Paulo · CEP 01001-000' },
        { address: 'Uberaba' },
      ],
    }),
  );
});
