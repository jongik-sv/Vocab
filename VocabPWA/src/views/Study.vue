<template>
  <section class="stackCol">
    <div class="stack" style="justify-content:space-between; flex-wrap:wrap;">
      <h2 style="margin:0">학습</h2>
      <span style="color:var(--color-text-muted)">진행: {{ store.index + 1 }} / {{ store.queue.length }}</span>
    </div>

    <!-- 에러 메시지 표시 -->
    <div v-if="error" class="card" style="background: var(--color-danger); color: white; padding: 16px; margin-bottom: 16px; text-align: center;">
      <div>⚠️ {{ error }}</div>
      <button class="btn" @click="error = null" style="margin-top: 12px; background: rgba(255,255,255,0.2); border-color: rgba(255,255,255,0.3); color: white;">
        닫기
      </button>
    </div>

    <div class="center">
      <div style="max-width:720px; width:100%">
        <FlashCard
          v-if="current && !error"
          :word="current"
          @next="next"
          @memorized="memorize"
        />
        <div v-else-if="!error" class="card center" style="min-height:200px; padding:16px;">
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
import { computed, onMounted, onErrorCaptured, ref } from 'vue'
import { useStudyStore } from '../stores/study'
import FlashCard from '../components/FlashCard.vue'

const store = useStudyStore()
const current = computed(() => store.queue[store.index])
const error = ref<string | null>(null)

const next = async () => {
  try {
    await store.next()
    error.value = null
  } catch (err) {
    console.error('Next 실행 오류:', err)
    error.value = '다음 카드로 이동하는 중 오류가 발생했습니다.'
  }
}

const memorize = async () => {
  try {
    await store.memorizeCurrent()
    error.value = null
  } catch (err) {
    console.error('Memorize 실행 오류:', err)
    error.value = '암기 처리 중 오류가 발생했습니다.'
  }
}

const reload = async () => {
  try {
    await store.loadQueue()
    error.value = null
  } catch (err) {
    console.error('Queue 로드 오류:', err)
    error.value = '학습 큐를 불러오는 중 오류가 발생했습니다.'
  }
}

onMounted(async () => { 
  try {
    if (!store.queue.length) await store.loadQueue()
  } catch (err) {
    console.error('초기 로드 오류:', err)
    error.value = '초기 데이터를 불러오는 중 오류가 발생했습니다.'
  }
})

// Vue 컴포넌트 에러 캐치
onErrorCaptured((err) => {
  console.error('컴포넌트 에러:', err)
  error.value = '컴포넌트에서 오류가 발생했습니다. 페이지를 새로고침해주세요.'
  return false // 에러 전파 방지
})
</script>