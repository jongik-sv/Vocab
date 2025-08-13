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
  max-width: 700px;
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
  height: 400px;
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
  justify-content: flex-start;
  align-items: flex-start;
  text-align: left;
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

/* 단어장 스타일과 동일하게 적용 */
.content :deep(.voc) {
  font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Inter,'Apple SD Gothic Neo','Noto Sans KR',Helvetica,Arial,sans-serif;
  line-height: 1.6;
  display: block;
}

.content :deep(.voc .card) {
  background: transparent;
  border: none;
  border-radius: 0;
  padding: 0;
  box-shadow: none;
}

.content :deep(.voc .head) {
  display: none; /* 앞면에 이미 표시됨 */
}

.content :deep(.voc .hw) {
  display: none; /* 앞면에 이미 표시됨 */
}

.content :deep(.voc .phon) {
  display: none; /* 앞면에 이미 표시됨 */
}

.content :deep(.voc .meta) {
  display: none; /* 번호는 위에 표시됨 */
}

.content :deep(.voc .defs) {
  margin-top: 0;
  padding: 10px;
  background: var(--color-surface-alt, #f9fafb);
  border-radius: 12px;
  margin-bottom: 16px;
}

.content :deep(.voc .pos) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--color-brand-bg, #eef2ff);
  color: var(--color-brand-text, #3730a3);
  font-size: 12px;
  margin-right: 6px;
}

.content :deep(.voc .mean) {
  color: var(--color-text-secondary, #374151);
}

.content :deep(.voc .examples) {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.content :deep(.voc .ex) {
  padding: 10px 12px;
  border: 1px solid var(--color-border-light, #f3f4f6);
  border-radius: 12px;
  background: var(--color-surface-subtle, #fcfcfd);
}

.content :deep(.voc .en) {
  color: var(--color-text);
}

.content :deep(.voc .ko) {
  color: var(--color-text-muted, #4b5563);
  margin-top: 6px;
}

.content :deep(.voc .year-tag) {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 6px;
  border-radius: 999px;
  background: var(--color-warning-bg, #fde68a);
  color: var(--color-warning-text, #92400e);
  font-size: 12px;
  font-weight: 600;
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