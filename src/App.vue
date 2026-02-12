<!--
 * Octo Player
 * Copyright (c) 2026 Douwe C
 * Licensed under the MIT License.
 * See LICENSE file in the project root for full license information.
 -->
<template>
  <div id="app-root">
    <div class="app-shell" :class="{ authed: isAuthed, unauth: !isAuthed }">
      <Bubbles v-if="!isAuthed" />
      <router-view />
    </div>
    <Titlebar />
    <Player
      v-if="isAuthed"
      :nowPlaying="playbackStore.nowPlaying"
      @close="playbackStore.clearNowPlaying()"
      @next="handleNext"
      @previous="handlePrevious"
      @playingStateChange="handlePlayingStateChange"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import Titlebar from './components/Titlebar.vue'
import Bubbles from './components/Bubbles.vue'
import Player from './components/Player.vue'
import { useSessionStore } from './stores/session.js'
import { useSettingsStore } from './stores/settings.js'
import { usePlaybackController } from './composables/usePlaybackController.js'

const router = useRouter()
const sessionStore = useSessionStore()
sessionStore.hydrate()
const settingsStore = useSettingsStore()
settingsStore.hydrate()
const { playbackStore, handleNext, handlePrevious, handlePlayingStateChange } = usePlaybackController()

const isAuthed = computed(() => sessionStore.isAuthed())

const handleUnauth = () => {
  sessionStore.clear()
  router.push('/login').catch(() => {})
}

onMounted(() => {
  window.addEventListener('emby:unauthorized', handleUnauth)

  // Ensure the main process respects the persisted close/tray preference.
  window.octo?.settings?.setCloseBehavior?.(settingsStore.closeBehavior)
})

onUnmounted(() => {
  window.removeEventListener('emby:unauthorized', handleUnauth)
})
</script>

<style>
#app-root {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-shell {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  background: radial-gradient(circle at 20% 20%, #1b1f2b, #0c0f16 48%, #080a10 75%);
}

.app-shell.authed {
  align-items: stretch;
  justify-content: stretch;
  /* Simple dark gradient for home */
  background: linear-gradient(180deg, #0f1118 0%, #0b0d14 50%, #07090f 100%);
}

.app-shell.unauth {
  /* Keep the illustrated background for login */
  background:
    linear-gradient(rgba(15, 14, 21, 0.88), rgba(15, 14, 21, 0.92)),
    url(./assets/background.png) center 50% / cover no-repeat;
  animation: bgFloat 24s ease-in-out infinite;
}

/* Subtle floating background motion (login only) */
@keyframes bgFloat {
  0% {
    background-position:
      center 44%,
      center 48%;
  }

  50% {
    background-position:
      center 56%,
      center 60%;
  }

  100% {
    background-position:
      center 44%,
      center 48%;
  }
}

/* Accessibility: reduce motion */
@media (prefers-reduced-motion: reduce) {
  .app-shell.unauth {
    animation: none;
  }
}
</style>
