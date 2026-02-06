/*
 * Octo Player
 * Copyright (c) 2026 Douwe C
 * Licensed under the MIT License.
 * See LICENSE file in the project root for full license information.
 */

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router.js'
import './style.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
