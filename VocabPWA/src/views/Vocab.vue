<template>
  <section class="stackCol">
    <div class="stack" style="justify-content:space-between; flex-wrap: wrap; gap:12px;">
      <h2 style="margin:0">단어장</h2>
      <div class="stack">
        <input class="input" placeholder="새 단어장명" v-model="nbName" style="max-width:180px" />
        <button class="btn" @click="createNotebook">단어장 추가</button>
        <input class="input" placeholder="새 챕터명(day01 등)" v-model="chName" style="max-width:180px" />
        <button class="btn" @click="createChapter">챕터 추가</button>
      </div>
    </div>

    <div class="card" style="padding:12px;">
      <div class="stack" style="flex-wrap:wrap; gap:8px; margin-bottom:12px;">
        <select class="input" style="min-width:160px" v-model="store.activeNotebook" @change="reload">
          <option value="all">모든 단어장</option>
          <option v-for="n in store.notebooks" :key="n.id" :value="String(n.id)">{{ n.name }}</option>
        </select>
        <select class="input" style="min-width:140px" v-model="store.activeChapter" @change="reload">
          <option value="all">모든 챕터</option>
          <option v-for="c in chaptersFiltered" :key="c.id" :value="String(c.id)">{{ c.name }}</option>
        </select>

        <label class="btn">
          JSON 업로드
          <input type="file" accept=".json,application/json" hidden @change="onJson"/>
        </label>
        <label class="btn btnPrimary">
          PDF → JSON → 삽입
          <input type="file" accept="application/pdf" hidden @change="onPdf"/>
        </label>

        <button class="btn" @click="addSample">샘플 추가</button>
        <button class="btn" @click="backup">백업(JSON)</button>
        <button class="btn" @click="debugDB" style="background:#ff6b6b; color:white">DB 상태 확인</button>
      </div>

      <table class="table">
        <thead><tr><th style="width:220px">영어</th><th>내용</th><th style="width:80px"></th></tr></thead>
        <tbody>
          <tr v-for="w in words" :key="w.id">
            <td style="font-weight:600">{{ w.headword }}</td>
            <td><div v-html="w.html_content" /></td>
            <td><button class="btn" @click="del(w.id)">삭제</button></td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, computed, ref } from 'vue'
import { useStudyStore } from '../stores/study'
const store = useStudyStore()
const words = computed(() => store.words)
const nbName = ref(''); const chName = ref('')
const chaptersFiltered = computed(() => {
  if (store.activeNotebook === 'all') return store.chapters
  return store.chapters.filter(c => c.notebook_id === Number(store.activeNotebook))
})
const reload = () => { store.refreshWords(); store.loadQueue() }
onMounted(async () => { await store.loadMeta(); await store.refreshWords() })
const addSample = () => store.addSample()
const del = (id:number) => store.deleteWord(id)
const backup = () => store.backupJSON()
const onJson = async (e:any) => {
  const f = e.target.files?.[0]
  if (f) {
    try {
      console.log('JSON 파일 선택됨:', f.name)
      await store.restoreJSON(f)
      // 파일 입력 필드 초기화
      e.target.value = ''
    } catch (error) {
      console.error('JSON 업로드 실패:', error)
    }
  }
}
const onPdf  = (e:any) => { const f = e.target.files?.[0]; if (f) store.restorePDF(f) }

const createNotebook = async () => {
  if (!nbName.value.trim()) return
  await store.upsertNotebook(nbName.value.trim())
  nbName.value = ''; await store.loadMeta()
}
const createChapter = async () => {
  if (store.activeNotebook === 'all' || !chName.value.trim()) return
  await store.upsertChapter(Number(store.activeNotebook), chName.value.trim())
  chName.value = ''; await store.loadMeta()
}

const debugDB = async () => {
  try {
    await store.debugDatabaseState()
  } catch (error) {
    console.error('DB 상태 확인 실패:', error)
  }
}
</script>