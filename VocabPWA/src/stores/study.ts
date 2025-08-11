import { defineStore } from 'pinia'
import { getDB, idbPut, DB_KEY } from './db'
import { speak, loadVoices } from '../utils/tts'
import { pdfToJson, type VocabJson } from '../utils/pdf2json'

function todayStr() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth()+1).padStart(2,'0')
  const day = String(d.getDate()).padStart(2,'0')
  return `${y}-${m}-${day}`
}

export const useStudyStore = defineStore('study', {
  state: () => ({
    // meta
    notebooks: [] as Array<{id:number, name:string}>,
    chapters: [] as Array<{id:number, notebook_id:number, name:string}>,
    activeNotebook: 'all' as string,
    activeChapter: 'all' as string,

    // data
    words: [] as any[],
    queue: [] as any[],
    index: 0,

    // tts
    ttsLang: 'en-US' as 'en-US'|'en-GB',
    ttsRate: 1.0,

    // stats
    todayLearned: 0,
    totalLearned: 0,
    statsDaily: [] as Array<{date:string, learned_count:number}>
  }),

  getters: {
    progressPercent(state) {
      if (!state.queue.length) return 0
      const p = Math.round((state.index / state.queue.length) * 100)
      return Math.max(0, Math.min(100, p))
    },
    current(state) { return state.queue[state.index] }
  },

  actions: {
    // ---------- meta ----------
    async loadMeta() {
      const { db } = await getDB()
      const ns = db.exec(`SELECT id,name FROM notebooks ORDER BY id ASC`)[0]?.values ?? []
      const cs = db.exec(`SELECT id,notebook_id,name FROM chapters ORDER BY notebook_id,id ASC`)[0]?.values ?? []
      this.notebooks = ns.map(r => ({ id: r[0] as number, name: r[1] as string }))
      this.chapters  = cs.map(r => ({ id: r[0] as number, notebook_id: r[1] as number, name: r[2] as string }))
    },

    async upsertNotebook(name: string) {
      const { db, persist } = await getDB()
      const q = db.exec(`SELECT id FROM notebooks WHERE name=?`, [name])[0]?.values?.[0]?.[0]
      if (q) return q as number
      db.run(`INSERT INTO notebooks(name) VALUES (?)`, [name])
      await persist()
      await this.loadMeta()
      return db.exec(`SELECT id FROM notebooks WHERE name=?`, [name])[0].values[0][0] as number
    },

    async upsertChapter(notebook_id: number, name: string) {
      const { db, persist } = await getDB()
      const q = db.exec(`SELECT id FROM chapters WHERE notebook_id=? AND name=?`, [notebook_id, name])[0]?.values?.[0]?.[0]
      if (q) return q as number
      db.run(`INSERT INTO chapters(notebook_id,name) VALUES (?,?)`, [notebook_id, name])
      await persist()
      await this.loadMeta()
      return db.exec(`SELECT id FROM chapters WHERE notebook_id=? AND name=?`, [notebook_id, name])[0].values[0][0] as number
    },

    // ---------- list ----------
    async refreshWords() {
      const { db } = await getDB()
      let where = ''
      const conditions = []
      
      // 챕터가 선택된 경우 (챕터 우선)
      if (this.activeChapter !== 'all') {
        conditions.push(`chapter_id=${Number(this.activeChapter)}`)
      }
      // 노트북이 선택되고 챕터가 'all'인 경우
      else if (this.activeNotebook !== 'all') {
        conditions.push(`notebook_id=${Number(this.activeNotebook)}`)
      }
      
      if (conditions.length > 0) {
        where = `WHERE ${conditions.join(' AND ')}`
      }
      
      console.log(`refreshWords 쿼리: SELECT * FROM words ${where}`)
      
      const res = db.exec(`SELECT id, notebook_id, chapter_id, headword, phonetic, html_content, tags FROM words ${where} ORDER BY id DESC`)
      this.words = res[0]?.values.map(r => ({
        id: r[0], notebook_id: r[1], chapter_id: r[2],
        headword: r[3], phonetic: r[4], html_content: r[5], tags: r[6]
      })) || []
      
      console.log(`refreshWords 결과: ${this.words.length}개 단어`)
    },

    async loadQueue() {
      const { db } = await getDB()
      let where = ''
      const conditions = []
      
      // 챕터가 선택된 경우 (챕터 우선)
      if (this.activeChapter !== 'all') {
        conditions.push(`chapter_id=${Number(this.activeChapter)}`)
      }
      // 노트북이 선택되고 챕터가 'all'인 경우
      else if (this.activeNotebook !== 'all') {
        conditions.push(`notebook_id=${Number(this.activeNotebook)}`)
      }
      
      if (conditions.length > 0) {
        where = `WHERE ${conditions.join(' AND ')}`
      }
      
      console.log(`loadQueue 쿼리: SELECT * FROM words ${where}`)
      
      const res = db.exec(`SELECT id, headword, html_content FROM words ${where} ORDER BY RANDOM() LIMIT 50`)
      this.queue = res[0]?.values.map(r => ({ id: r[0], headword: r[1], html_content: r[2] })) || []
      this.index = 0
      
      console.log(`loadQueue 결과: ${this.queue.length}개 학습 단어`)
    },

    async next() { if (this.index < this.queue.length - 1) this.index++ },
    async memorizeCurrent() {
      const cur = this.queue[this.index]
      if (!cur) return
      this.todayLearned++; this.totalLearned++
      // 일일 통계 반영(UPSERT 안전하게)
      const { db, persist } = await getDB()
      const today = todayStr()
      db.run(`INSERT OR IGNORE INTO stats_daily(date, learned_count) VALUES (?, 0)`, [today])
      db.run(`UPDATE stats_daily SET learned_count = learned_count + 1 WHERE date=?`, [today])
      await persist()

      this.queue.splice(this.index, 1)
      if (this.index >= this.queue.length) this.index = Math.max(0, this.queue.length - 1)
    },

    setActiveNotebook(id: string){ this.activeNotebook = id },
    setActiveChapter(id: string){ this.activeChapter = id },

    // ---------- TTS ----------
    async initTts() { await loadVoices() },
    speakNow(text:string){ speak(text, { lang: this.ttsLang, rate: this.ttsRate }) },

    // ---------- 샘플 ----------
    async addSample() {
      const { db, persist } = await getDB()
      db.run(`BEGIN`)
      db.run(`INSERT INTO words(headword, html_content) VALUES ('abandon', '<b>버리다</b><br>예: He abandoned the plan.')`)
      db.run(`INSERT INTO words(headword, html_content) VALUES ('benefit', '<b>이익</b><br>예: It benefits everyone.')`)
      db.run(`COMMIT`)
      await persist()
      await this.refreshWords()
      if (!this.queue.length) await this.loadQueue()
    },

    async deleteWord(id:number){
      const { db, persist } = await getDB()
      db.run(`DELETE FROM words WHERE id=?`, [id])
      await persist(); await this.refreshWords()
    },

    // ---------- 백업/복원 ----------
    async backupJSON(){
      const { db } = await getDB()
      const res = db.exec(`SELECT id, notebook_id, chapter_id, headword, phonetic, html_content, tags FROM words`)
      const rows = res[0]?.values || []
      const json = rows.map(r => ({ id:r[0], notebook_id:r[1], chapter_id:r[2], headword:r[3], phonetic:r[4], html_content:r[5], tags:r[6] }))
      const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' })
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'vocab-backup.json'; a.click()
    },

    async restoreJSON(file: File){
      try {
        const text = await file.text()
        const arr = JSON.parse(text) as Array<any>
        
        // 임포트할 데이터 개수 확인
        console.log(`JSON 임포트 시작: ${arr.length}개 항목`)
        
        await this.insertObjects(arr.map(w => ({
          notebook: 'Imported', chapter: 'default',
          headword: w.headword, phonetic: w.phonetic, html_content: w.html_content, tags: w.tags
        })))
        
        // 임포트 완료 후 Imported 단어장으로 자동 전환
        const importedNotebook = this.notebooks.find(n => n.name === 'Imported')
        if (importedNotebook) {
          this.activeNotebook = String(importedNotebook.id)
          this.activeChapter = 'all'
          await this.refreshWords()
          await this.loadQueue()
        }
        
        console.log(`JSON 임포트 완료: ${arr.length}개 항목이 성공적으로 임포트되었습니다.`)
        alert(`${arr.length}개의 단어가 성공적으로 임포트되었습니다!`)
        
      } catch (error) {
        console.error('JSON 임포트 오류:', error)
        alert('JSON 파일 임포트 중 오류가 발생했습니다. 파일 형식을 확인해주세요.')
      }
    },

    async restorePDF(file: File){
      const arr = await pdfToJson(file, '사랑영단어')
      await this.insertObjects(arr)
    },

    async insertObjects(items: VocabJson){
      const { db, persist } = await getDB()
      let insertedCount = 0
      
      try {
        db.run('BEGIN')
        
        for (const w of items) {
          // 필수 필드 확인
          if (!w.headword || w.headword.trim() === '') {
            console.warn('빈 headword 건너뜀:', w)
            continue
          }
          
          // 트랜잭션 내에서 안전한 upsert 수행
          const nb = await this.upsertNotebookInTx(db, w.notebook)
          const ch = await this.upsertChapterInTx(db, nb, w.chapter)
          
          // 중복 확인 (선택사항: 동일한 headword가 이미 존재하는지 확인)
          const existing = db.exec(
            `SELECT id FROM words WHERE notebook_id=? AND chapter_id=? AND headword=?`,
            [nb, ch, w.headword]
          )
          
          if (existing[0]?.values?.length > 0) {
            console.warn('중복 단어 건너뜀:', w.headword)
            continue
          }
          
          db.run(
            `INSERT INTO words(notebook_id, chapter_id, headword, phonetic, html_content, tags) VALUES (?, ?, ?, ?, ?, ?)`,
            [nb, ch, w.headword, w.phonetic || null, w.html_content || '', w.tags || null]
          )
          insertedCount++
        }
        
        db.run('COMMIT')
        await persist()
        
        console.log(`데이터베이스에 ${insertedCount}개 단어 삽입 완료`)
        
        // 메타데이터 및 단어 목록 새로고침
        await this.loadMeta()
        await this.refreshWords()
        if (!this.queue.length) await this.loadQueue()
        
      } catch (error) {
        db.run('ROLLBACK')
        console.error('insertObjects 오류:', error)
        throw error
      }
      
      return insertedCount
    },

    // 트랜잭션 내에서 사용하는 notebook upsert (persist 호출 안함)
    async upsertNotebookInTx(db: any, name: string): Promise<number> {
      const q = db.exec(`SELECT id FROM notebooks WHERE name=?`, [name])[0]?.values?.[0]?.[0]
      if (q) return q as number
      db.run(`INSERT INTO notebooks(name) VALUES (?)`, [name])
      return db.exec(`SELECT id FROM notebooks WHERE name=?`, [name])[0].values[0][0] as number
    },

    // 트랜잭션 내에서 사용하는 chapter upsert (persist 호출 안함)
    async upsertChapterInTx(db: any, notebook_id: number, name: string): Promise<number> {
      const q = db.exec(`SELECT id FROM chapters WHERE notebook_id=? AND name=?`, [notebook_id, name])[0]?.values?.[0]?.[0]
      if (q) return q as number
      db.run(`INSERT INTO chapters(notebook_id,name) VALUES (?,?)`, [notebook_id, name])
      return db.exec(`SELECT id FROM chapters WHERE notebook_id=? AND name=?`, [notebook_id, name])[0].values[0][0] as number
    },

    // ---------- stats ----------
    async loadStats() {
      const { db } = await getDB()
      const res = db.exec(`SELECT date, learned_count FROM stats_daily ORDER BY date DESC LIMIT 14`)
      this.statsDaily = (res[0]?.values || []).map(r => ({ date: r[0] as string, learned_count: r[1] as number }))
      // totalLearned 근사치(단순 합)
      this.totalLearned = this.statsDaily.reduce((s,x)=>s+x.learned_count,0)
    },

    // ---------- backup/restore ----------
    async exportSQLiteDB() {
      const { db } = await getDB()
      const data = db.export()
      const blob = new Blob([data], { type: 'application/x-sqlite3' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `vocab-database-${new Date().toISOString().slice(0,10)}.db`
      a.click()
      console.log('SQLite DB 파일 내보내기 완료')
    },

    async importSQLiteDB(file: File) {
      try {
        const arrayBuffer = await file.arrayBuffer()
        const data = new Uint8Array(arrayBuffer)
        
        // 기존 데이터 백업 확인
        const confirm = window.confirm('기존 데이터가 모두 삭제됩니다. 계속하시겠습니까?')
        if (!confirm) return
        
        // IndexedDB에 저장
        await idbPut(DB_KEY, data)
        
        // 메타데이터 새로고침
        await this.loadMeta()
        await this.refreshWords()
        await this.loadQueue()
        
        alert('SQLite DB 파일 가져오기 완료!')
        console.log('SQLite DB 파일 가져오기 완료')
        
      } catch (error) {
        console.error('SQLite DB 가져오기 실패:', error)
        alert('DB 파일 가져오기에 실패했습니다.')
      }
    },

    // ---------- debug ----------
    async debugDatabaseState() {
      const { db } = await getDB()
      
      // 테이블별 데이터 개수 확인
      const notebookCount = db.exec(`SELECT COUNT(*) as count FROM notebooks`)[0]?.values[0][0] || 0
      const chapterCount = db.exec(`SELECT COUNT(*) as count FROM chapters`)[0]?.values[0][0] || 0
      const wordCount = db.exec(`SELECT COUNT(*) as count FROM words`)[0]?.values[0][0] || 0
      
      // 노트북 목록
      const notebooks = db.exec(`SELECT id, name FROM notebooks ORDER BY id`)[0]?.values || []
      
      // 챕터 목록 (상세)
      const chapters = db.exec(`SELECT id, notebook_id, name FROM chapters ORDER BY notebook_id, id`)[0]?.values || []
      
      // 최근 단어 몇 개
      const recentWords = db.exec(`SELECT id, notebook_id, chapter_id, headword FROM words ORDER BY id DESC LIMIT 10`)[0]?.values || []
      
      // 챕터별 단어 개수
      const chapterWordCounts = db.exec(`
        SELECT c.name, c.id, c.notebook_id, COUNT(w.id) as word_count 
        FROM chapters c 
        LEFT JOIN words w ON c.id = w.chapter_id 
        GROUP BY c.id, c.name, c.notebook_id 
        ORDER BY c.notebook_id, c.id
      `)[0]?.values || []
      
      // 현재 필터 상태
      const currentFilters = {
        activeNotebook: this.activeNotebook,
        activeChapter: this.activeChapter,
        wordsCount: this.words.length,
        queueCount: this.queue.length,
        storeNotebooks: this.notebooks,
        storeChapters: this.chapters
      }
      
      const debugInfo = {
        counts: { notebooks: notebookCount, chapters: chapterCount, words: wordCount },
        notebooks: notebooks.map(r => ({ id: r[0], name: r[1] })),
        chapters: chapters.map(r => ({ id: r[0], notebook_id: r[1], name: r[2] })),
        chapterWordCounts: chapterWordCounts.map(r => ({ 
          name: r[0], id: r[1], notebook_id: r[2], word_count: r[3] 
        })),
        recentWords: recentWords.map(r => ({ id: r[0], notebook_id: r[1], chapter_id: r[2], headword: r[3] })),
        currentFilters
      }
      
      console.log('=== 데이터베이스 상태 ===', debugInfo)
      
      const chapterInfo = chapterWordCounts.map(c => `  - ${c.name}: ${c.word_count}개 단어`).join('\n')
      
      alert(`📊 데이터베이스 현황:
        
📚 노트북: ${notebookCount}개
📖 챕터: ${chapterCount}개
💬 총 단어: ${wordCount}개

📝 챕터별 단어 수:
${chapterInfo}

🔍 현재 필터:
  - 노트북: ${this.activeNotebook}
  - 챕터: ${this.activeChapter}
  - 표시 단어: ${this.words.length}개

자세한 정보는 개발자 도구 콘솔을 확인하세요.`)
      
      return debugInfo
    }
  }
})