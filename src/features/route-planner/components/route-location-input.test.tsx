import { act, fireEvent, render, screen } from '@testing-library/react';
import { RouteLocationInput } from './route-location-input';

const item = { id: 'city:1', label: 'Uberlândia, MG, Brasil', lat: -18.91, lng: -48.27 };
const originalFetch = global.fetch;
beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
  global.fetch = originalFetch;
});
const props = {
  id: 'origin',
  label: 'Origem',
  value: 'Uber',
  selected: null,
  onChange: jest.fn(),
  onSelect: jest.fn(),
  onFocus: jest.fn(),
};

async function advance() {
  await act(async () => {
    jest.advanceTimersByTime(450);
  });
}

it('debounces requests and selects a real suggestion with the keyboard', async () => {
  const fetcher = jest.fn().mockResolvedValue({ ok: true, json: async () => [item] });
  global.fetch = fetcher;
  const onSelect = jest.fn();
  render(<RouteLocationInput {...props} onSelect={onSelect} />);
  const input = screen.getByRole('combobox', { name: 'Origem' });
  fireEvent.focus(input);
  expect(fetcher).not.toHaveBeenCalled();
  await advance();
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('option', { name: item.label })).toBeVisible();
  fireEvent.keyDown(input, { key: 'ArrowDown' });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(onSelect).toHaveBeenCalledWith(item);
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});

it('aborts superseded queries and ignores a late stale result', async () => {
  let resolveOld!: (value: unknown) => void;
  const fetcher = jest
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    )
    .mockResolvedValueOnce({
      ok: true,
      json: async () => [{ ...item, id: 'city:2', label: 'São Paulo, SP, Brasil' }],
    });
  global.fetch = fetcher;
  const view = render(<RouteLocationInput {...props} />);
  fireEvent.focus(screen.getByRole('combobox'));
  await advance();
  view.rerender(<RouteLocationInput {...props} value="São Paulo" />);
  expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
  await advance();
  await act(async () => {
    resolveOld({ ok: true, json: async () => [item] });
  });
  expect(screen.getByRole('option', { name: 'São Paulo, SP, Brasil' })).toBeVisible();
  expect(screen.queryByRole('option', { name: item.label })).not.toBeInTheDocument();
});

it('submits coordinates only while the selected label is unchanged', () => {
  const view = render(<RouteLocationInput {...props} value={item.label} selected={item} />);
  expect(view.container.querySelector('input[name="originLat"]')).toHaveValue(String(item.lat));
  view.rerender(<RouteLocationInput {...props} value="Outro endereço" selected={item} />);
  expect(view.container.querySelector('input[name="originLat"]')).toBeNull();
});

it('shows provider failures and empty results distinctly', async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce({ ok: false, json: async () => ({ message: 'Busca indisponível.' }) })
    .mockResolvedValueOnce({ ok: true, json: async () => [] });
  const view = render(<RouteLocationInput {...props} />);
  fireEvent.focus(screen.getByRole('combobox'));
  await advance();
  expect(screen.getByRole('status')).toHaveTextContent('Busca indisponível.');
  view.rerender(<RouteLocationInput {...props} value="Sem local" />);
  await advance();
  expect(screen.getByRole('status')).toHaveTextContent('Nenhum local encontrado');
});
