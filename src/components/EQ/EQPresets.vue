<template>
  <div class="eqPresetsSection">
    <div class="presetButtons" :class="{ customActive }">
      <button
        v-for="preset in presetOrder"
        :key="preset"
        type="button"
        class="presetBtn"
        :class="{ active: isActive(preset) }"
        @click="() => emit('preset-selected', preset)"
      >
        {{ presetLabels[preset] || preset }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { presetOrder, presetLabels } from './utils/eqPresets.js'

const props = defineProps({
  selectedPreset: {
    type: String,
    required: true,
  },
  eqEnabled: {
    type: Boolean,
    required: true,
  },
})

const emit = defineEmits(['preset-selected'])

const isActive = (preset) => {
  return props.eqEnabled && props.selectedPreset === preset
}

const customActive = computed(() => {
  return props.eqEnabled && props.selectedPreset === 'custom'
})
</script>

<style scoped>
.eqPresetsSection {
  margin-bottom: 16px;
}

.presetButtons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.presetButtons.customActive .presetBtn:not(.active) {
  opacity: 0.55;
}

.presetBtn {
  padding: 7px 14px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 12px;
  cursor: pointer;
  transition: transform 0.12s ease, background 0.12s ease, border-color 0.12s ease, box-shadow 0.12s ease, color 0.12s ease;
}

.presetBtn:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.18);
}

.presetBtn.active {
  background: rgba(var(--accent-r), var(--accent-g), var(--accent-b), 0.18);
  border-color: rgba(var(--accent-r), var(--accent-g), var(--accent-b), 0.6);
  color: #fff;
  box-shadow: 0 6px 16px rgba(var(--accent-r), var(--accent-g), var(--accent-b), 0.25);
}

.presetBtn:active {
  transform: none;
}

.presetBtn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px rgba(var(--accent-r), var(--accent-g), var(--accent-b), 0.24), 0 8px 18px rgba(0, 0, 0, 0.35);
}
</style>
