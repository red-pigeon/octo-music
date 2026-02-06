<template>
  <div class="trackInfo">
    <div class="trackName">{{ safeName }}</div>
    <ArtistLink
      class="trackArtist"
      :artist-id="nowPlaying?.raw?.ArtistItems?.[0]?.Id"
      :artist-name="safeArtist"
      fallback-name="Octor"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import ArtistLink from '../ArtistLink.vue'

const props = defineProps({
  nowPlaying: { type: Object, default: null },
})

const safeName = computed(() => props.nowPlaying?.name?.trim() || 'No track selected')
const safeArtist = computed(() => props.nowPlaying?.artist?.trim() || 'Octo')
</script>

<style scoped>
.trackInfo {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
  margin-top: 4px;
  width: 100%;
  max-width: 400px;
  min-width: 0;
}

.trackName {
  font-weight: 600;
  font-size: 19px;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
  text-align: center;
  line-height: 1;
  min-height: 19px;
}

.trackArtist {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.65);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
  text-align: center;
  min-height: 16px;
  display: block;
}
</style>
