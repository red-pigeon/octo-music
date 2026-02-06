<template>
  <div class="artist-section">
    <ArtistLink
      class="artist-name"
      :artist-id="artist.Id || artist.id"
      :artist-name="artist.name"
      fallback-name="Unknown Artist"
    />
    <Grid variant="albums">
      <Album
        v-for="album in artist.albums"
        :key="album.Id"
        :album="album"
        :coverUrl="coverUrlFor(album, sessionStore)"
        appearance="flat"
        :showDetails="true"
        :showArtist="false"
        :tilePlays="true"
        :titleOpens="true"
        :canToggleFavorite="true"
        :isFavorite="album.UserData?.IsFavorite || false"
        :sessionStore="sessionStore"
        @hover="$emit('album-hover', $event)"
        @open="$emit('album-open', $event)"
        @play="$emit('album-play', $event)"
        @favorite-toggle="$emit('album-favorite-toggle', $event)"
      />
    </Grid>
  </div>
</template>

<script setup>
import { coverUrlFor } from '../services/mediaUtils.js'
import Album from './Album.vue'
import Grid from './Grid.vue'
import ArtistLink from './ArtistLink.vue'

defineProps({
  artist: {
    type: Object,
    required: true
  },
  sessionStore: {
    type: Object,
    required: true
  }
})

defineEmits(['album-hover', 'album-open', 'album-play', 'album-favorite-toggle'])
</script>

<style scoped>
.artist-section {
  margin-bottom: 2rem;
}

.artist-name {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: var(--text-primary, #fff);
  display: block;
}
</style>
