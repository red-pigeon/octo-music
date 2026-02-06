<template>
  <div class="mainSection">
    <div class="headerRow">
      <div class="eqLeftSpace"></div>
      <div class="headerCenter">
        <PlayerHeader :nowPlaying="nowPlaying" />
      </div>
      <div class="eqRightSpace">
        <PlayerEQ />
      </div>
    </div>

    <div class="controlsRow">
      <div class="centerSection">
        <div class="controlsWrap">
          <div class="controls">
            <button
              type="button"
              class="controlBtn"
              @click="emit('openContext')"
              aria-label="Playlist"
              title="Playlist / Album"
            >
              <svg class="icon" viewBox="0 0 24 24">
                <path :d="mdiPlaylistMusic" />
              </svg>
            </button>
            <button
              type="button"
              class="controlBtn"
              @click="emit('stop')"
              aria-label="Stop"
              title="Stop"
              :disabled="!nowPlaying"
            >
              <svg class="icon" viewBox="0 0 24 24">
                <path :d="mdiStop" />
              </svg>
            </button>
            <button
              type="button"
              class="controlBtn"
              @click="emit('previous')"
              aria-label="Previous"
              title="Previous"
            >
              <svg class="icon" viewBox="0 0 24 24">
                <path :d="mdiSkipPrevious" />
              </svg>
            </button>
            <button
              type="button"
              class="controlBtn primary"
              @click="emit('togglePlayPause')"
              :aria-label="playAriaLabel"
              :title="playLabel"
            >
              <svg class="icon" viewBox="0 0 24 24">
                <path :d="isPlaying ? mdiPause : mdiPlay" />
              </svg>
            </button>
            <button
              type="button"
              class="controlBtn"
              @click="emit('next')"
              aria-label="Next"
              title="Next"
            >
              <svg class="icon" viewBox="0 0 24 24">
                <path :d="mdiSkipNext" />
              </svg>
            </button>
            <button
              type="button"
              class="controlBtn"
              :class="{ active: shuffleEnabled }"
              @click="emit('toggleShuffle')"
              aria-label="Shuffle"
              title="Shuffle"
            >
              <svg class="icon" viewBox="0 0 24 24">
                <path :d="mdiShuffle" />
              </svg>
            </button>
            <button
              type="button"
              class="controlBtn"
              :class="{ active: repeatMode > 0 }"
              @click="cycleRepeat"
              aria-label="Repeat"
              title="Repeat"
            >
              <svg class="icon" viewBox="0 0 24 24">
                <path :d="repeatMode === 2 ? mdiRepeatOnce : mdiRepeat" />
              </svg>
            </button>
          </div>
        </div>

        <div class="progressArea">
          <PlayerProgress
            :currentTime="currentTime"
            :duration="duration"
            :progress="progress"
            :isBuffering="isBuffering"
            @seek="emit('seek', $event)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { usePlayerControls } from './composables/usePlayerControls.js'
import PlayerHeader from './PlayerHeader.vue'
import PlayerProgress from './PlayerProgress.vue'
import PlayerEQ from '../EQ/EQ.vue'
import {
  mdiPlay,
  mdiPause,
  mdiSkipPrevious,
  mdiSkipNext,
  mdiShuffle,
  mdiRepeat,
  mdiRepeatOnce,
  mdiPlaylistMusic,
  mdiStop,
} from '@mdi/js'

const props = defineProps({
  nowPlaying: { type: Object, default: null },
  isPlaying: { type: Boolean, default: false },
  isBuffering: { type: Boolean, default: false },
  repeatMode: { type: Number, default: 0 },
  shuffleEnabled: { type: Boolean, default: false },
  currentTime: { type: Number, default: 0 },
  duration: { type: Number, default: 0 },
  progress: { type: Number, default: 0 },
})

const emit = defineEmits([
  'previous',
  'next',
  'stop',
  'togglePlayPause',
  'toggleShuffle',
  'toggleRepeat',
  'seek',
  'openContext',
])

const repeatModeComputed = computed(() => props.repeatMode)
const isPlayingComputed = computed(() => props.isPlaying)
const isBufferingComputed = computed(() => props.isBuffering)

const { playLabel, playAriaLabel, getNextRepeatMode } = usePlayerControls(
  repeatModeComputed,
  isPlayingComputed,
  isBufferingComputed
)

function cycleRepeat() {
  const next = getNextRepeatMode()
  emit('toggleRepeat', next)
}
</script>

<style scoped>
.mainSection {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.headerRow {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  width: 100%;
  gap: 8px;
}

.eqLeftSpace {
  width: 50px;
}

.headerCenter {
  display: flex;
  justify-content: center;
  align-items: center;
  min-width: 0;
}

.eqRightSpace {
  width: 50px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.controlsRow {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
}

.centerSection {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0px;
}

.controlsWrap {
  position: relative;
  width: 100%;
}

.controls {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: center;
}

.progressArea {
  width: 100%;
  margin-top: 6px;
}
.controlBtn {
  background: transparent;
  border: none;
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: transform 0.12s ease, background 0.12s ease, color 0.12s ease;
  padding: 0;
  height: 32px;
  width: 32px;
  border-radius: 50%;
  color: rgba(255, 255, 255, 0.75);
  position: relative;
}

.controlBtn.primary {
  background: #000;
  color: #fff;
  height: 38px;
  width: 38px;
  box-shadow: none;
  border: none;
}

.controlBtn.primary:hover {
  background: #000;
  transform: scale(1.1);
}

.controlBtn.primary:active {
  transform: scale(0.98);
  background: #000;
}

.controlBtn .icon {
  width: 18px;
  height: 18px;
  fill: currentColor;
}

.controlBtn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.controlBtn:active {
  transform: scale(0.96);
}

.controlBtn.active {
  color: rgba(var(--accent-light-r), var(--accent-light-g), var(--accent-light-b), 0.9);
}

.controlBtn.active:hover {
  background: rgba(var(--accent-r), var(--accent-g), var(--accent-b), 0.12);
}

.repeatIndicator {
  position: absolute;
  font-size: 9px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
  bottom: 2px;
  right: 2px;
  line-height: 1;
  pointer-events: none;
}

@keyframes progress-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>
