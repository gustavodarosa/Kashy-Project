// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    nodePolyfills({
      protocolImports: true,
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],

  // Add this server configuration
  server: {
    proxy: {
      // Proxy requests starting with /api to your backend server
      '/api': {
        target: 'http://localhost:3000', // Your backend server address
        changeOrigin: true, // Recommended for virtual hosted sites
        secure: false,      // Set to true if your backend uses HTTPS with a valid certificate
      }
    }
  },

  // --- ADD THIS SECTION ---
  build: {
    // Set the target environment to support top-level await
    // 'esnext' uses the latest features supported by esbuild
    // 'es2022' is also a good option that explicitly includes top-level await
    target: 'esnext', // Or 'es2022'
  },
  // --- END OF ADDED SECTION ---

  // Optional: Ensure optimizeDeps also uses a compatible target
  // Usually `build.target` influences optimizeDeps, but being explicit can help
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext', // Or 'es2022'
    }
  }
});
