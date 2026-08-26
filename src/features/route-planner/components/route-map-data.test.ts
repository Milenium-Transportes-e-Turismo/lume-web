import type { RouteCalculation } from '../domain/route-calculation';
import { allRouteCoordinates, routeLineFeatures, routeMapMarkers } from './route-map-data';

const calculation = {
  locations: {
    origin: { coordinates: { lat: -18.91, lng: -48.27 }, label: 'Origem' },
    waypoints: [{ coordinates: { lat: -19.1, lng: -47.9 }, label: 'Parada' }],
    destination: { coordinates: { lat: -19.91, lng: -43.93 }, label: 'Destino' },
  },
  route: {
    outbound: {
      geometry: {
        type: 'LineString',
        coordinates: [
          [-48.27, -18.91],
          [-43.93, -19.91],
        ],
      },
    },
    return: {
      geometry: {
        type: 'LineString',
        coordinates: [
          [-43.93, -19.91],
          [-48.27, -18.91],
        ],
      },
    },
  },
  tolls: {
    outbound: {
      items: [{ tollPointId: 'toll-1', name: 'Praça A', longitude: -46, latitude: -19 }],
    },
    return: null,
  },
} as unknown as RouteCalculation;

describe('route map data', () => {
  it('monta linhas distintas de ida e volta', () => {
    expect(
      routeLineFeatures(calculation).features.map((feature) => feature.properties.direction),
    ).toEqual(['outbound', 'return']);
    expect(allRouteCoordinates(calculation)).toHaveLength(4);
  });

  it('monta marcadores de locais e pedágios', () => {
    expect(routeMapMarkers(calculation).map((marker) => marker.kind)).toEqual([
      'origin',
      'waypoint',
      'destination',
      'toll',
    ]);
  });
});
