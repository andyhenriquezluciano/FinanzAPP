/**
 * @fileoverview FinanzApp Reactive State Management Container (Vanilla JS).
 *
 * Provee un contenedor de estado reactivo liviano, predecible y sin dependencias
 * para coordinar el estado de la aplicación entre componentes y páginas.
 */

function shallowEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;

  for (let i = 0; i < keysA.length; i++) {
    const key = keysA[i];
    if (!Object.prototype.hasOwnProperty.call(b, key) || !Object.is(a[key], b[key])) {
      return false;
    }
  }
  return true;
}

class ReactiveStore {
  #state;
  #listeners = new Set();

  /**
   * @param {Object} [initialState={}]
   */
  constructor(initialState = {}) {
    const isOnline = (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean')
      ? navigator.onLine
      : true;

    this.#state = {
      transactions: [],
      categories: [],
      budgets: {},
      settings: {},
      user: null,
      isOnline: isOnline,
      isLoading: false,
      ...initialState
    };

    this.#initNetworkListeners();
  }

  #initNetworkListeners() {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      this.setState({ isOnline: true });
      if (window.DataEvents) {
        window.DataEvents.emit('app:network-status', { online: true });
      }
    });

    window.addEventListener('offline', () => {
      this.setState({ isOnline: false });
      if (window.DataEvents) {
        window.DataEvents.emit('app:network-status', { online: false });
      }
    });
  }

  /**
   * Devuelve una copia o snapshot del estado actual.
   * @returns {Object}
   */
  getState() {
    return this.#state;
  }

  /**
   * Selecciona una porción del estado aplicando una función selectora.
   * @template T
   * @param {(state: Object) => T} selector
   * @returns {T}
   */
  select(selector) {
    if (typeof selector !== 'function') return this.getState();
    return selector(this.#state);
  }

  /**
   * Actualiza el estado de forma inmutable y notifica a los suscriptores.
   * @param {Object|((prevState: Object) => Object)} partialOrUpdater
   */
  setState(partialOrUpdater) {
    const prevState = this.#state;
    const updates = typeof partialOrUpdater === 'function'
      ? partialOrUpdater(prevState)
      : partialOrUpdater;

    if (!updates || typeof updates !== 'object') return;

    const nextState = { ...prevState, ...updates };

    if (shallowEqual(prevState, nextState)) {
      return; // Sin cambios, no notificar
    }

    this.#state = nextState;

    // Notificar suscriptores
    for (const sub of this.#listeners) {
      try {
        const prevSelected = sub.selector(prevState);
        const nextSelected = sub.selector(nextState);

        if (!shallowEqual(prevSelected, nextSelected)) {
          sub.listener(nextSelected, prevSelected, nextState);
        }
      } catch (err) {
        console.error('[ReactiveStore] Error en listener:', err);
      }
    }
  }

  /**
   * Suscribe un listener a cambios en el estado o en una porción seleccionada.
   * @template T
   * @param {(selected: T, prevSelected: T, state: Object) => void} listener
   * @param {(state: Object) => T} [selector] - Si se omite, escucha todo el estado.
   * @returns {() => void} Función para desuscribirse.
   */
  subscribe(listener, selector = (s) => s) {
    if (typeof listener !== 'function') {
      throw new TypeError('El listener debe ser una función.');
    }

    const subscription = {
      listener,
      selector: typeof selector === 'function' ? selector : (s) => s
    };

    this.#listeners.add(subscription);

    return () => {
      this.#listeners.delete(subscription);
    };
  }

  /**
   * Crea un selector derivado (computed) memorizado.
   * @template T
   * @param {(state: Object) => T} computeFn
   * @returns {() => T}
   */
  computed(computeFn) {
    let lastState = null;
    let lastResult;

    return () => {
      const currentState = this.#state;
      if (lastState === null || !shallowEqual(lastState, currentState)) {
        lastState = currentState;
        lastResult = computeFn(currentState);
      }
      return lastResult;
    };
  }

  /**
   * Retorna la cantidad de suscriptores activos.
   * @returns {number}
   */
  get subscriberCount() {
    return this.#listeners.size;
  }
}

function createReactiveStore(initialState = {}) {
  return new ReactiveStore(initialState);
}

const appStore = new ReactiveStore();

// Exposición global en navegador / Happy-DOM
if (typeof window !== 'undefined') {
  window.ReactiveStore = ReactiveStore;
  window.createReactiveStore = createReactiveStore;
  window.appStore = appStore;
}

if (typeof globalThis !== 'undefined') {
  globalThis.ReactiveStore = ReactiveStore;
  globalThis.createReactiveStore = createReactiveStore;
  globalThis.appStore = appStore;
}

export {
  ReactiveStore,
  createReactiveStore,
  appStore
};
