import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '')
    const embyTarget = env.VITE_EMBY_DEV_SERVER || ''
    
    return {
        base: './',
        plugins: [vue()],
        build: {
            rollupOptions: {
                output: {
                    manualChunks(id) {
                        if (!id.includes('node_modules')) return

                        if (id.includes('node_modules/vue/') || id.includes('node_modules/@vue/')) return 'vue'
                        if (id.includes('node_modules/vue-router/')) return 'vue-router'
                        if (id.includes('node_modules/pinia/')) return 'pinia'
                        if (id.includes('node_modules/hls.js/')) return 'hls'
                        if (id.includes('node_modules/@mdi/js/')) return 'mdi'
                    },
                },
            },
        },
        server: {
            port: 5173,
            strictPort: true,
            proxy: embyTarget ? {
                '/emby': {
                    target: embyTarget,
                    changeOrigin: true,
                    secure: true
                }
            } : undefined
        }
    }
})
