'use client';
import { ArrowDownUp, Calculator, CirclePlus, MapPin, Trash2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useActionState, useMemo, useState, useRef, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import {
  calculateRouteAction,
  type RoutePlannerActionState,
} from '../actions/calculate-route-action';
import { RouteLocationInput } from './route-location-input';
import type { RouteLocationSuggestion } from '../application/route-planner-gateway';
import type { TollResult } from '../domain/route-calculation';

const INITIAL: RoutePlannerActionState = {
  status: 'idle',
  result: null,
  message: null,
  code: null,
};
const RouteMap = dynamic(() => import('./route-map').then((module) => module.RouteMap), {
  ssr: false,
  loading: () => <div className="h-full min-h-0 animate-pulse bg-muted" />,
});
function currency(value: number | null) {
  return value === null
    ? 'Tarifa ausente'
    : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}
function duration(minutes: number) {
  const rounded = Math.round(minutes);
  return Math.floor(rounded / 60) + 'h ' + String(rounded % 60).padStart(2, '0') + 'min';
}
function Submit({ allowed }: { readonly allowed: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={!allowed || pending} className="w-full">
      <Calculator />
      {pending ? 'Calculando…' : 'Calcular rota'}
    </Button>
  );
}
function Tolls({ tolls }: { readonly tolls: TollResult }) {
  if (!tolls.items.length)
    return (
      <p className="p-3 text-sm text-muted-foreground">
        {tolls.dataStatus === 'unavailable'
          ? 'Base de pedágios indisponível. O custo está incompleto.'
          : 'Nenhum pedágio associado ao trecho.'}
      </p>
    );
  return (
    <ul className="divide-y text-sm">
      {tolls.items.map((item) => (
        <li key={item.tollPointId} className="flex justify-between gap-3 py-3">
          <div>
            <p className="font-medium">{item.name}</p>
            <p className="text-xs text-muted-foreground">
              {item.road}
              {item.kilometer === null ? '' : ' · km ' + item.kilometer} ·{' '}
              {item.type === 'free-flow' ? 'Free Flow' : 'Praça física'}
            </p>
          </div>
          <span className="shrink-0">{currency(item.price)}</span>
        </li>
      ))}
    </ul>
  );
}
export function RoutePlannerForm({ canCalculate }: { readonly canCalculate: boolean }) {
  const [state, action, calculating] = useActionState(calculateRouteAction, INITIAL);
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [selectedOrigin, setSelectedOrigin] = useState<RouteLocationSuggestion | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<RouteLocationSuggestion | null>(
    null,
  );
  const [waypoints, setWaypoints] = useState<
    { id: number; value: string; selected: RouteLocationSuggestion | null }[]
  >([]);
  const [target, setTarget] = useState<string>('origin');
  const [changed, setChanged] = useState(false);
  const points = useMemo(
    () => [
      selectedOrigin ? selectedOrigin.lat + ', ' + selectedOrigin.lng : origin,
      ...waypoints.map((point) =>
        point.selected ? point.selected.lat + ', ' + point.selected.lng : point.value,
      ),
      selectedDestination ? selectedDestination.lat + ', ' + selectedDestination.lng : destination,
    ],
    [origin, destination, waypoints, selectedOrigin, selectedDestination],
  );
  const result = changed || calculating ? null : state.result;
  const pendingPick = useRef<AbortController | null>(null);
  const waypointSequence = useRef(0);
  useEffect(() => () => pendingPick.current?.abort(), []);
  const [picking, setPicking] = useState(false);
  const [pickError, setPickError] = useState('');
  function cancelPick() {
    pendingPick.current?.abort();
    pendingPick.current = null;
    setPicking(false);
  }
  async function pick(lat: number, lng: number) {
    cancelPick();
    const abort = new AbortController();
    pendingPick.current = abort;
    const field = target;
    setPicking(true);
    setPickError('');
    setChanged(true);
    try {
      const response = await fetch('/api/routing/locations/reverse?lat=' + lat + '&lng=' + lng, {
        signal: abort.signal,
        cache: 'no-store',
      });
      const item = (await response.json()) as RouteLocationSuggestion & { message?: string };
      if (!response.ok) throw new Error(item.message ?? 'Não foi possível identificar o ponto.');
      if (abort.signal.aborted) return;
      if (field === 'origin') {
        setOrigin(item.label);
        setSelectedOrigin(item);
        setTarget('destination');
      } else if (field === 'destination') {
        setDestination(item.label);
        setSelectedDestination(item);
      } else
        setWaypoints((current) =>
          current.map((point) =>
            String(point.id) === field ? { ...point, value: item.label, selected: item } : point,
          ),
        );
    } catch (error) {
      if (!abort.signal.aborted)
        setPickError(
          error instanceof Error
            ? error.message
            : 'Não foi possível identificar o local. Tente outro ponto ou pesquise o endereço.',
        );
    } finally {
      if (!abort.signal.aborted) {
        setPicking(false);
        pendingPick.current = null;
      }
    }
  }
  return (
    <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_minmax(14rem,45%)] overflow-hidden bg-background lg:grid-cols-[360px_minmax(0,1fr)] lg:grid-rows-1">
      <aside className="min-h-0 min-w-0 space-y-4 overflow-y-auto p-4">
        <h2 className="font-semibold">Planejar viagem</h2>
        <form
          action={action}
          onSubmit={() => setChanged(false)}
          onChange={() => setChanged(true)}
          className="space-y-4"
        >
          {!canCalculate && (
            <p className="text-sm text-muted-foreground">
              Seu acesso permite consultar, mas não calcular rotas.
            </p>
          )}
          <RouteLocationInput
            id="origin"
            label="Origem"
            value={origin}
            selected={selectedOrigin}
            onFocus={() => {
              cancelPick();
              setTarget('origin');
            }}
            onChange={(value) => {
              cancelPick();
              setOrigin(value);
              setSelectedOrigin(null);
              setChanged(true);
            }}
            onSelect={(item) => {
              cancelPick();
              setOrigin(item.label);
              setSelectedOrigin(item);
              setChanged(true);
            }}
          />
          {waypoints.map((point, index) => (
            <div key={point.id} className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <input type="hidden" name="waypointKey" value={'waypoint-' + point.id} />
                <RouteLocationInput
                  trailingAction={
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={'Remover parada ' + (index + 1)}
                      onClick={() => {
                        cancelPick();
                        setWaypoints((current) => current.filter((item) => item.id !== point.id));
                        setChanged(true);
                        setTarget('destination');
                      }}
                    >
                      <Trash2 />
                    </Button>
                  }
                  id={'waypoint-' + point.id}
                  label={'Parada ' + (index + 1)}
                  value={point.value}
                  selected={point.selected}
                  onFocus={() => {
                    cancelPick();
                    setTarget(String(point.id));
                  }}
                  onChange={(value) => {
                    cancelPick();
                    setWaypoints((current) =>
                      current.map((item) =>
                        item.id === point.id ? { ...item, value, selected: null } : item,
                      ),
                    );
                    setChanged(true);
                  }}
                  onSelect={(selected) => {
                    cancelPick();
                    setWaypoints((current) =>
                      current.map((item) =>
                        item.id === point.id ? { ...item, value: selected.label, selected } : item,
                      ),
                    );
                    setChanged(true);
                  }}
                />
              </div>
            </div>
          ))}
          <RouteLocationInput
            id="destination"
            label="Destino"
            value={destination}
            selected={selectedDestination}
            onFocus={() => {
              cancelPick();
              setTarget('destination');
            }}
            onChange={(value) => {
              cancelPick();
              setDestination(value);
              setSelectedDestination(null);
              setChanged(true);
            }}
            onSelect={(item) => {
              cancelPick();
              setDestination(item.label);
              setSelectedDestination(item);
              setChanged(true);
            }}
          />
          <div className="flex flex-wrap gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={waypoints.length >= 10}
              onClick={() => {
                cancelPick();
                const id = ++waypointSequence.current;
                setWaypoints((current) => [...current, { id, value: '', selected: null }]);
                setTarget(String(id));
                setChanged(true);
              }}
            >
              <CirclePlus /> Parada
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                cancelPick();
                setSelectedOrigin(selectedDestination);
                setSelectedDestination(selectedOrigin);
                setOrigin(destination);
                setDestination(origin);
                setWaypoints((current) => [...current].reverse());
                setChanged(true);
              }}
            >
              <ArrowDownUp /> Inverter
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                cancelPick();
                setSelectedOrigin(null);
                setSelectedDestination(null);
                setOrigin('');
                setDestination('');
                setWaypoints([]);
                setChanged(true);
                setTarget('origin');
              }}
            >
              <Trash2 /> Limpar
            </Button>
          </div>
          <p className="flex gap-2 text-xs text-muted-foreground">
            <MapPin className="size-4 shrink-0" /> Clique no mapa para definir{' '}
            {target === 'origin' ? 'a origem' : target === 'destination' ? 'o destino' : 'a parada'}
            . Selecione outro campo para mudar.
          </p>
          {picking ? (
            <p role="status" className="text-sm">
              Identificando o local no mapa…
            </p>
          ) : null}
          {pickError ? (
            <p role="alert" className="text-sm text-destructive">
              {pickError}
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="vehicleType">Veículo</Label>
              <select
                id="vehicleType"
                name="vehicleType"
                defaultValue="bus"
                className="h-8 min-w-0 w-full rounded-lg border border-input bg-background pl-2.5 pr-8 text-sm"
              >
                <option value="car">Automóvel</option>
                <option value="van">Van</option>
                <option value="minibus">Micro-ônibus</option>
                <option value="bus">Ônibus</option>
                <option value="truck">Caminhão</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="axles">Eixos</Label>
              <Input
                id="axles"
                name="axles"
                type="number"
                min="2"
                max="9"
                defaultValue="3"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fuelType">Combustível</Label>
              <Input id="fuelType" name="fuelType" defaultValue="diesel" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="consumptionKmPerLiter">Consumo (km/L)</Label>
              <Input
                id="consumptionKmPerLiter"
                name="consumptionKmPerLiter"
                type="number"
                min="0.0001"
                step="0.0001"
                defaultValue="3.1"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fuelPricePerLiter">Preço por litro (R$)</Label>
              <Input
                id="fuelPricePerLiter"
                name="fuelPricePerLiter"
                type="number"
                min="0"
                step="0.01"
                defaultValue="6.20"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="travelDate">Data da viagem</Label>
              <Input
                id="travelDate"
                name="travelDate"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                required
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="roundTrip" className="size-4 accent-primary" /> Calcular
            ida e volta
          </label>
          <Submit allowed={canCalculate && !picking} />
        </form>
        {state.status === 'error' && (
          <div
            role="alert"
            className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive"
          >
            {state.message}
          </div>
        )}
        {result && (
          <section className="space-y-4" aria-label="Resultado calculado">
            <h2 className="font-semibold">
              {result.locations.origin.label} → {result.locations.destination.label}
            </h2>
            <dl className="divide-y rounded-lg bg-muted/50 px-3">
              {[
                ['Distância', result.route.total.distanceKm.toLocaleString('pt-BR') + ' km'],
                ['Duração estimada', duration(result.route.total.durationMinutes)],
                ['Combustível', currency(result.fuel.estimatedCost)],
                ['Pedágios', currency(result.tolls.total)],
                ['Custo estimado', currency(result.cost.total)],
                ['Cobertura do custo', result.cost.complete ? 'Completa' : 'Parcial'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3 py-2 text-sm">
                  <dt>{label}</dt>
                  <dd className="font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
            <details open>
              <summary className="cursor-pointer font-medium">
                Pedágios — ida ({result.tolls.outbound.count})
              </summary>
              <Tolls tolls={result.tolls.outbound} />
            </details>
            {result.tolls.return && (
              <details>
                <summary className="cursor-pointer font-medium">
                  Pedágios — volta ({result.tolls.return.count})
                </summary>
                <Tolls tolls={result.tolls.return} />
              </details>
            )}
          </section>
        )}
      </aside>
      <section
        className="h-full min-h-0 border-t lg:border-l lg:border-t-0"
        aria-label="Trajeto no mapa"
      >
        <RouteMap calculation={result} points={points} onPick={pick} />
      </section>
    </div>
  );
}
