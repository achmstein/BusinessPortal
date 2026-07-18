import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// In dev, Vite proxies /api to the .NET host. Under Aspire the host URL is
// injected via env; otherwise fall back to the Web project's dev port.
const proxyTarget = process.env['services__businessportal-server__http__0'] ||
    process.env['services__businessportal-server__https__0'] ||
    'http://localhost:5080';
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        proxy: {
            '/api': { target: proxyTarget, changeOrigin: true, secure: false },
            '/health': { target: proxyTarget, changeOrigin: true, secure: false },
        },
    },
});
