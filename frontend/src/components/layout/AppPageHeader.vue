<script setup>
defineProps({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: '',
  },
  quote: {
    type: String,
    default: '',
  },
  headingId: {
    type: String,
    default: undefined,
  },
})
</script>

<template>
  <header class="app-page-header" :aria-labelledby="headingId">
    <div class="app-page-heading">
      <h1 :id="headingId">{{ title }}</h1>
      <p v-if="description">{{ description }}</p>
      <p v-if="quote" class="app-page-quote">{{ quote }}</p>
    </div>
    <div v-if="$slots.aside" class="app-page-header-aside">
      <slot name="aside" />
    </div>
    <div v-if="$slots.actions" class="app-page-header-actions">
      <slot name="actions" />
    </div>
  </header>
</template>
