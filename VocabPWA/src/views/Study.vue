<template>
  <section class="stackCol">
    <div class="stack" style="justify-content:space-between; flex-wrap:wrap;">
      <h2 style="margin:0">학습</h2>
      <div class="stack" style="align-items:center; gap:16px;">
        <label class="stack" style="align-items:center; gap:8px; cursor:pointer;">
          <input type="checkbox" v-model="showAllCards" style="margin:0;">
          <span>전체보기</span>
        </label>
        <span style="color:var(--color-text-muted)">진행: {{ store.index + 1 }} / {{ store.queue.length }}</span>
      </div>
    </div>

    <!-- 에러 메시지 표시 -->
    <div v-if="error" class="card" style="background: var(--color-danger); color: white; padding: 16px; margin-bottom: 16px; text-align: center;">
      <div>⚠️ {{ error }}</div>
      <button class="btn" @click="error = null" style="margin-top: 12px; background: rgba(255,255,255,0.2); border-color: rgba(255,255,255,0.3); color: white;">
        닫기
      </button>
    </div>

    <!-- 전체보기 모드 -->
    <div v-if="showAllCards && store.queue.length > 0" class="all-cards-container">
      <div class="all-cards-header">
        <h3 style="margin:0;">전체 학습 카드 ({{ store.queue.length }}개)</h3>
        <p style="margin:8px 0 0 0; color:var(--color-text-muted); font-size:14px;">
          모든 카드를 한 번에 볼 수 있습니다. 스크롤하여 학습하세요.
        </p>
      </div>
      <div class="all-cards-list">
        <div 
          v-for="(word, index) in store.queue" 
          :key="word.id" 
          :class="['all-card-item', { 'current': index === store.index }]"
        >
          <div class="card-number">{{ index + 1 }}</div>
          <div class="card-content" v-html="word.html_content"></div>
          <div class="card-actions">
            <button class="btn btn-sm" @click="jumpToCard(index)" v-if="index !== store.index">
              이 카드로 이동
            </button>
            <span v-else class="current-indicator">현재 학습 중</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 단일 카드 모드 -->
    <div v-else class="center">
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
const showAllCards = ref(false)

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

const jumpToCard = (index: number) => {
  if (index >= 0 && index < store.queue.length) {
    store.index = index
    // 전체보기를 해제하고 해당 카드로 이동
    showAllCards.value = false
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

<style scoped>
/* 전체보기 컨테이너 */
.all-cards-container {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
}

.all-cards-header {
  text-align: center;
  margin-bottom: 24px;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 16px;
}

.all-cards-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.all-card-item {
  position: relative;
  border: 2px solid var(--color-border);
  border-radius: 16px;
  padding: 20px;
  background: var(--color-surface);
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.all-card-item.current {
  border-color: var(--color-brand);
  background: color-mix(in oklab, var(--color-brand) 5%, var(--color-surface));
  box-shadow: 0 4px 20px rgba(102, 126, 234, 0.25);
  transform: scale(1.02);
}

.all-card-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0,0,0,0.15);
}

.card-number {
  position: absolute;
  top: -10px;
  left: 20px;
  background: var(--color-brand);
  color: white;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 14px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}

.card-content {
  margin: 10px 0 20px 0;
  font-size: 15px;
  line-height: 1.6;
}

/* 카드 내부 스타일 조정 */
.card-content :deep(.voc) {
  font-size: 14px;
}

.card-content :deep(.voc .hw) {
  font-size: 20px;
  font-weight: 700;
}

.card-content :deep(.voc .phon) {
  font-size: 13px;
}

.card-content :deep(.voc .examples) {
  margin-top: 12px;
}

.card-content :deep(.voc .ex) {
  padding: 8px 10px;
  margin-bottom: 8px;
}

.card-actions {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
}

.current-indicator {
  background: var(--color-brand);
  color: white;
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
}

/* 반응형 디자인 */
@media (max-width: 768px) {
  .all-cards-container {
    padding: 0 12px;
  }
  
  .all-card-item {
    padding: 16px;
  }
  
  .card-content {
    font-size: 14px;
  }
  
  .card-content :deep(.voc .hw) {
    font-size: 18px;
  }
}
</style>