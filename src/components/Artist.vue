<template>
  <div class="artist-card" role="group" :aria-label="name" @mouseenter="handleHover" @mouseleave="handleLeave" @focus="handleHover" tabindex="0">
    <button
      class="artist-main"
      type="button"
      :disabled="disabled"
      :aria-disabled="disabled"
      @click="handleOpen"
    >
      <div class="avatar" aria-hidden="true">
        <img v-if="resolvedCoverUrl" :src="resolvedCoverUrl" :alt="name" loading="lazy" />
        <div v-else class="placeholder">AR</div>
        <div class="infoView" aria-hidden="true">
          <span class="infoViewBtn" aria-hidden="true">
            <svg class="infoViewIcon" viewBox="0 0 24 24">
              <path :d="mdiAccountMusic" fill="currentColor" />
            </svg>
          </span>
        </div>
      </div>
      <div class="meta">
        <div class="name">{{ name }}</div>
      </div>
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { resolveEmbyImageSrc } from '../utils/embyImageUtils.js'
import { mdiAccountMusic } from '@mdi/js'

const router = useRouter()

const props = defineProps({
  artist: { type: Object, default: null },
  coverUrl: { type: [String, Object], default: '' },
  disabled: { type: Boolean, default: false }
})

const emit = defineEmits(['open', 'hover', 'mouseleave'])

const name = computed(() => props.artist?.Name || 'Unknown Artist')

const resolvedCoverUrl = computed(() => {
  return resolveEmbyImageSrc(props.coverUrl)
})

function handleOpen() {
  if (props.disabled) return
  emit('open', { artist: props.artist })
  if (props.artist?.Id) {
    router.push(`/artist/${props.artist.Id}`)
  }
}

function handleHover() {
  emit('hover', { artist: props.artist, coverUrl: resolvedCoverUrl.value })
}

function handleLeave() {
  emit('mouseleave')
}
</script>

<style scoped>
.artist-card {
  width: 136px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0;
  transition: all 0.15s ease;
}

.artist-main {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  background: none;
  border: none;
  padding: 0;
  margin: 0;
  color: inherit;
  font: inherit;
  cursor: pointer;
  text-align: center;
  width: 100%;
}

.artist-main:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.artist-main:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.5);
  outline-offset: 2px;
}

.avatar {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.08);
  display: grid;
  place-items: center;
  position: relative;
  flex-shrink: 0;
}

img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.placeholder {
  font-size: 24px;
  opacity: 0.6;
}

.meta {
  width: 100%;
  min-width: 0;
}

.name {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
}

.infoView {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) scale(0.92);
  opacity: 0;
  transition: opacity 0.15s ease, transform 0.15s ease;
  pointer-events: none;
}

.artist-card:hover .infoView,
.artist-card:focus-within .infoView {
  opacity: 1;
  transform: translate(-50%, -50%) scale(1);
}

.infoViewBtn {
  width: 44px;
  height: 44px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: rgba(8, 10, 14, 0.8);
  backdrop-filter: blur(10px) saturate(120%);
  -webkit-backdrop-filter: blur(10px) saturate(120%);
  border: 1px solid rgba(255, 255, 255, 0.10);
  color: rgba(255, 255, 255, 0.92);
}

.infoViewIcon {
  width: 18px;
  height: 18px;
}
</style>
