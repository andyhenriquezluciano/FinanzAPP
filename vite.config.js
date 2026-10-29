import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFile } from 'node:fs/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: 'src',
  plugins: [{
    name: 'versioned-css-imports',
    apply: 'build',
    enforce: 'pre',
    async transform(source, id) {
      if (!/\.css(?:\?|$)/.test(id)) return;
      const expandImports = async (text, file, stack) => {
        const imports = /^\s*@import\s+["']([^"'\r\n]+\.css)(?:\?v=\d+)?["'];/gm;
        let result = '';
        let offset = 0;
        for (const match of text.matchAll(imports)) {
          const target = match[1].startsWith('/')
            ? resolve(__dirname, 'src', '.' + match[1])
            : resolve(dirname(file), match[1]);
          if (stack.includes(target)) throw new Error(`Import CSS circular: ${target}`);
          this.addWatchFile(target);
          result += text.slice(offset, match.index);
          result += await expandImports(await readFile(target, 'utf8'), target, [...stack, target]);
          offset = match.index + match[0].length;
        }
        return result + text.slice(offset);
      };
      return {
        code: await expandImports(source, id.split('?')[0], [id.split('?')[0]]),
        map: null
      };
    },
    generateBundle(_options, bundle) {
      for (const asset of Object.values(bundle)) {
        if (asset.type === 'asset' && asset.fileName.endsWith('.css') && /@import\s+["'](?!https?:)[^"']+\.css/.test(String(asset.source))) {
          throw new Error(`El paquete contiene un import CSS local sin resolver: ${asset.fileName}`);
        }
      }
    }
  }],
  server: {
    port: 5173,
    open: false
  },
  css: {
    devSourcemap: true
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/index.html'),
        categorias: resolve(__dirname, 'src/pages/Categorias/Categorias.html'),
        presupuestos: resolve(__dirname, 'src/pages/Presupuestos/Presupuestos.html'),
        estadistica: resolve(__dirname, 'src/pages/Estadistica/Estadistica.html'),
        configuracion: resolve(__dirname, 'src/pages/Configuracion/Configuracion.html'),
        login: resolve(__dirname, 'src/pages/Login/Login.html'),
        privacy: resolve(__dirname, 'src/pages/privacy/privacy.html'),
        terms: resolve(__dirname, 'src/pages/privacy/terms.html')
      }
    }
  },
  resolve: {
    alias: {
      '@lib': resolve(__dirname, 'src/lib'),
      '@types': resolve(__dirname, 'src/types')
    }
  }
});

