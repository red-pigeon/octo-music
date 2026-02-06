<template>
  <button class="pill-button" :type="type" v-bind="restAttrs" :disabled="disabled">
    <span class="label"><slot /></span>
  </button>
</template>

<script setup>
import { computed, useAttrs } from 'vue'

defineOptions({ inheritAttrs: false })

defineProps({
  type: { type: String, default: 'button' },
  disabled: { type: Boolean, default: false },
})

const attrs = useAttrs()

const restAttrs = computed(() => {
  const { class: klass, ...rest } = attrs
  return { ...rest, class: [klass] }
})
</script>

<style scoped>
.pill-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 52px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(8, 7, 12, 0.32);
  backdrop-filter: blur(14px) saturate(1.05);
  -webkit-backdrop-filter: blur(14px) saturate(1.05);
  color: rgba(255, 255, 255, 0.92);
  cursor: pointer;
  font-weight: 600;
  font-size: 0.95rem;
  transition: background 0.15s ease, transform 0.12s ease, border-color 0.15s ease;
  white-space: nowrap;
  box-shadow: 0 8px 20px rgba(0,0,0,0.25);
}

.pill-button:hover:enabled {
  background: rgba(8, 7, 12, 0.48);
  border-color: rgba(255, 255, 255, 0.24);
}

.pill-button:active:enabled {
  transform: translateY(1px);
}

.pill-button:disabled {
  opacity: 0.55;
  cursor: default;
}

.pill-button:focus-visible {
  outline: 2px solid rgba(237, 34, 93, 0.45);
  outline-offset: 2px;
}

@media (max-width: 720px) {
  .pill-button {
    padding: 0 12px;
    height: 52px;
    font-size: 0.9rem;
  }
}
</style>
