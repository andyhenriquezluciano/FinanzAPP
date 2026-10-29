import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import * as css from 'css-tree';

const root = path.resolve('src');
const cssVersion = '20261029009';
const errors = [];
const visited = new Set();
const entries = [];
const stylesheets = [];
async function inventory(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name);
    if (item.isDirectory()) await inventory(file);
    else if (item.name.endsWith('.html')) entries.push(file);
    else if (item.name.endsWith('.css')) stylesheets.push(file);
  }
}
async function inspect(file, declarations, stack = [], conditions = []) {
  if (stack.includes(file)) { errors.push(`Import circular: ${[...stack, file].join(' -> ')}`); return; }
  let text;
  try { text = await readFile(file, 'utf8'); }
  catch { errors.push(`No existe la hoja enlazada: ${path.relative(root, file)}`); return; }
  visited.add(file);
  const ast = css.parse(text, { positions: true, onParseError: error => errors.push(`${path.relative(root, file)}:${error.line}: ${error.message}`) });
  const walk = async (nodes, contexts) => {
    for (const node of nodes) {
      if (node.type === 'Atrule' && node.name === 'import') {
        const href = css.generate(node.prelude).replace(/^url\(["']?|["']?\)$/g, '').replace(/^["']|["']$/g, '');
        if (!href.endsWith(`?v=${cssVersion}`)) errors.push(`Import sin la versiÃ³n CSS vigente: ${path.relative(root, file)} -> ${href}`);
        const url = href.split('?')[0];
        const resolved = url.startsWith('/') ? path.resolve(root, '.' + url) : path.resolve(path.dirname(file), url);
        await inspect(resolved, declarations, [...stack, file], contexts);
      } else if (node.type === 'Atrule' && ['media', 'supports', 'container'].includes(node.name)) {
        await walk(node.block.children, [...contexts, `@${node.name} ${css.generate(node.prelude)}`]);
      } else if (node.type === 'Rule') {
        for (const selector of node.prelude.children) {
          for (const declaration of node.block.children) {
            if (declaration.type !== 'Declaration') continue;
            const key = JSON.stringify([contexts, css.generate(selector), declaration.property]);
            const location = `${path.relative(root, file)}:${declaration.loc.start.line}`;
            if (declarations.has(key)) errors.push(`Propiedad repetida en la misma variante: ${key} (${declarations.get(key)}; ${location})`);
            declarations.set(key, location);
          }
        }
      }
    }
  };
  await walk(ast.children, conditions);
}
await inventory(root);
for (const entry of entries) {
  const html = await readFile(entry, 'utf8');
  const declarations = new Map();
  for (const match of html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)) {
    const href = match[0].match(/href="([^"]+)"/)?.[1];
    if (!href || /^https?:/.test(href)) continue;
    if (!href.endsWith(`?v=${cssVersion}`)) errors.push(`Enlace sin la versiÃ³n CSS vigente: ${path.relative(root, entry)} -> ${href}`);
    const url = href.split('?')[0];
    await inspect(url.startsWith('/') ? path.resolve(root, '.' + url) : path.resolve(path.dirname(entry), url), declarations);
  }
}
for (const stylesheet of stylesheets) if (!visited.has(stylesheet)) errors.push(`Hoja CSS sin ninguna entrada: ${path.relative(root, stylesheet)}`);
for (const error of [...new Set(errors)]) console.error(error);
console.log(`${entries.length} entradas HTML; ${visited.size} hojas CSS alcanzables; ${new Set(errors).size} errores.`);
if (errors.length) process.exitCode = 1;
