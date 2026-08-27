import { fireEvent, render, screen } from '@testing-library/react';

import { DynamicFilterForm } from './dynamic-filter-form';

const replace = jest.fn();

jest.mock('next/navigation', () => ({
  usePathname: () => '/items',
  useRouter: () => ({ replace }),
}));

describe('DynamicFilterForm', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    replace.mockClear();
  });

  afterEach(() => jest.useRealTimers());

  it('aplica seleções imediatamente e pesquisa textual após o debounce', () => {
    render(
      <DynamicFilterForm>
        <input aria-label="Pesquisar" name="search" type="search" />
        <select aria-label="Situação" name="status" defaultValue="">
          <option value="">Todas</option>
          <option value="active">Ativos</option>
        </select>
      </DynamicFilterForm>,
    );

    fireEvent.change(screen.getByLabelText('Situação'), { target: { value: 'active' } });
    expect(replace).toHaveBeenLastCalledWith('/items?status=active', { scroll: false });

    fireEvent.change(screen.getByLabelText('Pesquisar'), { target: { value: 'Ana' } });
    expect(replace).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(400);
    expect(replace).toHaveBeenLastCalledWith('/items?search=Ana&status=active', { scroll: false });
  });
});
