<template>
  <div class="rightSection">
    <button
      ref="volumeBlockRef"
      type="button"
      class="volumeBlock"
      :class="{ activeVolume: isDraggingVolume || isShowingVolumeValue }"
      aria-label="Set volume"
      @mousedown="handleVolumeMouseDown"
      @mousemove="handleVolumeMouseMove"
      @mouseup="handleVolumeMouseUp"
      @mouseleave="handleVolumeMouseUp"
      @wheel.prevent="handleVolumeWheel"
    >
      <div class="volumeFill" :class="{ muted: isMuted }" :style="{ height: volume + '%' }"></div>
      <div
        class="volumeIconWrap"
        @mouseenter="isHoveringIcon = true"
        @mouseleave="isHoveringIcon = false"
        @mousedown.stop.prevent
        @click.stop.prevent="handleMuteClick"
      >
        <svg
          class="volumeIcon"
          :class="{ hideVolumeIcon: isShowingVolumeValue }"
          viewBox="0 0 24 24"
        >
          <path :d="iconPath" />
        </svg>
      </div>
      <div class="volumeValue" :class="{ showVolumeValue: isShowingVolumeValue }">
        {{ volume }}%
      </div>
    </button>
  </div>
</template>

<script setup>
import { watch } from 'vue'
import { usePlayerVolume } from './composables/usePlayerVolume.js'

const props = defineProps({
  volume: {
    type: Number,
    default: 100,
  },
})

const emit = defineEmits(['update:volume'])

const {
  volume,
  isDraggingVolume,
  isShowingVolumeValue,
  volumeBlockRef,
  isHoveringIcon,
  isMuted,
  iconPath,
  handleVolumeMouseDown,
  handleVolumeMouseMove,
  handleVolumeMouseUp,
  handleVolumeWheel,
  handleMuteClick,
  setVolume,
} = usePlayerVolume(props.volume)

watch(
  () => props.volume,
  (newVolume) => {
    setVolume(newVolume)
  }
)

watch(
  () => volume.value,
  (newVolume) => {
    emit('update:volume', newVolume)
  }
)
</script>

<style scoped>
.rightSection {
  flex-shrink: 0;
  margin: 12px;
}

.volumeBlock {
  width: 45px;
  height: 110px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  position: relative;
  overflow: hidden;
  cursor: pointer;
  padding: 8px 0;
  margin: 12px 6px 12px 0;
  display: grid;
  place-items: center;
  color: #fff;
  border: none;
  transition: width 0.14s ease, transform 0.12s ease, border-color 0.12s ease, background 0.12s ease;
}

.volumeBlock:hover,
.volumeBlock:focus-visible {
  width: 65px;
  border-color: rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.12);
}

.volumeBlock.activeVolume {
  width: 65px;
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.18);
}

.volumeBlock:active {
  transform: translateY(0);
}

.volumeFill {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 0%;
  background: linear-gradient(180deg, rgba(var(--accent-r), var(--accent-g), var(--accent-b), 0.4) 0%, rgba(var(--accent-r), var(--accent-g), var(--accent-b), 0.9) 100%);
  transition: height 0.12s ease;
}

.volumeFill.muted {
  background: rgba(255, 255, 255, 0.08);
}

.volumeIcon {
  width: 26px;
  height: 26px;
  z-index: 1;
  fill: currentColor;
  pointer-events: none;
  transition: opacity 0.24s ease;
}

.volumeIconWrap {
  position: relative;
  z-index: 1;
  pointer-events: auto;
  cursor: pointer;
}

.volumeValue {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) scale(0.82);
  transform-origin: center;
  z-index: 1;
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.3px;
  pointer-events: none;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.45);
  opacity: 0;
  transition: opacity 0.24s ease, transform 0.24s ease;
}

.volumeValue.showVolumeValue {
  opacity: 1;
  transform: translate(-50%, -50%) scale(1.08);
}

.volumeIcon.hideVolumeIcon {
  opacity: 0;
}
</style>
