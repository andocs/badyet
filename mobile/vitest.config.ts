import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: __dirname,
  resolve: {
    alias: [
      { find: /^@\/lib\/(.*)$/, replacement: path.resolve(__dirname, '../lib/$1') },
      { find: /^~\/(.*)$/, replacement: path.resolve(__dirname, 'src/$1') },
    ],
  },
  test: { include: ['src/**/*.test.ts'] },
});
