import { defineConfig } from 'vite';
import { svelte, vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import * as postcss from 'postcss';

export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
        ws: true
      },
      '/socket.io': {
        target: 'http://localhost:3000/socket.io',
        changeOrigin: true,
        secure: false,
        ws: true
      }
    }
  },
  plugins: [
    svelte({ preprocess: vitePreprocess() }),
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/socket.io-client/dist/socket.io.min.js',
          dest: '',
          rename: 'static-socket.io.min.js'
        }
      ]
    })
  ]
});