<script setup>
import QuestionView from './QuestionView.vue'
import '../assets/styles/question-reader.css'

defineProps({
  problemNumber: {
    type: String,
    required: true,
  },
})
</script>

<template>
  <QuestionView display-mode="reader" :problem-number="problemNumber" />
</template>
