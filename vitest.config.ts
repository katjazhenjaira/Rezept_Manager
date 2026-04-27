import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    exclude: ['**/node_modules/**', '**/.worktrees/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: [
        'src/shared/domain/**',
        'src/features/cart/services/**',
        'src/infrastructure/firestore/converters.ts',
        'src/infrastructure/testing/**',
        'src/infrastructure/LocalStorageNutritionPlanRepository.ts',
      ],
      exclude: ['**/__tests__/**'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
