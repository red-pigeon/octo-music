<template>
  <div class="leftSection">
    <div class="artworkThumb">
      <img v-if="src" :src="src" alt="cover" @error="onImgError" />
      <div v-else class="artworkPlaceholder">♫</div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  coverImageUrl: {
    type: String,
    default: '',
  },
  fallbackCoverUrl: {
    type: String,
    default: '',
  },
})

const src = ref('')

watch(
  () => [props.coverImageUrl, props.fallbackCoverUrl],
  ([next]) => {
    src.value = next || ''
  },
  { immediate: true }
)

function onImgError() {
  const fallback = props.fallbackCoverUrl || ''
  if (fallback && src.value !== fallback) {
    src.value = fallback
    return
  }
  src.value = ''
}
</script>

<style scoped>
.leftSection {
  flex-shrink: 0;
  margin: 12px 8px 12px 12px;
}

.artworkThumb {
  width: 110px;
  height: 110px;
  border-radius: 4px;
  overflow: hidden;
  flex-shrink: 0;
  background: linear-gradient(135deg, #333, #222);
  display: grid;
  place-items: center;
}

.artworkThumb img {
  width: 100%;
  height: auto;
  max-height: 100%;
  object-fit: contain;
  display: block;
}

.artworkPlaceholder {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  font-size: 16px;
  color: rgba(255, 255, 255, 0.6);
}
</style>
