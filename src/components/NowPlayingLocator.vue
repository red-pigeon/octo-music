<template>
  <button
    class="nowPlayingLocator"
    type="button"
    :title="titleText"
    :aria-label="ariaLabel"
    @click="$emit('click')"
  >
    <span class="nowPlayingLocatorMain">{{ label }}</span>
    <span class="nowPlayingLocatorSub">
      <span class="nowPlayingLocatorSubIcon" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path :d="subIconPath" /></svg>
      </span>
      <span class="nowPlayingLocatorSubText">{{ subText }}</span>
    </span>
  </button>
</template>

<script setup>
defineProps({
  label: { type: String, default: 'Now playing' },
  titleText: { type: String, default: '' },
  ariaLabel: { type: String, default: '' },
  subIconPath: { type: String, default: '' },
  subText: { type: String, default: '' },
})

defineEmits(['click'])
</script>

<style scoped>
.nowPlayingLocator {
  position: fixed;
  right: 24px;
  bottom: 160px;
  z-index: 20;
  padding: 8px 10px;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-width: 0;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(12, 12, 16, 0.78);
  backdrop-filter: blur(12px) saturate(120%);
  -webkit-backdrop-filter: blur(12px) saturate(120%);
  color: rgba(255, 255, 255, 0.92);
  cursor: pointer;
  user-select: none;
  box-shadow: 0 10px 22px rgba(0, 0, 0, 0.45);
}

.nowPlayingLocator:hover {
  border-color: rgba(var(--accent-r), var(--accent-g), var(--accent-b), 0.55);
}

.nowPlayingLocatorMain {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.2px;
  line-height: 1.05;
  white-space: nowrap;
}

.nowPlayingLocatorSub {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.75);
  line-height: 1.05;
  white-space: nowrap;
}

.nowPlayingLocatorSubIcon {
  width: 14px;
  height: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.nowPlayingLocatorSubIcon svg {
  width: 14px;
  height: 14px;
  fill: currentColor;
}

.nowPlayingLocatorSubText {
  font-variant-numeric: tabular-nums;
  min-width: 18px;
  text-align: center;
}

@media (max-width: 720px) {
  .nowPlayingLocator {
    right: 12px;
    bottom: 154px;
  }
}
</style>
