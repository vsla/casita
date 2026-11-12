import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // acessível pelo iPhone na mesma rede durante o desenvolvimento
    proxy: {
      // 127.0.0.1 explícito: "localhost" pode resolver para ::1 e cair em outro serviço
      '/api': 'http://127.0.0.1:3100',
      '/socket.io': { target: 'http://127.0.0.1:3100', ws: true },
    },
  },
});
