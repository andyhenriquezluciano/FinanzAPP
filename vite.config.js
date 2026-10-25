import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: 'src',
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
        login: resolve(__dirname, 'src/pages/Login/Login.html')
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

