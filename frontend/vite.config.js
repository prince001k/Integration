import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  // Use '/' for Vercel or custom domains. Use '/your-repo-name/' ONLY for GitHub Pages.
  base: '/',
  server: {
    port: 5173,
    strictPort: true, // Error immediately if 5173 is taken instead of switching ports
    host: true,       // Listen on all local IPs
    allowedHosts: true, // Allow custom subdomains like tech.app.local
  },
})

