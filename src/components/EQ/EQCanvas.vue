<template>
  <div class="eqCurveSection">
    <canvas
      ref="eqCanvasRef"
      class="eqCurve"
      width="340"
      height="180"
      @pointerdown="handleCanvasPointerDown"
      @pointermove="handleCanvasPointerMove"
      @pointerup="handleCanvasPointerUp"
      @pointerleave="handleCanvasPointerLeave"
    ></canvas>

    <div class="eqFreqLabels">
      <span v-for="(freq, i) in frequencyLabels" :key="i" class="freqLabel">
        {{ freq }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { watch, onMounted } from 'vue'
import { useEQCanvas } from './composables/useEQCanvas.js'
import { frequencyLabels } from './utils/eqPresets.js'

const props = defineProps({
  bands: {
    type: Array,
    required: true,
  },
})

const emit = defineEmits(['preset-changed'])

const {
  eqCanvasRef,
  initCanvas,
  drawCurve,
  handleCanvasPointerDown,
  handleCanvasPointerMove,
  handleCanvasPointerUp,
  handleCanvasPointerLeave,
} = useEQCanvas(props.bands, () => {
  emit('preset-changed')
})

onMounted(() => {
  initCanvas()
})

watch(
  () => props.bands.map((b) => b.value),
  () => {
    drawCurve()
  },
  { deep: true }
)
</script>

<style scoped>
.eqCurveSection {
  margin-bottom: 16px;
  border-radius: 8px;
  overflow: hidden;
  background: rgba(8, 8, 10, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.06);
  padding: 8px;
}

.eqCurve {
  display: block;
  width: 100%;
  height: 180px;
  cursor: grab;
  border-radius: 6px;
  background: linear-gradient(180deg, rgba(10, 10, 12, 0.9) 0%, rgba(5, 5, 8, 1) 100%);
  pointer-events: auto;
  touch-action: none;
}

.eqCurve:active {
  cursor: grabbing;
}

.eqFreqLabels {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0;
  margin-top: 8px;
}

.freqLabel {
  font-size: 10px;
  color: rgba(200, 200, 200, 0.4);
  text-align: center;
  letter-spacing: 0.3px;
}
</style>
