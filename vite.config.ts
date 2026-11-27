import { readFile } from 'node:fs/promises';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  plugins: [{
    name: 'three-license',
    apply: 'build',
    async generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'THREE-LICENSE.txt',
        source: await readFile(new URL('./node_modules/three/LICENSE', import.meta.url)),
      });
    },
  }],
});
