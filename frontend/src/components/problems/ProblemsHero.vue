<script setup>
import { pickRandomPageQuote } from '@/data/pageQuotes.js'
import AppPageHeader from '../layout/AppPageHeader.vue'

defineProps({
  totalCount: {
    type: [Number, String],
    default: '—',
  },
  yearCount: {
    type: [Number, String],
    default: '—',
  },
  topicCount: {
    type: [Number, String],
    default: '—',
  },
})

const quote = pickRandomPageQuote()
</script>

<template>
  <section class="bank-header">
    <AppPageHeader title="高考数学题库" :quote="quote" heading-id="bank-page-title">
      <template #aside>
        <dl class="bank-header-stats" aria-label="题库概况">
          <div>
            <dt>已收录</dt>
            <dd>{{ totalCount }}</dd>
          </div>
          <div>
            <dt>真题年份</dt>
            <dd>{{ yearCount }}</dd>
          </div>
          <div>
            <dt>知识专题</dt>
            <dd>{{ topicCount }}</dd>
          </div>
        </dl>
      </template>
    </AppPageHeader>
  </section>
</template>
