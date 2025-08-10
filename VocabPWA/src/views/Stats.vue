<template>
  <section class="stackCol">
    <h2 style="margin:0">통계</h2>

    <div class="stack" style="gap:16px; flex-wrap:wrap;">
      <div class="card" style="padding:16px; min-width:260px;">
        <div class="label">오늘 학습</div>
        <div style="font-size:24px; font-weight:800;">{{ todayCount }}</div>
      </div>
      <div class="card" style="padding:16px; min-width:260px;">
        <div class="label">누적 학습(최근 14일 합)</div>
        <div style="font-size:24px; font-weight:800;">{{ store.totalLearned }}</div>
      </div>
    </div>

    <div class="card mt3" style="padding:16px;">
      <div class="label">최근 14일</div>
      <div style="display:flex; align-items:flex-end; gap:8px; height:120px;">
        <div v-for="d in store.statsDaily.slice().reverse()" :key="d.date" style="display:flex; flex-direction:column; align-items:center; gap:6px;">
          <div :title="d.learned_count + '개'" :style="{
               width:'20px',
               height: Math.max(4, d.learned_count*8) + 'px',
               background: 'linear-gradient(180deg, var(--color-brand-400), var(--color-brand))',
               borderRadius: '8px'
             }"></div>
          <small style="color:var(--color-text-muted)">{{ d.date.slice(5) }}</small>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useStudyStore } from '../stores/study'
function todayStr(){
  const d=new Date(), y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0')
  return `${y}-${m}-${day}`
}
const store = useStudyStore()
const todayCount = computed(() => store.statsDaily.find(x=>x.date===todayStr())?.learned_count || 0)
onMounted(store.loadStats)
</script>