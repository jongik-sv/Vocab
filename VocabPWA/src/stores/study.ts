import { defineStore } from 'pinia'
import { getDB } from './db'
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
      if (this.activeChapter !== 'all') where = `WHERE chapter_id=${Number(this.activeChapter)}`
      else if (this.activeNotebook !== 'all') where = `WHERE notebook_id=${Number(this.activeNotebook)}`
      const res = db.exec(`SELECT id, notebook_id, chapter_id, headword, phonetic, html_content, tags FROM words ${where} ORDER BY id DESC`)
      this.words = res[0]?.values.map(r => ({
        id: r[0], notebook_id: r[1], chapter_id: r[2],
        headword: r[3], phonetic: r[4], html_content: r[5], tags: r[6]
      })) || []
    },

    async loadQueue() {
      const { db } = await getDB()
      let where = ''
      if (this.activeChapter !== 'all') where = `WHERE chapter_id=${Number(this.activeChapter)}`
      else if (this.activeNotebook !== 'all') where = `WHERE notebook_id=${Number(this.activeNotebook)}`
      const res = db.exec(`SELECT id, headword, html_content FROM words ${where} ORDER BY RANDOM() LIMIT 50`)
      this.queue = res[0]?.values.map(r => ({ id: r[0], headword: r[1], html_content: r[2] })) || []
      this.index = 0
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
      const text = await file.text()
      const arr = JSON.parse(text) as Array<any>
      await this.insertObjects(arr.map(w => ({
        notebook: 'Imported', chapter: 'default',
        headword: w.headword, phonetic: w.phonetic, html_content: w.html_content, tags: w.tags
      })))
    },

    async restorePDF(file: File){
      const arr = await pdfToJson(file, '사랑영단어')
      await this.insertObjects(arr)
    },

    async insertObjects(items: VocabJson){
      const { db, persist } = await getDB()
      db.run('BEGIN')
      for (const w of items) {
        const nb = await this.upsertNotebook(w.notebook)
        const ch = await this.upsertChapter(nb, w.chapter)
        db.run(
          `INSERT INTO words(notebook_id, chapter_id, headword, phonetic, html_content, tags) VALUES (?, ?, ?, ?, ?, ?)`,
          [nb, ch, w.headword, w.phonetic || null, w.html_content || '', w.tags || null]
        )
      }
      db.run('COMMIT'); await persist()
      await this.loadMeta(); await this.refreshWords()
      if (!this.queue.length) await this.loadQueue()
    },

    // ---------- stats ----------
    async loadStats() {
      const { db } = await getDB()
      const res = db.exec(`SELECT date, learned_count FROM stats_daily ORDER BY date DESC LIMIT 14`)
      this.statsDaily = (res[0]?.values || []).map(r => ({ date: r[0] as string, learned_count: r[1] as number }))
      // totalLearned 근사치(단순 합)
      this.totalLearned = this.statsDaily.reduce((s,x)=>s+x.learned_count,0)
    }
  }
})