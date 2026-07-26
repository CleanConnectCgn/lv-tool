import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  build: {
    outDir: 'dist',
  },
  test: {
    // Mehrere Testdateien öffnen sonst gleichzeitig eigene PrismaClient-
    // Verbindungspools gegen dieselbe Postgres-Instanz - live beobachtet,
    // dass das unter der (langsameren) öffentlichen Verbindung zu
    // Cross-Test-Interferenzen und Timeouts führt. Sequenziell ist etwas
    // langsamer, aber zuverlässig.
    fileParallelism: false,
  },
});
