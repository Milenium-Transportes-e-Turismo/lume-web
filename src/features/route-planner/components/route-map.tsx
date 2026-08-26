'use client';

import { LngLatBounds, Map as MapLibreMap, Marker, NavigationControl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState } from 'react';

import type { RouteCalculation } from '../domain/route-calculation';
import {
  allRouteCoordinates,
  routeLineFeatures,
  routeMapMarkers,
  type RouteMapMarker,
} from './route-map-data';

const MARKER_COLORS: Record<RouteMapMarker['kind'], string> = {
  origin: '#16a34a',
  waypoint: '#2563eb',
  destination: '#dc2626',
  toll: '#f59e0b',
};

const MARKER_TEXT: Record<RouteMapMarker['kind'], string> = {
  origin: 'O',
  waypoint: 'P',
  destination: 'D',
  toll: '$',
};

function markerElement(marker: RouteMapMarker): HTMLDivElement {
  const element = document.createElement('div');
  element.setAttribute('role', 'img');
  element.setAttribute('aria-label', marker.label);
  element.title = marker.label;
  element.textContent = MARKER_TEXT[marker.kind];
  Object.assign(element.style, {
    alignItems: 'center',
    background: MARKER_COLORS[marker.kind],
    border: '2px solid white',
    borderRadius: '9999px',
    boxShadow: '0 1px 5px rgb(0 0 0 / 35%)',
    color: 'white',
    display: 'flex',
    fontSize: marker.kind === 'toll' ? '10px' : '11px',
    fontWeight: '700',
    height: marker.kind === 'toll' ? '20px' : '24px',
    justifyContent: 'center',
    width: marker.kind === 'toll' ? '20px' : '24px',
  });
  return element;
}

export function RouteMap({
  calculation,
  styleUrl,
}: {
  readonly calculation: RouteCalculation;
  readonly styleUrl: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapError, setMapError] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    setMapError(false);
    const map = new MapLibreMap({
      container: containerRef.current,
      style: styleUrl,
      center: [
        calculation.locations.origin.coordinates.lng,
        calculation.locations.origin.coordinates.lat,
      ],
      zoom: 7,
    });
    const markers: Marker[] = [];
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    map.on('error', () => setMapError(true));
    map.on('load', () => {
      map.addSource('lume-route', {
        type: 'geojson',
        data: routeLineFeatures(calculation),
      });
      map.addLayer({
        id: 'lume-route-outbound',
        type: 'line',
        source: 'lume-route',
        filter: ['==', ['get', 'direction'], 'outbound'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#059669', 'line-opacity': 0.9, 'line-width': 6 },
      });
      map.addLayer({
        id: 'lume-route-return',
        type: 'line',
        source: 'lume-route',
        filter: ['==', ['get', 'direction'], 'return'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#f59e0b',
          'line-dasharray': [2, 2],
          'line-opacity': 0.9,
          'line-width': 4,
        },
      });
      for (const marker of routeMapMarkers(calculation)) {
        markers.push(
          new Marker({ element: markerElement(marker) }).setLngLat(marker.coordinates).addTo(map),
        );
      }
      const bounds = new LngLatBounds();
      for (const coordinate of allRouteCoordinates(calculation)) bounds.extend(coordinate);
      if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 48, maxZoom: 14, duration: 0 });
    });
    return () => {
      for (const marker of markers) marker.remove();
      map.remove();
    };
  }, [calculation, styleUrl]);

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        className="h-[420px] w-full overflow-hidden rounded-xl border bg-muted md:h-[520px]"
        aria-label="Mapa da rota calculada"
      />
      {mapError && (
        <p role="alert" className="text-sm text-destructive">
          O mapa de fundo não pôde ser carregado. O cálculo e os dados da rota continuam válidos.
        </p>
      )}
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
        <span>
          <strong className="text-emerald-600">Linha verde:</strong> ida
        </span>
        {calculation.route.return && (
          <span>
            <strong className="text-amber-600">Linha tracejada:</strong> volta
          </span>
        )}
        <span>O: origem</span>
        <span>P: parada</span>
        <span>D: destino</span>
        <span>$: pedágio</span>
      </div>
    </div>
  );
}
