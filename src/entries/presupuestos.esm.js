/**
 * FinanzApp - Presupuestos Page Native ES Module Entry Point
 */

import Logger from '../lib/Logger.js';
import '../lib/Helpers.js';
import '../lib/EventBus.js';
import AuthService from '../lib/AuthService.js';
import DataStore from '../lib/DataStore.js';
import TableManager from '../lib/TableManager.js';
import BasePage from '../lib/BasePage.js';

const Helpers = (typeof window !== 'undefined' && window.Core?.helpers) || {};
const EventBus = (typeof window !== 'undefined' && window.DataEvents) || null;

Logger.info('Presupuestos.esm', 'Presupuestos ESM bundle loaded successfully');

export {
  Logger,
  Helpers,
  EventBus,
  AuthService,
  DataStore,
  TableManager,
  BasePage
};
export default {
  Logger,
  AuthService,
  DataStore,
  TableManager,
  BasePage
};

