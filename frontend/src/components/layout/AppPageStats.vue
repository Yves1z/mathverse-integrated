<script setup>
defineProps({
  ariaLabel: {
    type: String,
    default: '页面概况',
  },
  items: {
    type: Array,
    required: true,
  },
})
</script>

<template>
  <dl class="app-page-stats" :aria-label="ariaLabel">
    <div v-for="item in items" :key="item.label">
      <dt>{{ item.label }}</dt>
      <dd>{{ item.value }}</dd>
    </div>
  </dl>
</template>

<style scoped>
.app-page-stats {
  display: grid;
  width: 460px;
  min-height: 80px;
  margin: 0;
  grid-auto-flow: column;
  grid-auto-columns: minmax(0, 1fr);
  border-top: 1px solid #bdcbd7;
  border-bottom: 1px solid #bdcbd7;
}

.app-page-stats > div {
  display: flex;
  min-width: 0;
  padding: 11px 18px 9px;
  flex-direction: column;
  justify-content: center;
}

.app-page-stats > div + div {
  border-left: 1px solid #cbd6df;
}

.app-page-stats dt {
  color: var(--color-ink-secondary);
  font-size: 13px;
  line-height: 1.35;
  white-space: nowrap;
}

.app-page-stats dd {
  margin: 2px 0 0;
  color: #0d4777;
  font-family: Georgia, 'Times New Roman', var(--font-display);
  font-size: 25px;
  line-height: 1.1;
  letter-spacing: 0.035em;
  font-variant-numeric: tabular-nums;
}

@media (min-width: 981px) {
  .app-page-stats {
    position: relative;
    top: 18px;
  }
}

@media (max-width: 1200px) {
  .app-page-stats {
    width: 420px;
  }
}

@media (max-width: 980px) {
  .app-page-stats {
    width: 100%;
    max-width: 480px;
  }
}

@media (max-width: 700px) {
  .app-page-stats {
    max-width: none;
    min-height: 74px;
  }

  .app-page-stats > div {
    padding: 10px 9px 8px;
  }

  .app-page-stats dt {
    font-size: 12px;
  }

  .app-page-stats dd {
    font-size: 21px;
  }
}
</style>
