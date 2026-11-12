import { defineConfig } from 'vitest/config';

// Testes rodam contra um banco separado (homehub_test), recriado a cada execução.
const base = (process.env.DATABASE_URL ?? 'postgres://homehub:homehub@localhost:5432/homehub').replace(/\/[^/]+$/, '');

export default defineConfig({
  test: {
    globalSetup: ['./test/global-setup.ts'],
    fileParallelism: false,
    env: {
      DATABASE_URL: `${base}/homehub_test`,
      SEED_USERS: 'demo-admin:Pessoa A:#6f9a85,demo-member:Pessoa B:#d9925b',
      SEED_PASSWORD: 'senha-fixture-2026',
      UPLOAD_DIR: 'data/test-uploads',
      CAMERA_GATEWAY_URL: '',
    },
  },
});
