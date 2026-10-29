import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PNG } = require(path.resolve('node_modules/playwright-core/lib/utilsBundle.js'));
const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const root = path.resolve(option('--root', 'src'));
const output = path.resolve(option('--out', '.css-audit/current'));
const baseline = option('--baseline', null);
const expectedCssVersion = option('--css-version', null);
const demo = JSON.parse(await readFile('tests/fixtures/demo.json', 'utf8'));
const vendorCache = path.resolve('.css-audit/vendor');
await mkdir(vendorCache, { recursive: true });
for (const [file, url] of Object.entries({
  'purify.min.js': 'https://cdn.jsdelivr.net/npm/dompurify@3.4.14/dist/purify.min.js',
  'chart.umd.min.js': 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
})) {
  try { await readFile(path.join(vendorCache, file)); }
  catch {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`No se pudo preparar ${file}: ${response.status}`);
    await writeFile(path.join(vendorCache, file), Buffer.from(await response.arrayBuffer()));
  }
}
const pages = {
  landing: '/', login: '/pages/Login/Login.html',
  privacy: '/pages/privacy/privacy.html', terms: '/pages/privacy/terms.html',
  categorias: '/pages/Categorias/Categorias.html',
  presupuestos: '/pages/Presupuestos/Presupuestos.html',
  estadistica: '/pages/Estadistica/Estadistica.html',
  configuracion: '/pages/Configuracion/Configuracion.html'
};
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  try { const bytes = await readFile(file); res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(bytes); }
  catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = { root, cases: [], differences: [], errors: [] };
const properties = ['display', 'position', 'top', 'right', 'bottom', 'left', 'width', 'height', 'min-width', 'max-width', 'min-height', 'max-height', 'padding', 'margin', 'gap', 'grid-template-columns', 'flex-direction', 'align-items', 'justify-content', 'background-color', 'background-image', 'color', 'border', 'border-radius', 'box-shadow', 'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'opacity', 'visibility', 'transform', 'transform-origin', 'overflow-x', 'overflow-y', 'z-index', 'pointer-events', 'box-sizing', 'text-align', 'white-space'];
const selectedPages = option('--pages', Object.keys(pages).join(',')).split(',');

try {
  for (const name of selectedPages) for (const theme of option('--themes', 'dark,light').split(',')) for (const width of option('--widths', '1440,390').split(',').map(Number)) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1000 }, locale: 'es-DO', timezoneId: 'America/Santo_Domingo', serviceWorkers: 'block' });
    await context.addInitScript(({ demo, theme, authenticated }) => {
      localStorage.clear();
      localStorage.setItem('theme', theme);
      localStorage.setItem('finanzapp:settings:v1', JSON.stringify({ ...demo.settings, theme }));
      if (authenticated) {
        localStorage.setItem('loggedIn', 'true');
        localStorage.setItem('authUser', JSON.stringify({ uid: 'guest', isAnonymous: true, provider: 'guest' }));
        for (const key of ['categories', 'transactions', 'budgets']) localStorage.setItem(`finanzapp:data:v1:guest:${key}`, JSON.stringify(demo.state[key]));
      }
    }, { demo, theme, authenticated: !['landing', 'login', 'privacy', 'terms'].includes(name) });
    const page = await context.newPage();
    await page.clock.install({ time: new Date('2026-10-29T12:00:00Z') });
    // External scripts stay blocked in isolated guest fixtures. Fonts/images use the same local assets in both runs.
    await context.route(/https:\/\/(?!127\.0\.0\.1)/, async route => {
      const file = route.request().url().includes('/dompurify@') ? 'purify.min.js' : route.request().url().includes('/chart.js@') ? 'chart.umd.min.js' : null;
      if (file) await route.fulfill({ contentType: 'text/javascript', body: (await readFile(path.join(vendorCache, file), 'utf8')) + (file === 'chart.umd.min.js' ? '\nChart.defaults.animation = false;' : '') });
      else await route.abort();
    });
    page.on('pageerror', error => report.errors.push({ page: name, message: error.message }));
    const cdp = await context.newCDPSession(page);
    await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
    const sheets = {};
    cdp.on('CSS.styleSheetAdded', ({ header }) => { sheets[header.styleSheetId] = header.sourceURL; });
    await cdp.send('CSS.startRuleUsageTracking');
    await page.goto(`http://127.0.0.1:${server.address().port}${pages[name]}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(350);
    await page.addStyleTag({ content: '*,*::before,*::after { animation:none!important; transition:none!important; caret-color:transparent!important; }' });
    await page.evaluate(() => document.fonts.ready);
    const id = `${name}-${theme}-${width}`;
      const capture = async (state, keepPointer = false) => {
      if (!keepPointer) await page.mouse.move(0, 0);
      const key = `${id}-${state}`;
      await writeFile(path.join(output, `${key}-dom.json`), JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('body,body *')].map((e,index)=>({index,tag:e.tagName,id:e.id,class:e.getAttribute('class')})))));
      const snapshot = await page.evaluate(properties => {
        const data = {};
        const nodes = [...document.querySelectorAll('body, body *')];
        for (const [index, node] of nodes.entries()) {
          if (['SCRIPT', 'STYLE', 'LINK', 'OPTION'].includes(node.tagName)) continue;
          const s = getComputedStyle(node);
          if (s.display === 'none' && !node.matches('.custom-dropdown-options,.modal,.modal-overlay')) continue;
          const key = `${index}:${node.tagName}:${node.id}`;
          data[key] = Object.fromEntries(properties.map(property => [property, s.getPropertyValue(property)]));
          for (const pseudo of ['::before', '::after']) {
            const ps = getComputedStyle(node, pseudo);
            if (ps.content !== 'none' && ps.content !== 'normal') data[key + pseudo] = Object.fromEntries(properties.map(property => [property, ps.getPropertyValue(property)]));
          }
        }
        return data;
      }, properties);
      await writeFile(path.join(output, `${key}.json`), JSON.stringify(snapshot));
      const screenshot = await page.screenshot({ path: path.join(output, `${key}.png`), fullPage: false });
      const traces = [];
      const { root: dom } = await cdp.send('DOM.getDocument');
      for (const selector of ['.filter-group', '.custom-dropdown-options', '.category-card', '.budget-card', '.btn', '.btn-secondary', '.category-card .btn-secondary', '.modal', '.mobile-bottom-nav']) {
        const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: dom.nodeId, selector });
        if (!nodeId) continue;
        const match = await cdp.send('CSS.getMatchedStylesForNode', { nodeId });
        const computed = await cdp.send('CSS.getComputedStyleForNode', { nodeId });
        traces.push({ selector, computed: computed.computedStyle, matched: match.matchedCSSRules.map(({ rule, matchingSelectors }) => ({ source: sheets[rule.styleSheetId], selector: rule.selectorList.text, matchingSelectors, media: rule.media, range: rule.style.range, declarations: rule.style.cssProperties.filter(p => !p.implicit && p.text) })) });
      }
      await writeFile(path.join(output, `${key}-cascade.json`), JSON.stringify(traces));
      const result = { key, nodes: Object.keys(snapshot).length };
      result.cssResources = [...new Set(Object.values(sheets))].filter(url => url.startsWith('http://127.0.0.1:') && /\.css(?:\?|$)/.test(url));
      if (expectedCssVersion && result.cssResources.some(url => new URL(url).searchParams.get('v') !== expectedCssVersion)) throw new Error(`Se cargó una hoja CSS sin la versión esperada en ${key}`);
      if (baseline) {
        const before = JSON.parse(await readFile(path.join(baseline, `${key}.json`), 'utf8'));
        const changes = [];
        for (const node of new Set([...Object.keys(before), ...Object.keys(snapshot)])) {
          if (!before[node] || !snapshot[node]) { changes.push({ node, presence: Boolean(snapshot[node]) }); continue; }
          const normalized = value => value.replace(/http:\/\/127\.0\.0\.1:\d+/g, '<local-origin>');
          for (const property of properties) if (normalized(before[node][property]) !== normalized(snapshot[node][property])) changes.push({ node, property, before: before[node][property], after: snapshot[node][property] });
        }
        const a = PNG.sync.read(await readFile(path.join(baseline, `${key}.png`)));
        const b = PNG.sync.read(screenshot);
        const diff = new PNG({ width: a.width, height: a.height });
        result.changedPixels = 0;
        for (let i = 0; i < a.data.length; i += 4) {
          const changed = [0, 1, 2, 3].some(offset => Math.abs(a.data[i + offset] - b.data[i + offset]) > 25);
          if (changed) result.changedPixels++;
          diff.data[i] = changed ? 255 : a.data[i];
          diff.data[i + 1] = changed ? 0 : a.data[i + 1];
          diff.data[i + 2] = changed ? 0 : a.data[i + 2];
          diff.data[i + 3] = 255;
        }
        result.styleChanges = changes.length;
        if (changes.length || result.changedPixels) {
          report.differences.push({ key, changes, changedPixels: result.changedPixels });
          await writeFile(path.join(output, `${key}-diff.png`), PNG.sync.write(diff));
        }
      }
      report.cases.push(result);
      const { cssResources: _resources, ...summary } = result;
      console.log(JSON.stringify(summary));
    };
    await capture('base');
    const click = async selector => {
      const target = page.locator(selector).first();
      if (await target.isVisible()) { await target.click({ timeout: 2000 }); await page.waitForTimeout(100); return true; }
      return false;
    };
    if (name === 'login') {
      if (await click('#showEmailLogin')) await capture('email');
      if (await click('#showForgotPassword')) { await capture('recovery'); await click('#backFromRecovery'); }
      if (await click('#showRegister')) await capture('register');
    }
    if (['categorias', 'presupuestos', 'estadistica'].includes(name)) {
      if (width > 980 && await click('#monthFilter .custom-dropdown-selected')) { await capture('filter-open'); await click('#monthFilter .custom-dropdown-selected'); }
      if (width < 980 && await click('.mobile-actions-toggle')) { await capture('drawer'); await click('.mobile-actions-close'); }
    }
    if (name === 'categorias') {
      if (width > 980) { await page.locator('.category-card').first().hover(); await capture('card-hover', true); }
      const card = page.locator('.category-card').first();
      await card.evaluate(e => e.classList.add('pinned'));
      await capture('card-pinned');
      await card.hover();
      await capture('card-pinned-hover', true);
      await card.evaluate(e => { e.classList.remove('pinned'); e.classList.add('drag-over'); });
      await capture('card-drag-over');
      await card.evaluate(e => e.classList.remove('drag-over'));
      const secondary = page.locator('.category-card .btn-secondary').first();
      if (await secondary.isVisible()) { await secondary.hover(); await capture('secondary-hover', true); }
      if (width > 980 && await click('.category-menu-btn')) { await capture('category-menu'); if (await click('[data-action="editarCategoria"]')) await capture('edit-category'); }
      await click('#cancelEditCategory');
      if (await click(width < 980 ? '#mobileCreateAction' : '#addCategoryBtn')) await capture('create-category');
    }
    if (name === 'presupuestos') {
      if (width > 980) { await page.locator('.budget-card').first().hover(); await capture('card-hover', true); }
      if (await click('.budget-card .btn-edit')) { await capture('edit-budget'); await click('#cancelBudgetBtn'); }
      if (await click(width < 980 ? '#mobileCreateAction' : '#addBudgetBtn')) { await capture('create-budget'); if (await click('#budgetCategoryDropdown .custom-dropdown-selected')) await capture('budget-dropdown'); }
    }
    if (name === 'configuracion' && await click('.preferences-card .custom-dropdown-selected')) await capture('preference-open');
    const coverage = await cdp.send('CSS.stopRuleUsageTracking');
    await writeFile(path.join(output, `${id}-coverage.json`), JSON.stringify({ sheets, coverage: coverage.ruleUsage }));
    await context.close();
  }
} finally {
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close(); server.close();
}
console.log(`Audit: ${report.cases.length} cases, ${report.differences.length} differences. ${output}`);
if (baseline && report.differences.length) process.exitCode = 1;
