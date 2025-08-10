<template>
  <section class="stackCol">
    <div class="stack" style="justify-content:space-between; flex-wrap:wrap;">
      <h2 style="margin:0">학습</h2>
      <span style="color:var(--color-text-muted)">진행: {{ store.index + 1 }} / {{ store.queue.length }}</span>
    </div>

    <div class="center">
      <div style="max-width:720px; width:100%">
        <FlashCard
          v-if="current"
          :word="current"
          @next="next"
          @memorized="memorize"
        />
        <div v-else class="card center" style="min-height:200px; padding:16px;">
          학습할 카드가 없습니다.
          <div class="mt3">
            <button class="btn btnPrimary" @click="reload">큐 불러오기</button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useStudyStore } from '../stores/study'
import FlashCard from '../components/FlashCard.vue'
const store = useStudyStore()
const current = computed(() => store.queue[store.index])
const next = () => store.next()
const memorize = () => store.memorizeCurrent()
const reload = () => store.loadQueue()
onMounted(async () => { if (!store.queue.length) await store.loadQueue() })
</script>