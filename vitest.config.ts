import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: { __LDF_VERSION__: JSON.stringify('test') },
  test: {
    environment: 'happy-dom',
    environmentOptions: {
      happyDOM: { url: 'https://linux.do/' },
    },
  },
});
