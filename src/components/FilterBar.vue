<template>
  <div class="filter-wrap">
    <button
      v-show="canScrollLeft"
      class="filter-arrow left"
      type="button"
      @mousedown.prevent.stop="startArrowScroll(-1)"
      @mouseup="stopArrowScroll"
      @mouseleave="stopArrowScroll"
      @click.stop="nudgeArrow(-1)"
      aria-label="Scroll left"
    >
      &lt;
    </button>

    <div
      ref="barRef"
      class="filter-bar"
      @mousedown="handleBarMouseDown"
      @mousemove="handleBarMouseMove"
      @mouseup="handleBarMouseUp"
      @mouseleave="handleBarMouseUp"
      @scroll="updateScrollState"
    >
      <button
        v-for="opt in options"
        :key="String(opt)"
        :class="['filter-btn', { active: modelValue === opt }]"
        type="button"
        @click="handleOptionClick(opt)"
      >
        {{ opt }}
      </button>
    </div>

    <button
      class="filter-arrow right"
      type="button"
      @mousedown.prevent.stop="startArrowScroll(1)"
      @mouseup="stopArrowScroll"
      @mouseleave="stopArrowScroll"
      @click.stop="nudgeArrow(1)"
      aria-label="Scroll right"
    >
      &gt;
    </button>

    <div v-if="showSearch" class="search-box">
      <input
        :value="search"
        type="search"
        :placeholder="searchPlaceholder"
        spellcheck="false"
        :aria-label="searchAriaLabel"
        @input="onSearchInput"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, onBeforeUnmount } from 'vue'

defineProps({
  options: { type: Array, default: () => [] },
  modelValue: { type: String, default: 'All' },
  search: { type: String, default: '' },
  searchPlaceholder: { type: String, default: '' },
  searchAriaLabel: { type: String, default: 'Search' },
  showSearch: { type: Boolean, default: true },
})

const emit = defineEmits(['update:modelValue', 'update:search', 'change'])

const barRef = ref(null)
const canScrollLeft = ref(false)

let isDragging = false
let dragStartX = 0
let dragScrollLeft = 0
let wasDragged = false
let arrowScrollRaf = null

function updateScrollState() {
  if (!barRef.value) return
  canScrollLeft.value = barRef.value.scrollLeft > 0
}

function getNudgeDistance() {
  const bar = barRef.value
  if (!bar) return 120

  const firstBtn = bar.querySelector('.filter-btn')
  if (!firstBtn) return 120

  const btnRect = firstBtn.getBoundingClientRect()
  const cs = getComputedStyle(bar)
  const gapPx = parseFloat(cs.columnGap || cs.gap || '0') || 0
  return Math.max(60, (btnRect.width + gapPx) * 3)
}

function handleBarMouseDown(event) {
  if (event.button !== 0 || !barRef.value) return

  isDragging = true
  wasDragged = false
  dragStartX = event.clientX
  dragScrollLeft = barRef.value.scrollLeft
  event.preventDefault()
}

function handleBarMouseMove(event) {
  if (!isDragging || !barRef.value) return

  const deltaX = event.clientX - dragStartX
  barRef.value.scrollLeft = dragScrollLeft - deltaX
  if (Math.abs(deltaX) > 5) {
    wasDragged = true
  }
}

function handleBarMouseUp() {
  isDragging = false
}

function stopArrowScroll() {
  if (arrowScrollRaf) {
    cancelAnimationFrame(arrowScrollRaf)
    arrowScrollRaf = null
  }
}

function startArrowScroll(dir) {
  if (!barRef.value) return

  stopArrowScroll()

  const step = () => {
    const bar = barRef.value
    if (!bar) return

    const maxLeft = Math.max(0, bar.scrollWidth - bar.clientWidth)
    const perStep = 3
    const next = Math.max(0, Math.min(maxLeft, bar.scrollLeft + dir * perStep))
    if (Math.abs(next - bar.scrollLeft) < 1) {
      stopArrowScroll()
      return
    }
    bar.scrollLeft = next
    arrowScrollRaf = requestAnimationFrame(step)
  }

  arrowScrollRaf = requestAnimationFrame(step)
}

function nudgeArrow(dir) {
  const bar = barRef.value
  if (!bar) return

  const dist = getNudgeDistance()
  const maxLeft = Math.max(0, bar.scrollWidth - bar.clientWidth)
  const target = Math.max(0, Math.min(maxLeft, bar.scrollLeft + dir * dist))
  bar.scrollTo({ left: target, behavior: 'smooth' })
}

function scrollActiveIntoView() {
  const bar = barRef.value
  if (!bar) return

  const activeBtn = bar.querySelector('.filter-btn.active')
  if (activeBtn) {
    activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }
}

function handleOptionClick(opt) {
  if (wasDragged) {
    wasDragged = false
    return
  }

  emit('update:modelValue', opt)
  emit('change', opt)

  setTimeout(() => {
    scrollActiveIntoView()
  }, 10)
}

function onSearchInput(e) {
  emit('update:search', e.target.value)
}

function getScrollLeft() {
  return barRef.value?.scrollLeft ?? 0
}

function setScrollLeft(val) {
  if (!barRef.value) return

  barRef.value.scrollLeft = val || 0
  nextTick(() => {
    scrollActiveIntoView()
  })
}

defineExpose({
  getScrollLeft,
  setScrollLeft,
  scrollActiveIntoView,
})

onBeforeUnmount(() => {
  stopArrowScroll()
})
</script>

<style scoped>
.filter-wrap {
  flex: 1;
  height: 52px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0.5rem 0.75rem;
  background: rgba(8, 7, 12, 0.32);
  backdrop-filter: blur(14px) saturate(1.05);
  -webkit-backdrop-filter: blur(14px) saturate(1.05);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 26px;
  box-shadow: 0 8px 20px rgba(0,0,0,0.25);
  cursor: default;
  user-select: none;
  min-width: 0;
  white-space: nowrap;
}

.filter-bar {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  gap: 0.25rem;
  flex: 1;
  width: auto;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 0;
}

.filter-bar:active {
  cursor: grabbing;
}

.filter-bar::-webkit-scrollbar { display: none; }
.filter-bar { scrollbar-width: none; -ms-overflow-style: none; }

.filter-arrow {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: transparent;
  border: none;
  color: rgba(255,255,255,0.92);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  user-select: none;
  padding: 0;
  outline: none;
}
.filter-arrow:hover { background: rgba(255,255,255,0.08); }
.filter-arrow:active { background: rgba(255,255,255,0.12); transform: scale(0.96); }
.filter-arrow:focus-visible { box-shadow: 0 0 0 2px rgba(var(--accent-r), var(--accent-g), var(--accent-b), 0.3); }
.filter-arrow.left { margin-right: 6px; }
.filter-arrow.right { margin-left: 6px; }

.search-box {
  display: flex;
  align-items: center;
  height: 32px;
  min-width: 140px;
  width: 180px;
  max-width: 320px;
  transition: width 0.2s ease;
}

.search-box:focus-within {
  width: min(320px, 34vw);
}

.search-box input {
  width: 100%;
  height: 100%;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.9);
  padding: 0 12px;
  font-size: 0.85rem;
  outline: none;
}

.search-box input::placeholder {
  color: rgba(255, 255, 255, 0.55);
}

.search-box input:focus {
  border-color: rgba(var(--accent-r), var(--accent-g), var(--accent-b), 0.45);
  box-shadow: 0 0 0 2px rgba(var(--accent-r), var(--accent-g), var(--accent-b), 0.18);
}

.filter-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  border-radius: 50%;
  transition: transform 0.12s ease, background 0.12s ease, color 0.12s ease;
}

.filter-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.9);
}

.filter-btn.active {
  background: rgba(var(--accent-r), var(--accent-g), var(--accent-b), 0.12);
  color: rgba(var(--accent-light-r), var(--accent-light-g), var(--accent-light-b), 0.9);
}

.filter-btn:active {
  transform: scale(0.96);
}

@media (max-width: 720px) {
  .filter-wrap {
    padding: 0.5rem 0.6rem;
    gap: 8px;
  }

  .search-box {
    min-width: 120px;
    width: 140px;
  }

  .search-box:focus-within {
    width: min(280px, 70vw);
  }
}
</style>
