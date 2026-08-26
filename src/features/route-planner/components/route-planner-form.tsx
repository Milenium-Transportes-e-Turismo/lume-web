'use client';

import { Calculator, CirclePlus, MapPinned, Trash2 } from 'lucide-react';
import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';

import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';

import {
  calculateRouteAction,
  type RoutePlannerActionState,
} from '../actions/calculate-route-action';
import type { TollResult } from '../domain/route-calculation';

const INITIAL_ROUTE_PLANNER_STATE: RoutePlannerActionState = {
  status: 'idle',
  result: null,
  message: null,
  code: null,
};

function currency(value: number | null): string {
  return value === null
    ? 'Tarifa ausente'
    : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function duration(minutes: number): string {
  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return hours > 0 ? `${hours}h ${String(remainder).padStart(2, '0')}min` : `${remainder} min`;
}

function SubmitButton({ canCalculate }: { readonly canCalculate: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || !canCalculate} className="min-w-44">
      <Calculator aria-hidden="true" />
      {pending ? 'Calculando…' : 'Calcular rota'}
    </Button>
  );
}

function TollTable({ tolls }: { readonly tolls: TollResult }) {
  if (tolls.items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        {tolls.dataStatus === 'unavailable'
          ? 'A base de pedágios ainda não possui dados publicados. Nenhum valor foi inventado.'
          : 'Nenhum pedágio foi associado a este trecho.'}
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="bg-muted/60 text-left">
          <tr>
            <th className="p-3">Ordem</th>
            <th className="p-3">Pedágio</th>
            <th className="p-3">Rodovia / km</th>
            <th className="p-3">Concessionária</th>
            <th className="p-3">Tipo</th>
            <th className="p-3 text-right">Tarifa</th>
          </tr>
        </thead>
        <tbody>
          {tolls.items.map((item) => (
            <tr key={item.tollPointId} className="border-t">
              <td className="p-3">{item.sequence}</td>
              <td className="p-3 font-medium">{item.name}</td>
              <td className="p-3">
                {item.road}
                {item.kilometer === null ? '' : ` — km ${item.kilometer}`}
              </td>
              <td className="p-3">{item.concessionaire ?? 'Não informada'}</td>
              <td className="p-3">{item.type === 'free-flow' ? 'Free Flow' : 'Praça física'}</td>
              <td className="p-3 text-right font-medium">{currency(item.price)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RoutePlannerForm({ canCalculate }: { readonly canCalculate: boolean }) {
  const [state, action] = useActionState(calculateRouteAction, INITIAL_ROUTE_PLANNER_STATE);
  const [waypoints, setWaypoints] = useState<number[]>([]);
  const result = state.result;
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Dados da viagem</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={action} className="space-y-6">
            {!canCalculate && (
              <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                Seu acesso permite visualizar o módulo, mas não executar novos cálculos.
              </p>
            )}
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="origin">Origem</Label>
                <Input id="origin" name="origin" placeholder="Uberlândia - MG" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="destination">Destino</Label>
                <Input
                  id="destination"
                  name="destination"
                  placeholder="Belo Horizonte - MG"
                  required
                />
              </div>
            </div>

            {waypoints.length > 0 && (
              <fieldset className="space-y-3 rounded-xl border p-4">
                <legend className="px-2 text-sm font-semibold">Paradas na ordem informada</legend>
                {waypoints.map((id, index) => (
                  <div key={id} className="flex items-end gap-2">
                    <div className="flex-1 space-y-2">
                      <Label htmlFor={`waypoint-${id}`}>Parada {index + 1}</Label>
                      <Input id={`waypoint-${id}`} name="waypoint" required />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={`Remover parada ${index + 1}`}
                      onClick={() =>
                        setWaypoints((current) => current.filter((item) => item !== id))
                      }
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                ))}
              </fieldset>
            )}
            <Button
              type="button"
              variant="outline"
              disabled={waypoints.length >= 10}
              onClick={() => setWaypoints((current) => [...current, Date.now()])}
            >
              <CirclePlus aria-hidden="true" /> Adicionar parada
            </Button>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <div className="space-y-2">
                <Label htmlFor="vehicleType">Veículo</Label>
                <select
                  id="vehicleType"
                  name="vehicleType"
                  defaultValue="bus"
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
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
            </div>
            <div className="flex flex-wrap items-end gap-6">
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
              <label className="flex h-9 items-center gap-2 text-sm font-medium">
                <input type="checkbox" name="roundTrip" className="size-4 accent-primary" />
                Calcular ida e volta separadamente
              </label>
              <SubmitButton canCalculate={canCalculate} />
            </div>
          </form>
        </CardContent>
      </Card>

      {state.status === 'error' && (
        <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
          <p className="font-medium text-destructive">{state.message}</p>
          {state.code && <p className="mt-1 text-xs text-muted-foreground">Código: {state.code}</p>}
        </div>
      )}

      {result && (
        <section className="space-y-6" aria-labelledby="routing-result-title">
          <div>
            <p className="text-sm font-semibold text-primary">Resultado calculado</p>
            <h2 id="routing-result-title" className="text-2xl font-bold">
              {result.locations.origin.label} → {result.locations.destination.label}
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ['Distância estimada', `${result.route.total.distanceKm.toLocaleString('pt-BR')} km`],
              ['Duração estimada', duration(result.route.total.durationMinutes)],
              ['Combustível estimado', `${result.fuel.estimatedLiters.toLocaleString('pt-BR')} L`],
              ['Custo de combustível', currency(result.fuel.estimatedCost)],
              ['Pedágios encontrados', String(result.tolls.count)],
              ['Total de pedágios', currency(result.tolls.total)],
              ['Custo estimado', currency(result.cost.total)],
              ['Cobertura do custo', result.cost.complete ? 'Completa' : 'Parcial'],
            ].map(([label, value]) => (
              <Card key={label}>
                <CardContent className="pt-5">
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="mt-1 text-xl font-bold">{value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPinned aria-hidden="true" /> Pedágios — ida
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TollTable tolls={result.tolls.outbound} />
            </CardContent>
          </Card>
          {result.tolls.return && (
            <Card>
              <CardHeader>
                <CardTitle>Pedágios — volta</CardTitle>
              </CardHeader>
              <CardContent>
                <TollTable tolls={result.tolls.return} />
              </CardContent>
            </Card>
          )}
          <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
            A geometria GeoJSON já foi calculada e está pronta para o mapa. A renderização com
            MapLibre será conectada após a definição do servidor de tiles de produção.
          </div>
        </section>
      )}
    </div>
  );
}
