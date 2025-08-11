<template>
  <section class="stackCol">
    <div class="surface" style="padding:24px; display:flex; justify-content:space-between; align-items:center; gap:16px; flex-wrap:wrap;">
      <div>
        <h2 style="margin:0 0 6px 0;">오늘의 학습</h2>
        <p style="margin:0; color:var(--color-text-muted)">단어장/챕터를 선택하고 학습을 시작하세요.</p>
      </div>
      <router-link class="btn btnPrimary" to="/study">학습 시작 ▶</router-link>
    </div>

    <div class="card" style="padding:16px;">
      <div class="stack" style="justify-content:space-between; flex-wrap: wrap;">
        <div class="stack">
          <select class="input" style="min-width:160px" v-model="store.activeNotebook" @change="onFilterChange">
            <option value="all">모든 단어장</option>
            <option v-for="n in store.notebooks" :key="n.id" :value="String(n.id)">{{ n.name }}</option>
          </select>
          <select class="input" style="min-width:140px" v-model="store.activeChapter" @change="onFilterChange">
            <option value="all">모든 챕터</option>
            <option v-for="c in chaptersFiltered" :key="c.id" :value="String(c.id)">{{ c.name }}</option>
          </select>
        </div>
        <div class="stack" style="color:var(--color-text-muted); gap: 8px;">
          <span>단어 수: {{ words.length }}</span>
          <button class="btn btnGhost" @click="testTTS" style="padding: 4px 8px; font-size: 12px;">🔊 음성 테스트</button>
        </div>
      </div>
      <div class="mt3" style="height:10px; background:#e5e7eb33; border-radius:999px; overflow:hidden;">
        <div :style="{width: store.progressPercent + '%', height:'100%', background:'linear-gradient(90deg, var(--color-brand-400), var(--color-brand))'}"></div>
      </div>
      <small class="mt2" style="display:block; color:var(--color-text-muted)">진행률 {{ store.progressPercent }}%</small>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useStudyStore } from '../stores/study'

const store = useStudyStore()
const words = computed(() => store.words)

const chaptersFiltered = computed(() => {
  const filtered = store.activeNotebook === 'all' 
    ? store.chapters 
    : store.chapters.filter(c => {
        // 더 안전한 타입 비교: 둘 다 문자열로 변환하여 비교
        const chapterNotebookId = String(c.notebook_id)
        const activeNotebookId = String(store.activeNotebook)
        return chapterNotebookId === activeNotebookId
      })
  
  console.log('Dashboard 챕터 필터링:', {
    activeNotebook: store.activeNotebook,
    activeNotebookType: typeof store.activeNotebook,
    allChapters: store.chapters.length,
    filteredChapters: filtered.length,
    chaptersData: store.chapters.map(c => ({
      id: c.id,
      name: c.name,
      notebook_id: c.notebook_id,
      notebook_id_type: typeof c.notebook_id
    })),
    filtered: filtered.map(c => ({
      id: c.id,
      name: c.name,
      notebook_id: c.notebook_id
    }))
  })
  
  return filtered
})

const onFilterChange = async () => {
  console.log('Dashboard 필터 변경됨:', {
    activeNotebook: store.activeNotebook,
    activeChapter: store.activeChapter
  })
  
  await store.refreshWords()
  await store.loadQueue()
}

const testTTS = async () => {
  try {
    console.log('Dashboard: TTS 테스트 시작')
    await store.speakNow('Hello, this is a test message', true)
  } catch (error) {
    console.error('Dashboard: TTS 테스트 실패:', error)
    // showError가 true이므로 store에서 에러 메시지 표시
  }
}

onMounted(async () => { 
  console.log('Dashboard 마운트 시작')
  await store.loadMeta()
  await store.refreshWords()
  await store.loadStats()
  
  // TTS 초기화도 함께
  await store.initTts()
  console.log('Dashboard 마운트 완료')
})
</script>