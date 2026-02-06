<template>
  <div class="eqFooter">
    <label class="eqToggle" :class="{ active: eqEnabled }">
      <input type="checkbox" :checked="eqEnabled" @change="emit('toggle', $event.target.checked)" />
      <span class="toggleLabel">{{ eqEnabled ? 'EQ enabled' : 'EQ disabled' }}</span>
    </label>

    <button type="button" class="eqResetBtn" @click="emit('reset')">
      Reset
    </button>
  </div>
</template>

<script setup>
defineProps({
  eqEnabled: {
    type: Boolean,
    required: true,
  },
})

const emit = defineEmits(['toggle', 'reset'])
</script>

<style scoped>
.eqFooter {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 6px;
}

.eqToggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #fff;
  position: relative;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  padding: 7px 12px;
  cursor: pointer;
  transition: transform 0.12s ease, background 0.12s ease, border-color 0.12s ease, box-shadow 0.12s ease, color 0.12s ease;
}

.eqToggle input {
  position: absolute;
  opacity: 0;
  inset: 0;
  cursor: pointer;
}

.eqToggle:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.18);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.eqToggle.active {
  background: rgba(var(--accent-r), var(--accent-g), var(--accent-b), 0.18);
  border-color: rgba(var(--accent-r), var(--accent-g), var(--accent-b), 0.6);
  color: #fff;
  box-shadow: 0 6px 16px rgba(var(--accent-r), var(--accent-g), var(--accent-b), 0.25);
}

.eqToggle:active {
  transform: none;
}

.toggleLabel {
  letter-spacing: 0.1px;
}

.eqResetBtn {
  flex: 1;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  color: #fff;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.eqResetBtn:hover {
  background: rgba(255, 255, 255, 0.1);
}
</style>
