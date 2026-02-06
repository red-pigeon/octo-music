<template>
  <router-link
    v-if="albumIdResolved"
    :to="`/album/${albumIdResolved}`"
    class="album-link"
    @click.stop
  >
    {{ displayName }}
  </router-link>
  <span v-else class="album-link album-link-disabled">
    {{ displayName }}
  </span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  album: { type: Object, default: null },
  albumId: { type: String, default: '' },
  albumName: { type: String, default: '' },
  fallbackName: { type: String, default: 'Unknown Album' }
})

const displayName = computed(() => {
  if (props.albumName) return props.albumName
  if (props.album?.Name) return props.album.Name
  return props.fallbackName
})

const albumIdResolved = computed(() => {
  if (props.albumId) return props.albumId
  if (props.album?.Id) return props.album.Id
  return ''
})
</script>

<style scoped>
.album-link {
  color: rgba(255, 255, 255, 0.7);
  text-decoration: none;
  cursor: pointer;
  transition: text-decoration 0.15s ease, color 0.15s ease;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: inline-block;
  max-width: 100%;
}

.album-link:hover,
.album-link:focus-visible {
  text-decoration: underline;
  color: rgba(255, 255, 255, 0.9);
}

.album-link-disabled {
  cursor: default;
}

.album-link-disabled:hover {
  text-decoration: none;
  color: rgba(255, 255, 255, 0.7);
}
</style>
