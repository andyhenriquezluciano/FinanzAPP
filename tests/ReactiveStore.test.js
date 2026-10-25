import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createReactiveStore, ReactiveStore } from '../src/lib/ReactiveStore.js';

describe('ReactiveStore - Vanilla JS State Management', () => {
  let store;

  beforeEach(() => {
    store = createReactiveStore({
      transactions: [{ id: 'tx-1', amount: 150 }],
      categories: ['Comida', 'Transporte'],
      budgets: { Comida: 500 }
    });
  });

  it('debe inicializarse con el estado provisto', () => {
    const state = store.getState();
    expect(state.transactions).toHaveLength(1);
    expect(state.categories).toEqual(['Comida', 'Transporte']);
    expect(state.budgets.Comida).toBe(500);
    expect(state.isOnline).toBe(true);
  });

  it('debe estar disponible globalmente en window.createReactiveStore', () => {
    expect(typeof window.createReactiveStore).toBe('function');
    const globalStore = window.createReactiveStore({ test: true });
    expect(globalStore.getState().test).toBe(true);
  });

  it('debe actualizar el estado con setState parcial', () => {
    store.setState({ budgets: { Comida: 600, Salud: 200 } });
    expect(store.getState().budgets).toEqual({ Comida: 600, Salud: 200 });
    // transactions debe mantenerse inalterado
    expect(store.getState().transactions).toHaveLength(1);
  });

  it('debe permitir actualizar el estado pasando una funcion updater', () => {
    store.setState((prev) => ({
      transactions: [...prev.transactions, { id: 'tx-2', amount: 300 }]
    }));
    expect(store.getState().transactions).toHaveLength(2);
  });

  it('debe notificar suscriptores cuando cambia el estado global', () => {
    const listener = vi.fn();
    const unsub = store.subscribe(listener);

    store.setState({ isLoading: true });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ isLoading: true }),
      expect.objectContaining({ isLoading: false }),
      expect.any(Object)
    );

    unsub();
    store.setState({ isLoading: false });
    expect(listener).toHaveBeenCalledTimes(1); // No vuelve a llamarse tras unsub
  });

  it('debe notificar unicamente cuando cambia la porcion seleccionada por un selector', () => {
    const budgetListener = vi.fn();
    store.subscribe(budgetListener, (s) => s.budgets);

    // Cambiar otra cosa distinta a budgets (por ejemplo categories)
    store.setState({ categories: ['Comida'] });
    expect(budgetListener).not.toHaveBeenCalled();

    // Ahora cambiar budgets
    store.setState({ budgets: { Comida: 1000 } });
    expect(budgetListener).toHaveBeenCalledTimes(1);
    expect(budgetListener).toHaveBeenCalledWith(
      { Comida: 1000 },
      { Comida: 500 },
      expect.any(Object)
    );
  });

  it('no debe disparar listeners si el nuevo estado es identico', () => {
    const listener = vi.fn();
    store.subscribe(listener);

    const currentBudgets = store.getState().budgets;
    store.setState({ budgets: currentBudgets });

    expect(listener).not.toHaveBeenCalled();
  });

  it('debe calcular valores derivados (computed)', () => {
    const totalTransactions = store.computed((state) =>
      state.transactions.reduce((acc, t) => acc + t.amount, 0)
    );

    expect(totalTransactions()).toBe(150);

    store.setState((prev) => ({
      transactions: [...prev.transactions, { id: 'tx-2', amount: 250 }]
    }));

    expect(totalTransactions()).toBe(400);
  });

  it('debe exponer contador de suscriptores', () => {
    expect(store.subscriberCount).toBe(0);
    const unsub1 = store.subscribe(() => {});
    const unsub2 = store.subscribe(() => {});
    expect(store.subscriberCount).toBe(2);
    unsub1();
    expect(store.subscriberCount).toBe(1);
    unsub2();
    expect(store.subscriberCount).toBe(0);
  });
});
