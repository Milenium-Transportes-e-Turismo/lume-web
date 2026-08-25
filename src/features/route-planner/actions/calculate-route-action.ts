'use server';

import { RoutePlannerError } from '../application/route-planner-gateway';
import type { RouteCalculation } from '../domain/route-calculation';
import { executeAuthenticatedRoutePlannerMutation } from '../server/execute-authenticated-route-planner-request';

export type RoutePlannerActionState = {
  readonly status: 'idle' | 'success' | 'error';
  readonly result: RouteCalculation | null;
  readonly message: string | null;
  readonly code: string | null;
};

export const INITIAL_ROUTE_PLANNER_STATE: RoutePlannerActionState = {
  status: 'idle',
  result: null,
  message: null,
  code: null,
};

function text(data: FormData, key: string): string {
  const value = data.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function decimal(data: FormData, key: string): number {
  return Number(text(data, key).replace(',', '.'));
}

export async function calculateRouteAction(
  _previous: RoutePlannerActionState,
  data: FormData,
): Promise<RoutePlannerActionState> {
  const waypoints = data
    .getAll('waypoint')
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((address) => ({ address }));
  try {
    const result = await executeAuthenticatedRoutePlannerMutation((gateway) =>
      gateway.calculate({
        origin: { address: text(data, 'origin') },
        destination: { address: text(data, 'destination') },
        waypoints,
        roundTrip: data.get('roundTrip') === 'on',
        vehicle: {
          type: text(data, 'vehicleType') as 'car' | 'van' | 'minibus' | 'bus' | 'truck',
          axles: decimal(data, 'axles'),
          fuelType: text(data, 'fuelType'),
          consumptionKmPerLiter: decimal(data, 'consumptionKmPerLiter'),
        },
        fuelPricePerLiter: decimal(data, 'fuelPricePerLiter'),
        travelDate: text(data, 'travelDate'),
      }),
    );
    return { status: 'success', result, message: null, code: null };
  } catch (error) {
    return {
      status: 'error',
      result: null,
      message:
        error instanceof RoutePlannerError ? error.message : 'Não foi possível calcular a rota.',
      code:
        error instanceof RoutePlannerError ? (error.publicCode ?? error.code) : 'UNEXPECTED_ERROR',
    };
  }
}
