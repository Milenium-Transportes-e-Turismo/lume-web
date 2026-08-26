import type { Feature, FeatureCollection, LineString } from 'geojson';

import type { RouteCalculation } from '../domain/route-calculation';

export type RouteDirection = 'outbound' | 'return';

export interface RouteMapMarker {
  readonly key: string;
  readonly label: string;
  readonly kind: 'origin' | 'waypoint' | 'destination' | 'toll';
  readonly coordinates: [number, number];
}

function lineString(coordinates: readonly (readonly [number, number])[]): LineString {
  return {
    type: 'LineString',
    coordinates: coordinates.map(([lng, lat]) => [lng, lat]),
  };
}

export function routeLineFeatures(
  calculation: RouteCalculation,
): FeatureCollection<LineString, { direction: RouteDirection }> {
  const features: Feature<LineString, { direction: RouteDirection }>[] = [
    {
      type: 'Feature',
      properties: { direction: 'outbound' },
      geometry: lineString(calculation.route.outbound.geometry.coordinates),
    },
  ];
  if (calculation.route.return) {
    features.push({
      type: 'Feature',
      properties: { direction: 'return' },
      geometry: lineString(calculation.route.return.geometry.coordinates),
    });
  }
  return { type: 'FeatureCollection', features };
}

export function routeMapMarkers(calculation: RouteCalculation): RouteMapMarker[] {
  const markers: RouteMapMarker[] = [
    {
      key: 'origin',
      label: `Origem: ${calculation.locations.origin.label}`,
      kind: 'origin',
      coordinates: [
        calculation.locations.origin.coordinates.lng,
        calculation.locations.origin.coordinates.lat,
      ],
    },
    ...calculation.locations.waypoints.map((waypoint, index) => ({
      key: `waypoint-${index + 1}`,
      label: `Parada ${index + 1}: ${waypoint.label}`,
      kind: 'waypoint' as const,
      coordinates: [waypoint.coordinates.lng, waypoint.coordinates.lat] as [number, number],
    })),
    {
      key: 'destination',
      label: `Destino: ${calculation.locations.destination.label}`,
      kind: 'destination',
      coordinates: [
        calculation.locations.destination.coordinates.lng,
        calculation.locations.destination.coordinates.lat,
      ],
    },
  ];
  const tolls = [
    ...calculation.tolls.outbound.items.map((item) => ({ item, direction: 'ida' })),
    ...(calculation.tolls.return?.items ?? []).map((item) => ({ item, direction: 'volta' })),
  ];
  markers.push(
    ...tolls.map(({ item, direction }, index) => ({
      key: `toll-${direction}-${item.tollPointId}-${index}`,
      label: `Pedágio (${direction}): ${item.name}`,
      kind: 'toll' as const,
      coordinates: [item.longitude, item.latitude] as [number, number],
    })),
  );
  return markers;
}

export function allRouteCoordinates(calculation: RouteCalculation): [number, number][] {
  const coordinates = [
    ...calculation.route.outbound.geometry.coordinates,
    ...(calculation.route.return?.geometry.coordinates ?? []),
  ];
  return coordinates.map(([lng, lat]) => [lng, lat]);
}
