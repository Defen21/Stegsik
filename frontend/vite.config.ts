import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    define: {
        'import.meta.env.VITE_API_URL': JSON.stringify('https://stegsik.xyz/api')
    },
    server: {
        host: true,
        port: 3000,
        allowedHosts: ['stegsik.xyz'],
        watch: {
            usePolling: true
        }
    }
})
