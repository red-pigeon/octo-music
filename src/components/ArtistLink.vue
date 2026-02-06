<template>
  <router-link
    v-if="artistIdResolved"
    :to="`/artist/${artistIdResolved}`"
    class="artist-link"
    @click.stop
  >
    {{ displayName }}
  </router-link>
  <span v-else class="artist-link artist-link-disabled">
    {{ displayName }}
  </span>
</template>

<script setup>
import { computed } from 'vue'
 

const props = defineProps({
  artist: { type: Object, default: null },
  artistId: { type: String, default: '' },
  artistName: { type: String, default: '' },
  fallbackName: { type: String, default: 'Unknown Artist' }
})

const displayName = computed(() => {
  if (props.artistName) return props.artistName
  if (props.artist?.Name) return props.artist.Name
  return props.fallbackName
})

const artistIdResolved = computed(() => {
  if (props.artistId) return props.artistId
  if (props.artist?.Id) return props.artist.Id
  return ''
})
</script>

<style scoped>
.artist-link {
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

.artist-link:hover,
.artist-link:focus-visible {
  text-decoration: underline;
  color: rgba(255, 255, 255, 0.9);
}

.artist-link-disabled {
  cursor: default;
}

.artist-link-disabled:hover {
  text-decoration: none;
  color: rgba(255, 255, 255, 0.7);
}
</style>
