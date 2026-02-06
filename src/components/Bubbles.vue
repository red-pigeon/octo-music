<template>
  <div class="bubbles" aria-hidden="true">
    <span class="bubble b1"></span>
    <span class="bubble b2"></span>
    <span class="bubble b3"></span>
    <span class="bubble b4"></span>
    <span class="bubble b5"></span>
    <span class="bubble b6"></span>
    <span class="bubble b7"></span>
    <span class="bubble b8"></span>
  </div>
</template>

<style scoped>
.bubbles {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}

.bubble {
  position: absolute;
  bottom: -20px;
  left: 50%;
  width: 10px;
  height: 10px;
  border-radius: 999px;
  overflow: hidden;
  --bubble-tint: rgba(var(--accent-r), var(--accent-g), var(--accent-b), 0.55);
  background:
    radial-gradient(circle at 30% 28%, rgba(255, 255, 255, 0.28), rgba(255, 255, 255, 0.10) 36%, rgba(255, 255, 255, 0.04) 58%, rgba(255, 255, 255, 0) 72%),
    radial-gradient(circle at 70% 78%, rgba(var(--accent-r), var(--accent-g), var(--accent-b), 0.16), rgba(255, 255, 255, 0) 55%);
  border: 1px solid rgba(var(--accent-r), var(--accent-g), var(--accent-b), 0.18);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.05),
    0 0 18px rgba(var(--accent-r), var(--accent-g), var(--accent-b), 0.06);
  opacity: 0;
  animation: bubbleUp 3.2s linear infinite;
  transform: translate(-50%, 0);
  will-change: transform, opacity;
}

.bubble::before {
  content: '';
  position: absolute;
  inset: -10% -10% auto auto;
  width: 70%;
  height: 70%;
  border-radius: 999px;
  background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0) 55%);
  opacity: 0.45;
  transform: rotate(-18deg);
}

.bubble::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background:
    radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0) 62%, rgba(var(--accent-r), var(--accent-g), var(--accent-b), 0.26) 74%, rgba(255, 255, 255, 0) 82%);
  opacity: 0.28;
}

@keyframes bubbleUp {
  0% {
    transform: translate(-50%, 0) scale(0.95);
    opacity: 0;
  }

  10% {
    opacity: 0.55;
  }

  100% {
    transform: translate(-50%, -220px) scale(1.12);
    opacity: 0;
  }
}

.b1 {
  left: 10%;
  width: 6px;
  height: 6px;
  animation-duration: 2.6s;
  animation-delay: 0s;
}

.b2 {
  left: 22%;
  width: 10px;
  height: 10px;
  animation-duration: 3s;
  animation-delay: 0.6s;
}

.b3 {
  left: 35%;
  width: 8px;
  height: 8px;
  animation-duration: 2.8s;
  animation-delay: 1.2s;
}

.b4 {
  left: 48%;
  width: 12px;
  height: 12px;
  animation-duration: 3.4s;
  animation-delay: 0.9s;
}

.b5 {
  left: 62%;
  width: 7px;
  height: 7px;
  animation-duration: 2.7s;
  animation-delay: 1.6s;
}

.b6 {
  left: 74%;
  width: 11px;
  height: 11px;
  animation-duration: 3.6s;
  animation-delay: 0.3s;
}

.b7 {
  left: 86%;
  width: 8px;
  height: 8px;
  animation-duration: 3.1s;
  animation-delay: 1s;
}

.b8 {
  left: 95%;
  width: 6px;
  height: 6px;
  animation-duration: 2.9s;
  animation-delay: 1.8s;
}

@media (prefers-reduced-motion: reduce) {
  .bubble {
    animation: none;
  }
}
</style>
