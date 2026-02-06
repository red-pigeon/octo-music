<template>
  <div class="spinner" :style="sizeStyle" role="status" aria-label="Loading"></div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  size: { type: Number, default: 44 },
})

const sizeStyle = computed(() => {
  const px = `${Math.max(16, props.size)}px`
  return {
    width: px,
    height: px,
  }
})
</script>

<style scoped>
.spinner {
  box-sizing: border-box;
  border-radius: 999px;
  border: 3px solid rgba(255, 255, 255, 0.18);
  border-top-color: rgba(255, 255, 255, 0.85);
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
