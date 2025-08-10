<template>
  <select v-model="model" @change="$emit('change', model)">
    <option value="all">전체</option>
    <option v-for="n in notebooks" :key="n.id" :value="String(n.id)">{{ n.name }}</option>
  </select>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useStudyStore } from '../stores/study'

const store = useStudyStore()
const notebooks = computed(() => store.notebooks)
const model = defineModel<string>({ default: 'all' })
</script>