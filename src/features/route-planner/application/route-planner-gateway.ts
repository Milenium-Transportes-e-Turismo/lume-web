import type { RouteCalculation } from '../domain/route-calculation';

export type RoutePlannerErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'validation'
  | 'not-found'
  | 'invalid-response'
  | 'service-unavailable';

export class RoutePlannerError extends Error {
  constructor(
    readonly code: RoutePlannerErrorCode,
    message: string,
    readonly publicCode?: string,
  ) {
    super(message);
    this.name = 'RoutePlannerError';
  }
}

export interface CalculateRoutePayload {
  readonly origin: RouteLocationPayload;
  readonly destination: RouteLocationPayload;
  readonly waypoints: readonly RouteLocationPayload[];
  readonly roundTrip: boolean;
  readonly vehicle: {
    readonly type: 'car' | 'van' | 'minibus' | 'bus' | 'truck';
    readonly axles: number;
    readonly fuelType: string;
    readonly consumptionKmPerLiter: number;
  };
  readonly fuelPricePerLiter: number;
  readonly travelDate: string;
}

export interface RouteLocationPayload {
  readonly address?: string;
  readonly lat?: number;
  readonly lng?: number;
}

export interface RouteLocationSuggestion {
  readonly id: string;
  readonly label: string;
  readonly lat: number;
  readonly lng: number;
}
export interface RoutePlannerGateway {
  searchLocations(query: string): Promise<readonly RouteLocationSuggestion[]>;
  calculate(payload: CalculateRoutePayload): Promise<RouteCalculation>;
}
