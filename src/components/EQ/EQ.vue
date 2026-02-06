<template>
  <div class="eqSection" ref="eqSectionRef">
    <button
      type="button"
      class="eqButton"
      aria-label="Toggle equalizer"
      :class="{ active: isEQOpen }"
      @click="isEQOpen = !isEQOpen"
    >
      <div class="eqIconWrap">
        <div class="eqBars" :class="{ animate: isPlaying && eqEnabled && eqReady }">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <span class="eqLabel">EQ</span>
      </div>
    </button>

    <Teleport to="body">
      <Transition name="eqPop" appear>
        <div v-if="isEQOpen" ref="eqPanelRef" class="eqPanel" :style="panelStyle">
          <div class="eqHeader">
            <h3>Equalizer<span v-if="selectedPresetLabel"> — {{ selectedPresetLabel }}</span></h3>
          </div>

          <EQPresets :selectedPreset="selectedPreset" :eqEnabled="eqEnabled" @preset-selected="handlePresetClick" />

          <EQCanvas :bands="bands" @preset-changed="selectedPreset = 'custom'" />

          <div class="eqBandsHidden">
            <input
              v-for="(band, index) in bands"
              :key="index"
              v-model.number="band.value"
              type="range"
              min="-12"
              max="12"
              step="1"
              class="eqSlider"
              @input="selectedPreset = 'custom'"
            />
          </div>

          <EQControls :eqEnabled="eqEnabled" @toggle="handleToggle" @reset="resetEQ" />
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, inject, computed, nextTick } from 'vue'
import EQCanvas from './EQCanvas.vue'
import EQPresets from './EQPresets.vue'
import EQControls from './EQControls.vue'
import { useEQAudio } from './composables/useEQAudio.js'
import { presets, presetLabels } from './utils/eqPresets.js'
import { storageGetItem, storageSetItem } from '../../utils/storage.js'

const isEQOpen = ref(false)
const eqEnabled = ref(true)
const selectedPreset = ref('custom')
const eqSectionRef = ref(null)
const panelStyle = ref({})
const eqPanelRef = ref(null)

const audioElRef = inject('audioEl')
const playerVolume = inject('playerVolume')
const useEQAudioPath = inject('useEQAudioPath')
const isPlaying = inject('isPlaying', ref(false))

const {
  bands,
  eqReady,
  teardownGraph,
  ensureAudioContext,
  buildGraph,
  updateFilterGains,
  wirePassThrough,
  updateMasterGainFromVolume,
} = useEQAudio(audioElRef, playerVolume, useEQAudioPath, eqEnabled)

const selectedPresetLabel = computed(() => {
  if (selectedPreset.value === 'custom') return 'Custom'
  return presetLabels[selectedPreset.value] || selectedPreset.value
})

const applyPreset = async () => {
  if (selectedPreset.value !== 'custom' && presets[selectedPreset.value]) {
    const values = presets[selectedPreset.value]
    bands.value.forEach((band, index) => {
      band.value = values[index]
    })
  }
  await ensureAudioContext()
  await buildGraph()
  updateFilterGains()
  applyEQ()
}

const handlePresetClick = async (preset) => {
  const wasDisabled = !eqEnabled.value
  if (wasDisabled) {
    eqEnabled.value = true
    await applyRoutingFromToggle()
  }
  selectedPreset.value = preset
  await applyPreset()
}

const resetEQ = async () => {
  bands.value.forEach((band) => {
    band.value = 0
  })
  selectedPreset.value = 'custom'
  await ensureAudioContext()
  await buildGraph()
  updateFilterGains()
  applyEQ()
}

const applyEQ = () => {
  storageSetItem(
    'octoPlayerEQ',
    JSON.stringify({
      preset: selectedPreset.value,
      bands: bands.value.map((b) => b.value),
      eqEnabled: eqEnabled.value,
    })
  )
}

const applyRoutingFromToggle = async () => {
  const audioEl = audioElRef?.value
  if (!audioEl) return

  if (eqEnabled.value) {
    const ok = await buildGraph()
    if (ok) {
      updateFilterGains()
    } else {
      eqEnabled.value = false
      audioEl.muted = false
      audioEl.volume = (playerVolume?.value ?? 100) / 100
      if (useEQAudioPath) useEQAudioPath.value = false
    }
  } else {
    const ok = await wirePassThrough()
    if (useEQAudioPath) useEQAudioPath.value = false
    audioEl.muted = false
    audioEl.volume = (playerVolume?.value ?? 100) / 100
    if (!ok) {
      await teardownGraph(true)
    }
  }
  applyEQ()
}

const handleToggle = async (checked) => {
  eqEnabled.value = checked
  await applyRoutingFromToggle()
}

const handleOutsideClick = (event) => {
  if (!isEQOpen.value) return
  const root = eqSectionRef.value
  const panel = eqPanelRef.value
  const target = event.target
  const insideTrigger = root && root.contains(target)
  const insidePanel = panel && panel.contains(target)
  const isCanvasClick = target instanceof HTMLCanvasElement
  if (!insideTrigger && !insidePanel && !isCanvasClick) isEQOpen.value = false
}

const updatePanelPosition = () => {
  if (!isEQOpen.value) return
  const root = eqSectionRef.value
  if (!root) return
  const rect = root.getBoundingClientRect()
  const panel = eqPanelRef.value
  const panelWidth = panel?.offsetWidth || 380
  const gap = 12
  const left = Math.max(gap, rect.left - panelWidth - gap)
  const bottom = Math.max(gap, window.innerHeight - rect.bottom)
  panelStyle.value = {
    bottom: `${bottom}px`,
    left: `${left}px`,
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', handleOutsideClick)
  window.addEventListener('resize', updatePanelPosition)
  window.addEventListener('scroll', updatePanelPosition, true)

  const savedEQ = storageGetItem('octoPlayerEQ', null)
  if (savedEQ) {
    try {
      const parsed = JSON.parse(savedEQ)
      if (parsed.preset && (parsed.preset === 'custom' || presets[parsed.preset])) {
        selectedPreset.value = parsed.preset
      } else {
        selectedPreset.value = 'custom'
      }
      if (Array.isArray(parsed.bands)) {
        bands.value.forEach((band, idx) => {
          if (parsed.bands[idx] !== undefined) band.value = parsed.bands[idx]
        })
      }
      if (parsed.eqEnabled !== undefined) {
        eqEnabled.value = parsed.eqEnabled
      } else {
        eqEnabled.value = true
      }
    } catch {}
  }

  const initTimer = setInterval(async () => {
    if (audioElRef?.value) {
      clearInterval(initTimer)
      if (eqEnabled.value) {
        const ok = await buildGraph()
        if (ok) {
          updateFilterGains()
        } else {
          eqEnabled.value = false
          audioElRef.value.muted = false
          audioElRef.value.volume = (playerVolume?.value ?? 100) / 100
          if (useEQAudioPath) useEQAudioPath.value = false
        }
      }
      if (!eqEnabled.value && audioElRef.value) {
        audioElRef.value.muted = false
        audioElRef.value.volume = (playerVolume?.value ?? 100) / 100
        if (useEQAudioPath) useEQAudioPath.value = false
      }
    }
  }, 100)
  setTimeout(() => clearInterval(initTimer), 2000)
})

watch(
  () => audioElRef?.value,
  async () => {
    if (audioElRef?.value && eqEnabled.value) {
      await buildGraph()
      updateFilterGains()
    }
  }
)

watch(
  () => bands.value.map((b) => b.value),
  () => {
    if (!eqEnabled.value) {
      applyEQ()
      return
    }
    updateFilterGains()
    applyEQ()
  },
  { deep: true }
)

watch(isEQOpen, (open) => {
  if (open) {
    nextTick(() => {
      updatePanelPosition()
      setTimeout(() => {
        updatePanelPosition()
      }, 10)
    })
  }
})

watch(
  playerVolume,
  (vol) => {
    updateMasterGainFromVolume(vol)
  }
)

onBeforeUnmount(async () => {
  document.removeEventListener('pointerdown', handleOutsideClick)
  window.removeEventListener('resize', updatePanelPosition)
  window.removeEventListener('scroll', updatePanelPosition, true)

  if (audioElRef?.value && playerVolume?.value !== null && playerVolume?.value !== undefined) {
    audioElRef.value.muted = false
    audioElRef.value.volume = (playerVolume.value ?? 100) / 100
  }
  await teardownGraph(true)
})
</script>

<style scoped>
.eqSection {
  position: relative;
  display: flex;
  align-items: center;
}

.eqButton {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.04));
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  cursor: pointer;
  padding: 0 10px 6px 10px;
  margin-left: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  transition: all 0.18s ease;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px) saturate(120%);
  -webkit-backdrop-filter: blur(10px) saturate(120%);
}

.eqIconWrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  line-height: 1;
}

.eqLabel {
  font-size: 9px;
  letter-spacing: 0.6px;
  opacity: 0.85;
  text-transform: uppercase;
}

.eqButton:hover {
  opacity: 0.95;
  border-color: rgba(255, 255, 255, 0.25);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.16);
}

.eqButton.active {
  opacity: 1;
}

.eqBars {
  display: inline-flex;
  align-items: flex-end;
  gap: 3px;
  height: 18px;
}

.eqBars span {
  width: 3px;
  height: 6px;
  background: linear-gradient(180deg, rgba(var(--accent-light-r), var(--accent-light-g), var(--accent-light-b), 0.9) 0%, rgba(var(--accent-r), var(--accent-g), var(--accent-b), 0.9) 100%);
  border-radius: 2px;
  transform-origin: bottom;
  opacity: 0.9;
}

.eqBars span:nth-child(2) {
  background: linear-gradient(180deg, #7ad7ff 0%, #3ab0ff 100%);
}

.eqBars span:nth-child(3) {
  background: linear-gradient(180deg, #b4ff7a 0%, #3ddc84 100%);
}

.eqBars.animate span:nth-child(1) {
  animation: eqBarPulse 0.9s ease-in-out infinite;
}

.eqBars.animate span:nth-child(2) {
  animation: eqBarPulse 0.9s ease-in-out infinite;
  animation-delay: 0.12s;
}

.eqBars.animate span:nth-child(3) {
  animation: eqBarPulse 0.9s ease-in-out infinite;
  animation-delay: 0.24s;
}

@keyframes eqBarPulse {
  0% { transform: scaleY(0.6); }
  25% { transform: scaleY(1.3); }
  50% { transform: scaleY(0.8); }
  75% { transform: scaleY(1.1); }
  100% { transform: scaleY(0.6); }
}

.eqPanel {
  position: fixed;
  bottom: 0;
  left: 0;
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.62), rgba(20, 20, 20, 0.48));
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 12px;
  padding: 16px;
  min-width: 380px;
  backdrop-filter: blur(22px) saturate(140%);
  -webkit-backdrop-filter: blur(22px) saturate(140%);
  background-clip: padding-box;
  z-index: 2000;
  box-shadow: 0 10px 36px rgba(0, 0, 0, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.eqPop-enter-from,
.eqPop-leave-to {
  opacity: 0;
  transform: translateY(6px) scale(0.96);
}

.eqPop-enter-active,
.eqPop-leave-active {
  transition: opacity 140ms ease, transform 140ms ease;
}

.eqHeader {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  margin-bottom: 16px;
}

.eqHeader h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
}

.eqBandsHidden {
  display: none;
}

.eqSlider {
  flex: 1;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
  cursor: pointer;
}

.eqSlider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #fff;
  cursor: pointer;
  transition: box-shadow 0.2s;
}

.eqSlider::-webkit-slider-thumb:hover {
  box-shadow: 0 0 8px rgba(255, 255, 255, 0.5);
}

.eqSlider::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #fff;
  cursor: pointer;
  border: none;
  transition: box-shadow 0.2s;
}

.eqSlider::-moz-range-thumb:hover {
  box-shadow: 0 0 8px rgba(255, 255, 255, 0.5);
}
</style>
