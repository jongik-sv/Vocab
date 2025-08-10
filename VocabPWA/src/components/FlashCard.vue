<template>
  <div class="wrap" @click="flip = !flip" @keyup.space.prevent="flip = !flip" tabindex="0">
    <div class="inner" :class="{ flipped: flip }">
      <section class="face front">
        <div class="head">{{ word.headword }}</div>
        <button class="btn btnGhost" @click.stop="store.speakNow(word.headword)">🔊 발음</button>
      </section>
      <section class="face back">
        <div v-html="word.html_content" />
      </section>
    </div>
  </div>
  <div class="actions stack mt3">
    <button class="btn" @click="$emit('next')">다음 →</button>
    <button class="btn btnPrimary" @click="$emit('memorized')">외웠어요 ✓</button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useStudyStore } from '../stores/study'
const props = defineProps<{ word: any }>()
const flip = ref(false)
const store = useStudyStore()
watch(() => props.word?.id, () => { flip.value = false })
onMounted(() => store.initTts())
</script>

<style module>
.wrap { perspective: 1200px; }
.inner { position: relative; transform-style: preserve-3d; transition: transform .5s cubic-bezier(.2,.8,.2,1); }
.flipped { transform: rotateY(180deg); }
.face { backface-visibility: hidden; min-height: 260px; padding: 28px; border-radius: var(--radii-lg); border:1px solid var(--color-border); box-shadow: var(--shadow-lg); }
.front { background: linear-gradient(180deg, #ffffff, #f8fafc); }
.back { transform: rotateY(180deg); background: linear-gradient(180deg, #ffffff, #f1f5f9); }
.head { font-size: 34px; font-weight: 800; margin-bottom: 16px; letter-spacing:.3px; }
.actions { justify-content: center; }
</style>