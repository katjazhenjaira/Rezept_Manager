import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    exclude: ['**/node_modules/**', '**/.worktrees/**', 'worker/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      // Раньше здесь был allowlist, отстававший от реального покрытия (TEST-4):
      // отчёт молчал о фактических дырах. Берём весь src/, исключая только то,
      // что принципиально не покрывается юнит-тестами.
      include: ['src/**'],
      exclude: [
        '**/__tests__/**',
        'src/main.tsx', // bootstrap: ReactDOM.createRoot, без логики
        'src/infrastructure/firebaseApp.ts', // инициализация Firebase SDK по env
        'src/test-setup.ts', // конфигурация самого тест-раннера
        'src/vite-env.d.ts',
        '**/*.d.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
