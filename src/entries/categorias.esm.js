/**
 * FinanzApp - Categorias Page Native ES Module Entry Point
 * Bundles all core dependencies with tree-shaking and strict ESM imports.
 */

import Logger from '../lib/Logger.js';
import '../lib/Helpers.js';
import '../lib/EventBus.js';
import AuthService from '../lib/AuthService.js';
import DataStore from '../lib/DataStore.js';
import TableManager from '../lib/TableManager.js';
import BasePage from '../lib/BasePage.js';
import CategoriasFilters from '../pages/Categorias/CategoriasFilters.js';
import CategoriasTransactions from '../pages/Categorias/CategoriasTransactions.js';

const Helpers = (typeof window !== 'undefined' && window.Core?.helpers) || {};
const EventBus = (typeof window !== 'undefined' && window.DataEvents) || null;

Logger.info('Categorias.esm', 'Categorias ESM bundle loaded successfully');

export {
  Logger,
  Helpers,
  EventBus,
  AuthService,
  DataStore,
  TableManager,
  BasePage,
  CategoriasFilters,
  CategoriasTransactions
};
export default {
  Logger,
  AuthService,
  DataStore,
  TableManager,
  BasePage,
  CategoriasFilters,
  CategoriasTransactions
};

