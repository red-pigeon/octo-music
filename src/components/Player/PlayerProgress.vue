<template>
  <div class="progressContainer">
    <span class="timeLabel">{{ formatSecondsMSS(currentTime) }}</span>
    <button
      type="button"
      class="progressBar"
      aria-label="Seek"
      @click="onProgressClick"
    >
      <div class="progress" :style="{ width: (progress || 0) + '%' }"></div>
      <div v-if="isBuffering" class="progressShimmer"></div>
    </button>
    <span class="timeLabel">{{ formatSecondsMSS(duration) }}</span>
  </div>
</template>

<script setup>
import { formatSecondsMSS } from '../../utils/timeUtils.js'

const props = defineProps({
  currentTime: { type: Number, default: 0 },
  duration: { type: Number, default: 0 },
  progress: { type: Number, default: 0 },
  isBuffering: { type: Boolean, default: false },
})

const emit = defineEmits(['seek'])

function onProgressClick(e) {
  if (!props.duration) {
    console.warn('[PlayerProgress] Seek ignored: duration is', props.duration)
    return
  }
  const progressBar = e.currentTarget
  const rect = progressBar.getBoundingClientRect()
  const clickX = e.clientX - rect.left
  const percentage = clickX / rect.width
  const newTime = percentage * props.duration
  console.log('[PlayerProgress] Seek click:', { clickX, width: rect.width, percentage, duration: props.duration, newTime })
  emit('seek', newTime)
}
</script>

<style scoped>
.progressContainer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  width: 100%;
}

.timeLabel {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
  min-width: 30px;
  text-align: center;
}

.progressBar {
  width: 100%;
  flex: 1;
  height: 4px;
  background: rgba(255, 255, 255, 0.16);
  border-radius: 999px;
  overflow: hidden;
  cursor: pointer;
  padding: 0;
  border: none;
  outline: none;
  box-shadow: none;
  display: block;
  position: relative;
  transition: height 0.2s ease;
}

.progressBar:hover,
.progressBar:focus {
  height: 10px;
}

.progress {
  height: 100%;
  background: linear-gradient(90deg, rgba(var(--accent-r), var(--accent-g), var(--accent-b), 0.8) 0%, rgba(var(--accent-r), var(--accent-g), var(--accent-b), 0.8) 100%);
  width: 0%;
  border-radius: 999px;
  transition: width 0.12s ease;
  position: relative;
  z-index: 1;
}

.progressShimmer {
  position: absolute;
  inset: 0;
  background: linear-gradient(120deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.55) 35%, rgba(255, 255, 255, 0) 70%);
  background-size: 200% 100%;
  animation: progress-shimmer 4s linear infinite;
  z-index: 2;
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
