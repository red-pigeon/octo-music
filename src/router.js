/*
 * Octo Player
 * Copyright (c) 2026 Douwe C
 * Licensed under the MIT License.
 * See LICENSE file in the project root for full license information.
 */

import { createRouter, createWebHashHistory } from 'vue-router'
import { loadConnection } from './services/emby.js'

const Home = () => import('./pages/Home.vue')
const Login = () => import('./pages/Login.vue')
const Album = () => import('./pages/Album.vue')
const Artist = () => import('./pages/Artist.vue')
const MyMusic = () => import('./pages/MyMusic.vue')
const Playlist = () => import('./pages/Playlist.vue')
const Songs = () => import('./pages/Songs.vue')
const Favorites = () => import('./pages/Favorites.vue')
const Settings = () => import('./pages/Settings.vue')

const routes = [
    { path: '/', component: Home, meta: { requiresAuth: true } },
    { path: '/my-music', component: MyMusic, meta: { requiresAuth: true } },
    { path: '/favorites', component: Favorites, meta: { requiresAuth: true } },
    { path: '/settings', component: Settings, meta: { requiresAuth: true } },
    { path: '/albums', redirect: '/my-music' },
    { path: '/songs', component: Songs, meta: { requiresAuth: true } },
    { path: '/album/:id', component: Album, meta: { requiresAuth: true } },
    { path: '/artist/:id', component: Artist, meta: { requiresAuth: true } },
    { path: '/playlist/recent', component: Playlist, meta: { requiresAuth: true } },
    { path: '/playlist/frequent', component: Playlist, meta: { requiresAuth: true } },
    { path: '/playlist/latest', component: Playlist, meta: { requiresAuth: true } },
    { path: '/playlist/:id', component: Playlist, meta: { requiresAuth: true } },
    { path: '/login', component: Login }
]

const router = createRouter({
    history: createWebHashHistory(),
    routes
})

router.beforeEach((to) => {
    const { serverUrl, token } = loadConnection()
    const authed = !!(serverUrl && token)
    if (to.meta?.requiresAuth && !authed) {
        return { path: '/login' }
    }
})

export default router
