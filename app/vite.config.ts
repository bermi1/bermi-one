import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/*
  A build stamp the service worker can see.

  It rides in the registration URL, so a deploy produces a different worker URL
  and therefore a different cache name. Without it the cache name is a constant
  and yesterday's index.html survives every deploy.
*/
const BUILD_ID = Date.now().toString(36);

export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  build: {
    rollupOptions: {
      output: {
        /*
          Split the libraries out from the app.

          React, the router and the Supabase client barely change; the app
          changes every deploy. Kept in one file, every deploy invalidates the
          lot and a returning client on a slow connection re-downloads all of
          it to read a fix to one screen.
        */
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('@supabase')) return 'supabase';
          if (id.includes('react-router')) return 'router';
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('scheduler')) return 'react';
          return 'vendor';
        },
      },
    },
  },
})
