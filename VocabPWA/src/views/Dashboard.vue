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
        <div style="color:var(--color-text-muted)">단어 수: {{ words.length }}</div>
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
  if (store.activeNotebook === 'all') return store.chapters
  return store.chapters.filter(c => c.notebook_id === Number(store.activeNotebook))
})
const onFilterChange = () => { store.refreshWords(); store.loadQueue() }
onMounted(async () => { await store.loadMeta(); await store.refreshWords(); await store.loadStats() })
</script>