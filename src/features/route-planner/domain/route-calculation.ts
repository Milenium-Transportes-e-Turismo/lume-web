export interface RoutePointCoordinates {
  readonly lat: number;
  readonly lng: number;
}

export interface ResolvedRouteLocation {
  readonly coordinates: RoutePointCoordinates;
  readonly label: string;
  readonly address: string | null;
  readonly source: 'coordinates' | 'nominatim';
}

export interface CalculatedRouteLeg {
  readonly direction: 'outbound' | 'return';
  readonly distanceKm: number;
  readonly durationMinutes: number;
  readonly geometry: {
    readonly type: 'LineString';
    readonly coordinates: readonly (readonly [number, number])[];
  };
  readonly segments: readonly {
    readonly sequence: number;
    readonly instruction: string;
    readonly distanceKm: number;
    readonly durationMinutes: number;
    readonly roadName: string | null;
  }[];
}

export interface TollResult {
  readonly count: number;
  readonly total: number;
  readonly complete: boolean;
  readonly dataStatus: 'available' | 'unavailable';
  readonly items: readonly {
    readonly tollPointId: string;
    readonly sequence: number;
    readonly name: string;
    readonly type: 'physical-plaza' | 'free-flow';
    readonly road: string;
    readonly kilometer: number | null;
    readonly state: string;
    readonly direction: string;
    readonly concessionaire: string | null;
    readonly latitude: number;
    readonly longitude: number;
    readonly tariffStatus: 'found' | 'missing';
    readonly price: number | null;
  }[];
}

export interface RouteCalculation {
  readonly calculationId: string;
  readonly calculatedAt: string;
  readonly locations: {
    readonly origin: ResolvedRouteLocation;
    readonly waypoints: readonly ResolvedRouteLocation[];
    readonly destination: ResolvedRouteLocation;
  };
  readonly travelDate: string;
  readonly roundTrip: boolean;
  readonly route: {
    readonly outbound: CalculatedRouteLeg;
    readonly return: CalculatedRouteLeg | null;
    readonly total: {
      readonly distanceKm: number;
      readonly durationMinutes: number;
      readonly distanceEstimated: boolean;
      readonly durationEstimated: boolean;
    };
  };
  readonly tolls: {
    readonly outbound: TollResult;
    readonly return: TollResult | null;
    readonly count: number;
    readonly total: number;
    readonly complete: boolean;
    readonly dataStatus: 'available' | 'unavailable';
  };
  readonly fuel: {
    readonly consumptionKmPerLiter: number;
    readonly estimatedLiters: number;
    readonly pricePerLiter: number;
    readonly estimatedCost: number;
    readonly estimated: true;
  };
  readonly cost: {
    readonly fuel: number;
    readonly tolls: number;
    readonly total: number;
    readonly estimated: true;
    readonly complete: boolean;
  };
}
