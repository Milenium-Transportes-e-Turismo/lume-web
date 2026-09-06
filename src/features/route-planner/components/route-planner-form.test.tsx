import { act, fireEvent, render, screen } from '@testing-library/react';
import { RoutePlannerForm } from './route-planner-form';
jest.mock(
  'next/dynamic',
  () => () =>
    function MapPlaceholder() {
      return <div>Mapa</div>;
    },
);
jest.mock('../actions/calculate-route-action', () => ({ calculateRouteAction: jest.fn() }));

it('keeps selected coordinates consistent when reversing and clearing the trip', async () => {
  jest.useFakeTimers();
  const originalFetch = global.fetch;
  const origin = { id: 'city:1', label: 'Uberlândia, MG, Brasil', lat: -18.91, lng: -48.27 };
  const destination = { id: 'city:2', label: 'São Paulo, SP, Brasil', lat: -23.55, lng: -46.63 };
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => [origin] })
    .mockResolvedValueOnce({ ok: true, json: async () => [destination] });
  try {
    const view = render(<RoutePlannerForm canCalculate />);
    const originInput = screen.getByRole('combobox', { name: 'Origem' });
    fireEvent.focus(originInput);
    fireEvent.change(originInput, { target: { value: 'Uberlan' } });
    await act(async () => {
      jest.advanceTimersByTime(450);
    });
    fireEvent.click(screen.getByRole('option', { name: origin.label }));
    const destinationInput = screen.getByRole('combobox', { name: 'Destino' });
    fireEvent.focus(destinationInput);
    fireEvent.change(destinationInput, { target: { value: 'São Paulo' } });
    await act(async () => {
      jest.advanceTimersByTime(450);
    });
    fireEvent.click(screen.getByRole('option', { name: destination.label }));
    fireEvent.click(screen.getByRole('button', { name: 'Inverter' }));
    expect(originInput).toHaveValue(destination.label);
    expect(destinationInput).toHaveValue(origin.label);
    const form = view.container.querySelector('form')!;
    expect(new FormData(form).get('originLat')).toBe(String(destination.lat));
    expect(new FormData(form).get('destinationLng')).toBe(String(origin.lng));
    fireEvent.click(screen.getByRole('button', { name: 'Limpar' }));
    expect(originInput).toHaveValue('');
    expect(destinationInput).toHaveValue('');
    expect(new FormData(form).has('originLat')).toBe(false);
    expect(new FormData(form).has('destinationLng')).toBe(false);
  } finally {
    global.fetch = originalFetch;
    jest.useRealTimers();
  }
});

it('uses the same intelligent CEP search for stops and removes their selected coordinates', async () => {
  jest.useFakeTimers();
  const originalFetch = global.fetch;
  const stop = {
    id: 'cep:01001000',
    label: 'Praça da Sé, São Paulo · CEP 01001-000',
    lat: -23.55,
    lng: -46.63,
  };
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => [stop] });
  try {
    const view = render(<RoutePlannerForm canCalculate />);
    fireEvent.click(screen.getByRole('button', { name: 'Parada' }));
    const input = screen.getByRole('combobox', { name: 'Parada 1' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '01001-000' } });
    await act(async () => {
      jest.advanceTimersByTime(450);
    });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('01001-000'),
      expect.any(Object),
    );
    fireEvent.click(screen.getByRole('option', { name: stop.label }));
    expect(input).toHaveValue(stop.label);
    const form = view.container.querySelector('form')!;
    const key = new FormData(form).get('waypointKey') as string;
    expect(new FormData(form).get(key + 'Lat')).toBe(String(stop.lat));
    fireEvent.click(screen.getByRole('button', { name: 'Remover parada 1' }));
    expect(new FormData(form).has('waypointKey')).toBe(false);
    expect(new FormData(form).has(key + 'Lat')).toBe(false);
  } finally {
    global.fetch = originalFetch;
    jest.useRealTimers();
  }
});
