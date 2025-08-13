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
        <p style="margin:8px 0 12px 0; color:var(--color-text-muted); font-size:14px;">
          모든 플래시카드를 세로로 나열하여 한 번에 볼 수 있습니다. 카드를 클릭하여 뒤집어보세요.
        </p>
        <!-- 전체보기에서 전체 진행상황 표시 -->
        <div class="all-cards-actions">
          <div style="text-align: center;">
            현재 진행: {{ store.index + 1 }} / {{ store.queue.length }}
          </div>
        </div>
      </div>
      <div class="all-cards-grid">
        <div 
          v-for="(word, index) in store.queue" 
          :key="word.id" 
          :ref="el => cardRefs[index] = el"
          :class="['flashcard-item', { 'current': index === store.index }]"
        >
          <div class="card-number">{{ index + 1 }}</div>
          <div class="flashcard-wrap" @click="toggleCard(index)">
            <div :class="['flashcard-inner', { 'flipped': flippedCards[index] }]">
              <!-- 앞면: 단어와 발음 -->
              <div class="flashcard-front">
                <div class="word-head">{{ word.headword }}</div>
                <div v-if="word.phonetic" class="word-phonetic">{{ word.phonetic }}</div>
                <button class="speak-btn" @click.stop="speakWord(word.headword)" title="발음 듣기">🔊</button>
              </div>
              <!-- 뒷면: 의미와 예문 -->
              <div class="flashcard-back">
                <div class="card-content" v-html="word.html_content"></div>
              </div>
            </div>
          </div>
          <div class="card-actions">
            <button class="btn btn-sm" @click="nextFromCard(index)" :disabled="index < store.index">
              다음 →
            </button>
            <button class="btn btnPrimary btn-sm" @click="memorizeFromCard(index)" :disabled="index < store.index">
              외웠어요 ✓
            </button>
            <span v-if="index === store.index" class="current-indicator">현재 학습 중</span>
            <span v-else-if="index < store.index" class="completed-indicator">완료</span>
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
const flippedCards = ref<boolean[]>([])
const cardRefs = ref<HTMLElement[]>([])

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
    initializeFlippedCards()
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

const toggleCard = (index: number) => {
  flippedCards.value[index] = !flippedCards.value[index]
}

const speakWord = async (word: string) => {
  try {
    await store.speakNow(word, true)
  } catch (error) {
    console.error('음성 재생 실패:', error)
  }
}

// 카드 큐가 변경될 때 flipped 상태 초기화
const initializeFlippedCards = () => {
  flippedCards.value = new Array(store.queue.length).fill(false)
}

// 전체보기에서 특정 카드의 다음 버튼 클릭
const nextFromCard = async (cardIndex: number) => {
  if (cardIndex !== store.index) return
  
  try {
    await store.next()
    scrollToCurrentCard()
    error.value = null
  } catch (err) {
    console.error('Next 실행 오류:', err)
    error.value = '다음 카드로 이동하는 중 오류가 발생했습니다.'
  }
}

// 전체보기에서 특정 카드의 외웠어요 버튼 클릭
const memorizeFromCard = async (cardIndex: number) => {
  if (cardIndex !== store.index) return
  
  try {
    await store.memorizeCurrent()
    scrollToCurrentCard()
    error.value = null
  } catch (err) {
    console.error('Memorize 실행 오류:', err)
    error.value = '암기 처리 중 오류가 발생했습니다.'
  }
}

// 현재 카드로 스크롤
const scrollToCurrentCard = () => {
  if (store.index < cardRefs.value.length && cardRefs.value[store.index]) {
    cardRefs.value[store.index].scrollIntoView({ 
      behavior: 'smooth', 
      block: 'center' 
    })
  }
}

onMounted(async () => { 
  try {
    if (!store.queue.length) await store.loadQueue()
    initializeFlippedCards()
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

.all-cards-grid {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}

.flashcard-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}

.flashcard-item.current {
  transform: scale(1.05);
}

/* 플래시카드 스타일 */
.flashcard-wrap {
  perspective: 1200px;
  cursor: pointer;
  user-select: none;
  width: 100%;
  max-width: 700px;
  margin-bottom: 16px;
}

.flashcard-inner {
  position: relative;
  transform-style: preserve-3d;
  transition: transform 0.5s cubic-bezier(.2,.8,.2,1);
  width: 100%;
  height: 400px;
}

.flashcard-inner.flipped {
  transform: rotateY(180deg);
}

.flashcard-front,
.flashcard-back {
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  border-radius: var(--radii-lg);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  padding: 28px;
}

.flashcard-front {
  background: linear-gradient(180deg, var(--color-surface), color-mix(in oklab, var(--color-surface) 95%, var(--color-brand) 5%));
  position: relative;
}

.flashcard-back {
  transform: rotateY(180deg);
  background: linear-gradient(180deg, var(--color-surface), color-mix(in oklab, var(--color-surface) 95%, var(--color-brand) 3%));
}

.word-head {
  font-size: 34px;
  font-weight: 800;
  color: var(--color-text);
  text-shadow: 0 2px 4px rgba(0,0,0,.2);
  margin-bottom: 16px;
  letter-spacing: 0.3px;
}

.word-phonetic {
  font-size: 16px;
  color: var(--color-text-muted);
  margin-bottom: 16px;
}

.speak-btn {
  position: absolute;
  bottom: 20px;
  right: 20px;
  background: rgba(255,255,255,0.2);
  border: 1px solid rgba(255,255,255,0.3);
  border-radius: 50%;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 18px;
}

.speak-btn:hover {
  background: rgba(255,255,255,0.3);
  transform: scale(1.1);
}

.card-number {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--color-brand);
  color: white;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 14px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.3);
  z-index: 10;
}

.flashcard-item.current .card-number {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { transform: translateX(-50%) scale(1); }
  50% { transform: translateX(-50%) scale(1.1); }
}

.card-content {
  font-size: 16px;
  line-height: 1.6;
  width: 100%;
  color: var(--color-text);
  overflow-y: auto;
  max-height: 180px;
}

/* 카드 내부 스타일 조정 */
.card-content :deep(.voc) {
  font-size: 13px;
}

.card-content :deep(.voc .hw) {
  display: none; /* 앞면에 이미 표시됨 */
}

.card-content :deep(.voc .phon) {
  display: none; /* 앞면에 이미 표시됨 */
}

.card-content :deep(.voc .meta) {
  display: none; /* 번호는 위에 표시됨 */
}

.card-content :deep(.voc .defs) {
  margin-bottom: 16px;
}

.card-content :deep(.voc .examples) {
  margin-top: 12px;
}

.card-content :deep(.voc .ex) {
  padding: 8px 10px;
  margin-bottom: 8px;
  background: rgba(0,0,0,0.02);
  border-radius: 8px;
}

.card-content :deep(.voc .year-tag) {
  font-size: 11px;
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

.completed-indicator {
  background: #10b981;
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
  
  .all-cards-grid {
    gap: 16px;
    padding: 12px;
  }
  
  .flashcard-wrap {
    max-width: 100%;
  }
  
  .flashcard-inner {
    height: 240px;
  }
  
  .word-head {
    font-size: 24px;
  }
  
  .word-phonetic {
    font-size: 14px;
  }
  
  .flashcard-front,
  .flashcard-back {
    padding: 20px;
  }
}

@media (max-width: 480px) {
  .all-cards-grid {
    gap: 12px;
  }
  
  .flashcard-inner {
    height: 200px;
  }
  
  .word-head {
    font-size: 20px;
  }
}
</style>