<template>
  <div class="titlebar">
    <div class="titlebar-content">
      <div class="app-name">
        <img src="../assets/icon.png" alt="Icon" class="app-icon" />
        <span>Octo</span>
      </div>
      <div v-if="!hideNav" class="titlebar-nav">
        <button
          v-for="item in navItems"
          :key="item.key"
          class="titlebar-nav-btn"
          :class="{ active: isActiveItem(item.key) }"
          type="button"
          :title="item.label"
          :aria-label="item.label"
          @click="item.action && item.action()"
        >
          <svg viewBox="0 0 24 24"><path :d="item.icon" /></svg>
          <span class="titlebar-nav-label">{{ item.label }}</span>
        </button>
      </div>
      <div class="window-controls">
        <button
          class="window-button minimize-btn"
          @click="handleMinimize"
          title="Minimize"
        >
          <svg viewBox="0 0 24 24"><path :d="mdiWindowMinimize" /></svg>
        </button>
        <button
          class="window-button close-btn"
          @click="handleClose"
          title="Close"
        >
          <svg viewBox="0 0 24 24"><path :d="mdiClose" /></svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  mdiWindowMinimize,
  mdiClose,
  mdiHome,
  mdiMusic,
  mdiAccountMusic,
  mdiHeart,
  mdiCog
} from '@mdi/js'

const router = useRouter()
const route = useRoute()

const hideNav = computed(() => route.path === '/login')

function isActiveItem(key) {
  const routeMap = { home: '/', 'my-music': '/my-music', songs: '/songs', favorites: '/favorites', settings: '/settings' }
  return routeMap[key] === route.path
}

const navItems = computed(() => [
  { key: 'home', label: 'Home', icon: mdiHome, action: () => router.push('/') },
  { key: 'my-music', label: 'My Music', icon: mdiAccountMusic, action: () => router.push('/my-music') },
  { key: 'favorites', label: 'Favorites', icon: mdiHeart, action: () => router.push('/favorites') },
  { key: 'songs', label: 'Songs', icon: mdiMusic, action: () => router.push('/songs') },
  { key: 'settings', label: 'Settings', icon: mdiCog, action: () => router.push('/settings') }
])

function handleMinimize() {
  window.octo?.windowControls?.minimize?.()
}

function handleClose() {
  window.octo?.windowControls?.close?.()
}
</script>

<style scoped>
.titlebar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 40px;
  background: rgba(8, 7, 12, 0.32);
  backdrop-filter: blur(14px) saturate(1.05);
  -webkit-backdrop-filter: blur(14px) saturate(1.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  z-index: 100;
  display: flex;
  align-items: center;
  -webkit-app-region: drag;
}

.titlebar-content {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  gap: 0;
}

.app-name {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
  letter-spacing: 0.5px;
  flex-shrink: 0;
  -webkit-app-region: no-drag;
  position: absolute;
  left: 16px;
}

.app-icon {
  height: 18px;
  width: 18px;
  opacity: 0.9;
}

.titlebar-nav {
  display: flex;
  gap: 0;
  -webkit-app-region: no-drag;
  flex-shrink: 0;
  height: 100%;
}

.titlebar-nav-btn {
  background: transparent;
  color: rgba(255, 255, 255, 0.75);
  border: none;
  cursor: pointer;
  height: 100%;
  padding: 0 12px;
  border-radius: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  justify-content: center;
  transition: color 0.2s;
  font-size: 12px;
  font-weight: 300;
}

.titlebar-nav-btn:hover {
  color: #fff;
}

.titlebar-nav-btn.active {
  color: rgba(var(--accent-light-r), var(--accent-light-g), var(--accent-light-b), 0.9);
}

.titlebar-nav-btn:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.8);
  outline-offset: -2px;
}

.titlebar-nav-btn svg {
  width: 18px;
  height: 18px;
  fill: currentColor;
}

.titlebar-nav-label {
  line-height: 1;
}

.window-controls {
  display: flex;
  gap: 0;
  -webkit-app-region: no-drag;
  height: 100%;
  position: absolute;
  right: 0;
}

.window-button {
  width: 44px;
  height: 100%;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s, color 0.2s;
  padding: 0;
  border-radius: 0;
}

.window-button svg {
  width: 18px;
  height: 18px;
  fill: currentColor;
}

.window-button:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
}

.window-button:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.9);
  outline-offset: -2px;
}

.window-button.close-btn:hover {
  background: rgba(255, 0, 0, 0.3);
}
</style>
