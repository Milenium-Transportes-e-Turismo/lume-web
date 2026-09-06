'use client';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import type { RouteCalculation } from '../domain/route-calculation';
import { routeLineFeatures, routeMapMarkers, allRouteCoordinates } from './route-map-data';

export function RouteMap({
  calculation,
  onPick,
  points,
}: {
  readonly calculation: RouteCalculation | null;
  readonly onPick: (lat: number, lng: number) => void;
  readonly points: readonly string[];
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const pick = useRef(onPick);
  useEffect(() => {
    pick.current = onPick;
  }, [onPick]);
  useEffect(() => {
    if (!container.current) return;
    const instance = L.map(container.current, { zoomControl: false }).setView([-23.55, -46.63], 9);
    map.current = instance;
    L.control.zoom({ position: 'topright' }).addTo(instance);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(instance);
    instance.on('click', (event: L.LeafletMouseEvent) =>
      pick.current(event.latlng.lat, event.latlng.lng),
    );
    const resize = new ResizeObserver(() => instance.invalidateSize());
    resize.observe(container.current);
    return () => {
      resize.disconnect();
      instance.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const group = L.featureGroup().addTo(instance);
    if (calculation) {
      L.geoJSON(routeLineFeatures(calculation), {
        style: (feature) => ({
          color: feature?.properties.direction === 'return' ? '#e88717' : '#147c70',
          weight: 5,
          dashArray: feature?.properties.direction === 'return' ? '8 6' : undefined,
        }),
      }).addTo(group);
      for (const marker of routeMapMarkers(calculation)) {
        const tooltip = document.createElement('span');
        tooltip.textContent = marker.label;
        L.circleMarker([marker.coordinates[1], marker.coordinates[0]], {
          radius: marker.kind === 'toll' ? 7 : 10,
          color: '#fff',
          weight: 2,
          fillOpacity: 1,
          fillColor: marker.kind === 'toll' ? '#d55d16' : '#147c70',
        })
          .bindTooltip(tooltip)
          .addTo(group);
      }
      const coordinates = allRouteCoordinates(calculation);
      if (coordinates.length)
        instance.fitBounds(L.latLngBounds(coordinates.map(([lng, lat]) => [lat, lng])), {
          padding: [30, 30],
          maxZoom: 14,
        });
    } else {
      for (const [index, point] of points.entries()) {
        const match = point.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
        if (!match) continue;
        L.circleMarker([Number(match[1]), Number(match[2])], {
          radius: 9,
          color: '#147c70',
          fillOpacity: 0.8,
        })
          .bindTooltip(index === 0 ? 'Origem' : index === points.length - 1 ? 'Destino' : 'Parada')
          .addTo(group);
      }
    }
    return () => {
      group.remove();
    };
  }, [calculation, points]);
  return (
    <div
      ref={container}
      aria-label="Mapa interativo da rota"
      className="relative z-0 h-full min-h-[460px] w-full bg-muted"
    />
  );
}
