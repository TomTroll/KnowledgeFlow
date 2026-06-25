import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: {
      '@knowledgeflow/shared': path.resolve(__dirname, '../shared/src/index.ts'),
    },
  },
});
