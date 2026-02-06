<template>
  <div :class="['grid-container', `grid-${variant}`]" :style="gridStyles">
    <slot></slot>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  variant: {
    type: String,
    default: 'albums'
  },
  columns: String,
  gap: {
    type: String,
    default: '1rem'
  },
  autoFlow: String,
  autoColumns: String
})

const gridStyles = computed(() => {
  const styles = {
    gap: props.gap
  }

  if (props.variant === 'albums') {
    styles.gridTemplateColumns = props.columns || 'repeat(auto-fill, minmax(140px, 1fr))'
  } else if (props.variant === 'compact') {
    styles.gridTemplateColumns = props.columns || 'repeat(auto-fill, minmax(60px, 1fr))'
  } else if (props.variant === 'tracks') {
    styles.gridTemplateRows = 'repeat(3, auto)'
    styles.gridAutoFlow = props.autoFlow || 'column'
    styles.gridAutoColumns = props.autoColumns || '360px'
  } else if (props.variant === 'track-row') {
    styles.gridTemplateRows = 'auto'
    styles.gridAutoFlow = props.autoFlow || 'column'
    styles.gridAutoColumns = props.autoColumns || '360px'
  }

  return styles
})
</script>

<style scoped>
.grid-container {
  display: grid;
  width: 100%;
}

.grid-tracks,
.grid-track-row {
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.grid-tracks::-webkit-scrollbar,
.grid-track-row::-webkit-scrollbar {
  display: none;
}
</style>
