'use server';

import { RoutePlannerError, type RouteLocationPayload } from '../application/route-planner-gateway';
import type { RouteCalculation } from '../domain/route-calculation';
import { executeAuthenticatedRoutePlannerMutation } from '../server/execute-authenticated-route-planner-request';

export type RoutePlannerActionState = {
  readonly status: 'idle' | 'success' | 'error';
  readonly result: RouteCalculation | null;
  readonly message: string | null;
  readonly code: string | null;
};

function text(data: FormData, key: string): string {
  const value = data.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function decimal(data: FormData, key: string): number {
  return Number(text(data, key).replace(',', '.'));
}

function location(value: string): RouteLocationPayload {
  const match = value.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (match) return { lat: Number(match[1]), lng: Number(match[2]) };
  return { address: value };
}

function selectedLocation(data: FormData, key: string): RouteLocationPayload {
  const lat = text(data, key + 'Lat');
  const lng = text(data, key + 'Lng');
  if (lat !== '' && lng !== '') {
    const latitude = Number(lat);
    const longitude = Number(lng);
    if (
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      Math.abs(latitude) <= 90 &&
      Math.abs(longitude) <= 180
    ) {
      return { lat: latitude, lng: longitude, address: text(data, key) };
    }
    throw new RoutePlannerError('validation', 'Selecione um local válido.');
  }
  return location(text(data, key));
}

export async function calculateRouteAction(
  _previous: RoutePlannerActionState,
  data: FormData,
): Promise<RoutePlannerActionState> {
  const legacyWaypoints = data
    .getAll('waypoint')
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean)
    .map(location);
  const waypointKeys = data
    .getAll('waypointKey')
    .filter((key): key is string => typeof key === 'string');
  try {
    const result = await executeAuthenticatedRoutePlannerMutation((gateway) =>
      gateway.calculate({
        origin: selectedLocation(data, 'origin'),
        destination: selectedLocation(data, 'destination'),
        waypoints: waypointKeys.length
          ? waypointKeys.map((key) => selectedLocation(data, key))
          : legacyWaypoints,
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
