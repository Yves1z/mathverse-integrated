<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

function goBack() {
  if (window.history.state?.back) {
    router.back()
    return
  }

  router.replace({ name: 'home' })
}
</script>

<template>
  <main class="about-page app-page">
    <button class="about-back-button" type="button" aria-label="返回上一页" @click="goBack">
      ←
    </button>

    <div class="about-container app-page-container app-page-container--narrow">
      <header class="about-header">
        <h1>About</h1>
      </header>
    </div>
  </main>
</template>

<style scoped>
.about-page {
  position: relative;
  width: 100%;
  min-height: 100vh;
  min-height: 100svh;
  box-sizing: border-box;
  padding: 0 24px clamp(36px, 5.5vh, 64px);
  background: #f7f9fb;
  color: #334452;
}

.about-back-button {
  position: absolute;
  top: 28px;
  left: 30px;
  z-index: 10;
  padding: 0;
  border: none;
  background: transparent;
  color: #344b5d;
  font-size: 26px;
  font-weight: 300;
  line-height: 1;
  cursor: pointer;
  transition:
    color 0.15s ease,
    transform 0.15s ease;
}

.about-back-button:hover {
  color: #174f7c;
  transform: translateX(-2px);
}

.about-container {
  position: relative;
  width: 100%;
  max-width: 1240px;
  margin: 0 auto;
  padding: 0;
}

.about-header {
  padding-top: clamp(96px, 13vh, 140px);
  text-align: center;
}

.about-header h1 {
  margin: 0;
  color: #174f7c;
  font-family: Georgia, 'Times New Roman', 'Noto Serif SC', serif;
  font-size: clamp(42px, 2.95vw, 56px);
  font-weight: 500;
  line-height: 1.1;
  letter-spacing: 0.005em;
}

@media (max-width: 600px) {
  .about-page {
    padding: 0 20px 48px;
  }

  .about-back-button {
    top: 22px;
    left: 20px;
  }

  .about-header {
    padding-top: 100px;
  }

  .about-header h1 {
    font-size: 42px;
  }
}
</style>
