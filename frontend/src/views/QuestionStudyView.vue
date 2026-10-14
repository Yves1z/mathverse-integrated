<script setup>
import QuestionView from './QuestionView.vue'
import '../assets/styles/question-study.css'

defineProps({
  problemNumber: {
    type: String,
    required: true,
  },
})
</script>

<template>
  <QuestionView display-mode="study" :problem-number="problemNumber" />
</template>
