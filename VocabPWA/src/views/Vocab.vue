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
        <div class="stack" style="align-items:center; gap:4px;">
          <select class="input" style="min-width:160px" v-model="store.activeNotebook" @change="reload">
            <option value="all">모든 단어장</option>
            <option v-for="n in store.notebooks" :key="n.id" :value="String(n.id)">{{ n.name }}</option>
          </select>
          <button 
            v-if="store.activeNotebook !== 'all'" 
            class="btn btn-sm" 
            @click="deleteNotebook" 
            style="background:#ef4444; color:white; font-size:12px; padding:4px 8px;"
            title="선택된 단어장 삭제">
            🗑️
          </button>
        </div>
        <div class="stack" style="align-items:center; gap:4px;">
          <select class="input" style="min-width:140px" v-model="store.activeChapter" @change="reload">
            <option value="all">모든 챕터</option>
            <option v-for="c in chaptersFiltered" :key="c.id" :value="String(c.id)">{{ c.name }}</option>
          </select>
          <button 
            v-if="store.activeChapter !== 'all'" 
            class="btn btn-sm" 
            @click="deleteChapter" 
            style="background:#f59e0b; color:white; font-size:12px; padding:4px 8px;"
            title="선택된 챕터 삭제">
            🗑️
          </button>
        </div>

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
        <label class="btn" style="background:#8b5cf6; color:white">
          DB 파일 내보내기
          <span @click="exportDB" style="cursor:pointer">💾</span>
        </label>
        <label class="btn" style="background:#06b6d4; color:white">
          DB 파일 가져오기
          <input type="file" accept=".db,application/x-sqlite3" hidden @change="importDB"/>
        </label>
        <button class="btn" @click="debugDB" style="background:#ff6b6b; color:white">DB 상태 확인</button>
        <button class="btn" @click="testChapterFilter" style="background:#22c55e; color:white">챕터 필터 테스트</button>
        <button class="btn" @click="showFirst10" style="background:#3b82f6; color:white">첫 10개 레코드</button>
      </div>

      <div class="vocab-list">
        <div v-for="w in words" :key="w.id" class="vocab-item" style="margin-bottom: 16px;">
          <div class="voc">
            <article class="card">
              <header class="head">
                <span class="hw">{{ w.headword }}</span>
                <div class="meta">
                  <button class="btn btn-sm" @click="del(w.id)" style="background:#ef4444; color:white; font-size:12px; padding:4px 8px;">삭제</button>
                </div>
              </header>
              <div class="defs">
                <div v-html="w.html_content" />
              </div>
            </article>
          </div>
        </div>
        <div v-if="words.length === 0" style="text-align:center; color:var(--color-text-muted); padding:40px;">
          선택한 필터에 해당하는 단어가 없습니다.
        </div>
      </div>
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
  const filtered = store.activeNotebook === 'all' 
    ? store.chapters 
    : store.chapters.filter(c => {
        // 더 안전한 타입 비교: 둘 다 문자열로 변환하여 비교
        const chapterNotebookId = String(c.notebook_id)
        const activeNotebookId = String(store.activeNotebook)
        return chapterNotebookId === activeNotebookId
      })
  
  console.log('Vocab 챕터 필터링:', {
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

const reload = async () => {
  console.log('reload 호출됨:', {
    activeNotebook: store.activeNotebook,
    activeChapter: store.activeChapter
  })
  
  await store.refreshWords()
  await store.loadQueue()
}
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

const testChapterFilter = async () => {
  try {
    console.log('=== 챕터 필터 테스트 시작 ===')
    
    // 현재 상태 로그
    console.log('현재 상태:', {
      activeNotebook: store.activeNotebook,
      activeChapter: store.activeChapter,
      notebooks: store.notebooks,
      chapters: store.chapters,
      words: store.words.length
    })
    
    // 모든 단어장으로 전환
    store.activeNotebook = 'all'
    store.activeChapter = 'all'
    await reload()
    console.log(`모든 단어장: ${store.words.length}개 단어`)
    
    // Imported 단어장이 있다면 선택
    const importedNotebook = store.notebooks.find(n => n.name === 'Imported')
    if (importedNotebook) {
      store.activeNotebook = String(importedNotebook.id)
      store.activeChapter = 'all'
      await reload()
      console.log(`Imported 단어장: ${store.words.length}개 단어`)
      
      // 해당 단어장의 첫 번째 챕터 선택
      const firstChapter = store.chapters.find(c => c.notebook_id === importedNotebook.id)
      if (firstChapter) {
        store.activeChapter = String(firstChapter.id)
        await reload()
        console.log(`첫 번째 챕터 (${firstChapter.name}): ${store.words.length}개 단어`)
      }
    }
    
    alert('챕터 필터 테스트 완료! 콘솔을 확인하세요.')
    
  } catch (error) {
    console.error('챕터 필터 테스트 실패:', error)
    alert('테스트 실패: ' + error.message)
  }
}

const exportDB = async () => {
  try {
    await store.exportSQLiteDB()
  } catch (error) {
    console.error('DB 내보내기 실패:', error)
    alert('DB 내보내기 실패: ' + error.message)
  }
}

const importDB = async (e: any) => {
  const f = e.target.files?.[0]
  if (f) {
    try {
      console.log('DB 파일 선택됨:', f.name)
      await store.importSQLiteDB(f)
      // 파일 입력 필드 초기화
      e.target.value = ''
    } catch (error) {
      console.error('DB 가져오기 실패:', error)
    }
  }
}

const showFirst10 = async () => {
  try {
    await store.showFirst10Records()
  } catch (error) {
    console.error('첫 10개 레코드 조회 실패:', error)
  }
}

const deleteNotebook = async () => {
  if (store.activeNotebook === 'all') return
  
  const notebookName = store.notebooks.find(n => n.id === Number(store.activeNotebook))?.name
  
  if (confirm(`단어장 "${notebookName}"을(를) 삭제하시겠습니까?\n\n⚠️ 이 단어장의 모든 챕터와 단어가 함께 삭제됩니다.\n이 작업은 되돌릴 수 없습니다.`)) {
    try {
      await store.deleteNotebook(Number(store.activeNotebook))
      alert(`단어장 "${notebookName}"이(가) 성공적으로 삭제되었습니다.`)
    } catch (error) {
      console.error('단어장 삭제 실패:', error)
      alert('단어장 삭제 중 오류가 발생했습니다: ' + error.message)
    }
  }
}

const deleteChapter = async () => {
  if (store.activeChapter === 'all') return
  
  const chapterName = chaptersFiltered.value.find(c => c.id === Number(store.activeChapter))?.name
  
  if (confirm(`챕터 "${chapterName}"을(를) 삭제하시겠습니까?\n\n⚠️ 이 챕터의 모든 단어가 함께 삭제됩니다.\n이 작업은 되돌릴 수 없습니다.`)) {
    try {
      await store.deleteChapter(Number(store.activeChapter))
      alert(`챕터 "${chapterName}"이(가) 성공적으로 삭제되었습니다.`)
    } catch (error) {
      console.error('챕터 삭제 실패:', error)
      alert('챕터 삭제 중 오류가 발생했습니다: ' + error.message)
    }
  }
}
</script>