import { fireEvent, render, screen } from '@testing-library/react';
import { SelectAllCheckbox } from './select-all-checkbox';

beforeAll(() => {
  window.PointerEvent ??= MouseEvent as typeof PointerEvent;
});

it('checks only when every available value is selected and keeps partial selection actionable', () => {
  const change = jest.fn();
  const view = render(
    <SelectAllCheckbox
      aria-label="Selecionar todos"
      availableValues={['a', 'b', 'c']}
      selectedValues={['a']}
      onCheckedChange={change}
    />,
  );
  const checkbox = screen.getByRole('checkbox', { name: 'Selecionar todos' });
  expect(checkbox).not.toBeChecked();
  expect(checkbox).not.toBePartiallyChecked();
  expect(checkbox).toBeEnabled();
  fireEvent.click(checkbox);
  expect(change.mock.calls[0][0]).toBe(true);
  view.rerender(
    <SelectAllCheckbox
      aria-label="Selecionar todos"
      availableValues={['a', 'b', 'c']}
      selectedValues={['a', 'a', 'c']}
    />,
  );
  expect(checkbox).not.toBeChecked();
  view.rerender(
    <SelectAllCheckbox
      aria-label="Selecionar todos"
      availableValues={['a', 'b', 'c']}
      selectedValues={['a', 'b', 'c']}
    />,
  );
  expect(checkbox).toBeChecked();
  view.rerender(
    <SelectAllCheckbox
      aria-label="Selecionar todos"
      availableValues={['a']}
      selectedValues={['a']}
    />,
  );
  expect(checkbox).toBeChecked();
  view.rerender(
    <SelectAllCheckbox aria-label="Selecionar todos" availableValues={[]} selectedValues={[]} />,
  );
  expect(checkbox).not.toBeChecked();
  expect(checkbox).toHaveAttribute('aria-disabled', 'true');
});
