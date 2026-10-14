<script setup>
import { useRouter } from "vue-router";

const router = useRouter();

function openCoffee() {
  router.push("/support");
}
</script>

<template>
  <header class="home-mode-header">
    <button
      class="coffee-button"
      type="button"
      aria-label="Buy me a coffee"
      title="Buy me a coffee"
      @click="openCoffee"
    >
      <svg
        class="coffee-icon"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <!-- 蒸汽 -->
        <path d="M8 3c1 1 1 2 0 3" />
        <path d="M12 2c1.2 1.2 1.2 2.4 0 3.6" />
        <path d="M16 3c1 1 1 2 0 3" />

        <!-- 杯子 -->
        <path d="M5 9h12v4.5A5.5 5.5 0 0 1 11.5 19h-1A5.5 5.5 0 0 1 5 13.5V9Z" />

        <!-- 杯把 -->
        <path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17" />

        <!-- 杯碟 -->
        <path d="M4 21h15" />
      </svg>
    </button>
  </header>
</template>

<style scoped>
.home-mode-header {
  display: flex;
  align-items: center;
}

/* 按钮 */
.coffee-button {
  width: 38px;
  height: 38px;

  /* 防止按钮被 flex 布局压缩 */
  flex: 0 0 38px;

  display: inline-flex;
  align-items: center;
  justify-content: center;

  padding: 0;
  margin: 0;

  border: none;
  border-radius: 8px;

  background: transparent;
  color: #222;

  cursor: pointer;

  /* 清除浏览器默认按钮样式 */
  appearance: none;
  -webkit-appearance: none;

  transition:
    background-color 0.15s ease,
    transform 0.1s ease;
}

/* 鼠标经过 */
.coffee-button:hover {
  background: rgba(0, 0, 0, 0.06);
}

/* 点击 */
.coffee-button:active {
  transform: scale(0.94);
}

/* 键盘操作时 */
.coffee-button:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}

/* SVG 图标 */
.coffee-icon {
  width: 23px;
  height: 23px;

  display: block;

  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;

  /* 防止 SVG 被压缩 */
  flex-shrink: 0;
}
</style>