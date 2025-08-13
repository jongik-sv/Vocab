<template>
  <div class="flashcard-container">
    <div class="wrap" @click="flip = !flip" @keyup.space.prevent="flip = !flip" tabindex="0">
      <div class="inner" :class="{ flipped: flip }">
        <section class="face front">
          <div class="head">{{ word.headword }}</div>
          <button class="btn btnGhost" @click.stop="handleSpeak">🔊 발음</button>
        </section>
        <section class="face back">
          <div class="content" v-html="word.html_content" />
        </section>
      </div>
    </div>
    <div class="actions stack mt3">
      <button class="btn" @click="$emit('next')">다음 →</button>
      <button class="btn btnPrimary" @click="$emit('memorized')">외웠어요 ✓</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useStudyStore } from '../stores/study'
import { enableUserInteraction } from '../utils/tts'

const props = defineProps<{ word: any }>()

// emits 선언 추가
const emit = defineEmits<{
  next: []
  memorized: []
}>()

const flip = ref(false)
const store = useStudyStore()

const handleSpeak = async () => {
  // Chrome에서 사용자 상호작용 활성화
  enableUserInteraction()
  await store.speakNow(props.word.headword, true)
}

watch(() => props.word?.id, () => { flip.value = false })
onMounted(async () => {
  console.log('FlashCard: TTS 초기화 시작')
  await store.initTts()
  console.log('FlashCard: TTS 초기화 완료')
})
</script>

<style scoped>
.flashcard-container {
  width: 100%;
  max-width: 500px;
  margin: 0 auto;
}

.wrap { 
  perspective: 1200px;
  cursor: pointer;
  user-select: none;
}

.inner { 
  position: relative; 
  transform-style: preserve-3d; 
  transition: transform .5s cubic-bezier(.2,.8,.2,1);
  width: 100%;
  height: 260px;
}

.inner.flipped { 
  transform: rotateY(180deg); 
}

.face { 
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden; 
  padding: 28px; 
  border-radius: var(--radii-lg); 
  border: 1px solid var(--color-border); 
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
}

.front { 
  background: linear-gradient(180deg, var(--color-surface), color-mix(in oklab, var(--color-surface) 95%, var(--color-brand) 5%));
}

.back { 
  transform: rotateY(180deg); 
  background: linear-gradient(180deg, var(--color-surface), color-mix(in oklab, var(--color-surface) 95%, var(--color-brand) 3%));
}

.head { 
  font-size: 34px; 
  font-weight: 800; 
  margin-bottom: 16px; 
  letter-spacing: 0.3px;
  color: var(--color-text);
  text-shadow: 0 2px 4px rgba(0,0,0,.2);
}

.content {
  font-size: 16px;
  line-height: 1.6;
  color: var(--color-text);
  overflow-y: auto;
  max-height: 180px;
  width: 100%;
}

.content :deep(b), 
.content :deep(strong) {
  color: var(--color-brand-400);
  font-weight: 600;
}

.content :deep(div) {
  margin-bottom: 8px;
}

.content :deep(p) {
  margin: 8px 0;
}

.content :deep(section.voc) {
  width: 100%;
}

.content :deep(article.card) {
  background: transparent;
  border: none;
  box-shadow: none;
  padding: 0;
}

.actions { 
  justify-content: center;
  gap: 12px;
  margin-top: 20px;
}

/* 전역 스타일 오버라이드 */
.btn {
  padding: 12px 24px !important;
  border-radius: var(--radii-md) !important;
  font-weight: 600 !important;
  transition: all 0.2s ease !important;
  cursor: pointer;
}

.btn:hover {
  transform: translateY(-1px) !important;
  box-shadow: var(--shadow-sm) !important;
}

.btnGhost {
  background: color-mix(in oklab, var(--color-surface) 70%, transparent) !important;
  border: 1px solid var(--color-border) !important;
  color: var(--color-text-muted) !important;
}

.btnGhost:hover {
  background: color-mix(in oklab, var(--color-surface) 85%, transparent) !important;
  color: var(--color-text) !important;
}

.btnPrimary {
  background: var(--color-brand) !important;
  border-color: var(--color-brand) !important;
  color: white !important;
}

.btnPrimary:hover {
  filter: brightness(1.1) !important;
}
</style>