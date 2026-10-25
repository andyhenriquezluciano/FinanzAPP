/**
 * FinanzApp - Global Type Definitions for Static Type Checking
 */

export interface Transaction {
  id: string | number;
  amount: number;
  date: string | Date;
  description: string;
  categoryId?: string | number;
  categoryName?: string;
  type: 'income' | 'expense';
  notes?: string;
  createdAt?: string | Date;
  source?: 'manual' | 'gmail' | 'imap' | 'statement';
}

export interface Category {
  id: string | number;
  name: string;
  fixedType?: 'income' | 'expense';
  isDefault?: boolean;
  isPinned?: boolean;
  transactions?: Transaction[];
}

export interface Budget {
  id: string;
  name?: string;
  amount: number;
  period: 'weekly' | 'biweekly' | 'monthly' | 'custom';
  categoryId: string;
  categoryName?: string;
  startDate?: string | Date;
  endDate?: string | Date;
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  picture?: string;
  photoURL?: string;
  provider: string;
  emailVerified?: boolean;
  isGuest?: boolean;
}

export interface AppSettings {
  theme: 'light' | 'dark';
  categoryViewMode?: 'compact' | 'detailed';
  currency: 'DOP' | 'USD' | 'EUR';
  numberFormat?: 'us' | 'eu';
  tooltips?: 'on' | 'off';
  shortcuts?: 'on' | 'off';
  dateFormat?: 'dmy' | 'mdy' | 'ymd';
  confirmDelete?: 'on' | 'off';
  autoRenewBudgets?: 'on' | 'off';
  txPerPage?: string | number;
  showCents?: 'on' | 'off';
  censorAmounts?: 'on' | 'off';
}

export interface LogEntry {
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  context: string;
  message: string;
  meta?: any;
}

export interface AppState {
  transactions: Transaction[];
  categories: Category[];
  budgets: Record<string, number | Budget>;
  settings: Partial<AppSettings>;
  user: UserProfile | null;
  isOnline: boolean;
  isLoading: boolean;
}

export type StoreListener<T> = (selected: T, prevSelected: T, state: AppState) => void;
export type StoreSelector<T> = (state: AppState) => T;
export type Unsubscribe = () => void;

export interface IReactiveStore<S = AppState> {
  getState(): S;
  select<T>(selector: (state: S) => T): T;
  setState(partialOrUpdater: Partial<S> | ((prev: S) => Partial<S>)): void;
  subscribe<T>(listener: (selected: T, prev: T, state: S) => void, selector?: (state: S) => T): Unsubscribe;
  computed<T>(computeFn: (state: S) => T): () => T;
  readonly subscriberCount: number;
}

declare global {
  interface Window {
    ReactiveStore: {
      new <S = AppState>(initialState?: Partial<S>): IReactiveStore<S>;
    };
    createReactiveStore: <S = AppState>(initialState?: Partial<S>) => IReactiveStore<S>;
    appStore: IReactiveStore<AppState>;
    DataEvents?: {
      emit(event: string, data?: any): void;
      on(event: string, callback: (data: any) => void): void;
      off(event: string, callback: (data: any) => void): void;
    };
    FirestoreDB?: any;
    AuthService?: any;
    ProfileSync?: any;
    Core?: {
      storeFactories?: {
        createLocalStorageStore: (baseKey?: string) => any;
        createFirestoreStore: () => any;
        createApiStore: (baseUrl?: string) => any;
      };
    };
  }
}
