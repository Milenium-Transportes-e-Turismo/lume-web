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
