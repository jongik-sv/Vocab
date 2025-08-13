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
        <!-- <label class="btn btnPrimary">
          PDF → JSON → 삽입
          <input type="file" accept="application/pdf" hidden @change="onPdf"/>
        </label>

        <button class="btn" @click="addSample">샘플 추가</button> -->
        <button class="btn" @click="backup">백업(JSON)</button>
        <button class="btn" @click="resetMemoryStatus" style="background:#f97316; color:white" title="선택된 범위의 모든 단어를 미학습 상태로 초기화">
          📚 외움 상태 초기화
        </button>
        <label class="btn" style="background:#8b5cf6; color:white">
          DB 파일 내보내기
          <span @click="exportDB" style="cursor:pointer">💾</span>
        </label>
        <label class="btn" style="background:#06b6d4; color:white">
          DB 파일 가져오기
          <input type="file" accept=".db,application/x-sqlite3" hidden @change="importDB"/>
        </label>
        <!-- <button class="btn" @click="debugDB" style="background:#ff6b6b; color:white">DB 상태 확인</button>
        <button class="btn" @click="testChapterFilter" style="background:#22c55e; color:white">챕터 필터 테스트</button>
        <button class="btn" @click="showFirst10" style="background:#3b82f6; color:white">첫 10개 레코드</button> -->
      </div>

      <!-- 학습하기 섹션 -->
      <div v-if="words.length > 0" class="card" style="padding:16px; margin-bottom:20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center;">
        <div style="margin-bottom:12px;">
          <h3 style="margin:0; color:white;">{{ getStudyInfo() }}</h3>
          <p style="margin:8px 0 0 0; opacity:0.9; font-size:14px;">선택된 범위의 단어들을 학습할 수 있습니다</p>
        </div>
        <button class="btn" @click="startStudy" style="background:rgba(255,255,255,0.2); border-color:rgba(255,255,255,0.3); color:white; padding:12px 24px; font-weight:600;">
          📚 학습하기 ({{ words.length }}개 단어)
        </button>
      </div>

      <div class="vocab-list">
        <div v-for="w in words" :key="w.id" class="vocab-item" style="margin-bottom: 16px;">
          <div class="voc">
            <article class="card">
              <header class="head">
                <span class="hw">{{ w.headword }}</span>
                <div class="meta" style="display: flex; align-items: center; gap: 8px;">
                  <label class="memorized-switch">
                    <input 
                      type="checkbox" 
                      :checked="w.status === 'MEMORIZED'"
                      @change="toggleMemorized(w.id)"
                      style="display: none;"
                    >
                    <span class="switch-slider" :class="{ 'memorized': w.status === 'MEMORIZED' }">
                      {{ w.status === 'MEMORIZED' ? '외워짐 ✓' : '미학습' }}
                    </span>
                  </label>
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
import { useRouter } from 'vue-router'
import { useStudyStore } from '../stores/study'
const store = useStudyStore()
const router = useRouter()
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

// 학습 정보 표시용 메소드
const getStudyInfo = () => {
  const notebookName = store.activeNotebook === 'all' ? '모든 단어장' : 
    store.notebooks.find(n => n.id === Number(store.activeNotebook))?.name || '단어장'
  const chapterName = store.activeChapter === 'all' ? '모든 챕터' : 
    chaptersFiltered.value.find(c => c.id === Number(store.activeChapter))?.name || '챕터'
  
  return `${notebookName} > ${chapterName}`
}

// 학습 시작 메소드
const startStudy = async () => {
  try {
    console.log('학습 시작:', {
      activeNotebook: store.activeNotebook,
      activeChapter: store.activeChapter,
      wordsCount: words.value.length
    })
    
    if (words.value.length === 0) {
      alert('학습할 단어가 없습니다.')
      return
    }

    // 현재 필터에 맞는 학습 큐 로드
    await store.loadQueue()
    
    // 학습 페이지로 이동
    await router.push('/study')
    
  } catch (error) {
    console.error('학습 시작 실패:', error)
    alert('학습을 시작하는 중 오류가 발생했습니다: ' + error.message)
  }
}

// 외움 여부 토글
const toggleMemorized = async (wordId: number) => {
  try {
    await store.toggleWordMemorized(wordId)
  } catch (error) {
    console.error('외움 상태 토글 실패:', error)
    alert('외움 상태 변경 중 오류가 발생했습니다: ' + error.message)
  }
}

// 외움 상태 초기화
const resetMemoryStatus = async () => {
  try {
    // 현재 선택된 범위 확인
    const notebookName = store.activeNotebook === 'all' ? '모든 단어장' : 
      store.notebooks.find(n => n.id === Number(store.activeNotebook))?.name || '단어장'
    const chapterName = store.activeChapter === 'all' ? '모든 챕터' : 
      chaptersFiltered.value.find(c => c.id === Number(store.activeChapter))?.name || '챕터'
    
    const range = `${notebookName} > ${chapterName}`
    const memorizedCount = words.value.filter(w => w.status === 'MEMORIZED').length
    
    if (memorizedCount === 0) {
      alert('초기화할 외워진 단어가 없습니다.')
      return
    }
    
    const confirmed = confirm(`선택된 범위의 외움 상태를 초기화하시겠습니까?\n\n📍 범위: ${range}\n🔄 초기화될 단어: ${memorizedCount}개\n\n⚠️ 모든 '외워짐' 단어가 '미학습' 상태로 변경됩니다.\n이 작업은 되돌릴 수 없습니다.`)
    
    if (confirmed) {
      const resetCount = await store.resetMemoryStatus()
      alert(`외움 상태 초기화 완료!\n\n📍 범위: ${range}\n🔄 초기화된 단어: ${resetCount}개`)
    }
    
  } catch (error) {
    console.error('외움 상태 초기화 실패:', error)
    alert('외움 상태 초기화 중 오류가 발생했습니다: ' + error.message)
  }
}
</script>

<style scoped>
.memorized-switch {
  cursor: pointer;
  user-select: none;
}

.switch-slider {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  transition: all 0.3s ease;
  border: 2px solid #e5e7eb;
  background: #f9fafb;
  color: #6b7280;
  min-width: 60px;
  text-align: center;
}

.switch-slider.memorized {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border-color: #059669;
  color: white;
  box-shadow: 0 2px 4px rgba(16, 185, 129, 0.3);
}

.switch-slider:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.switch-slider.memorized:hover {
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.4);
}
</style>