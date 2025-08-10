// src/utils/pdf2json.ts
import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min?url'
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

export type VocabJson = Array<{
  notebook: string,
  chapter: string,           // day01, day02, ...
  headword: string,
  phonetic?: string,
  html_content: string,      // 뜻/예문 HTML
  tags?: string | null
}>

// ✅ named export: pdfToJson
export async function pdfToJson(file: File, notebookName = '사랑영단어'): Promise<VocabJson> {
  const ab = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: ab }).promise

  let currentDay = 'day00'
  let buffer: string[] = []
  const out: VocabJson = []

  function commitBuffered() {
    for (let i = 0; i < buffer.length; i++) {
      const idLine = buffer[i]?.trim()
      const pron = buffer[i+1]?.trim()
      const hwLine = buffer[i+2]?.trim()

      if (/^\d{3,4}$/.test(idLine) && /^\[.+\]$/.test(pron) && hwLine) {
        const m = hwLine.match(/^([A-Za-z' -]+)\s+(.+)$/)
        if (!m) continue
        const headword = m[1].trim()
        const meaning = m[2].trim()

        const examples: string[] = []
        for (let k = i + 3; k < Math.min(buffer.length, i + 10); k++) {
          const line = buffer[k]?.trim()
          if (!line) continue
          if (/^\d{3,4}$/.test(line) || /^DAY\b/i.test(line)) break
          examples.push(line)
        }

        const html = [
          `<p><strong>${escapeHtml(headword)}</strong> <em>${escapeHtml(pron)}</em></p>`,
          `<p>${escapeHtml(meaning)}</p>`,
          examples.length ? `<div>${examples.map(x => `<div>${escapeHtml(x)}</div>`).join('')}</div>` : ''
        ].join('')

        out.push({
          notebook: notebookName,
          chapter: currentDay,
          headword,
          phonetic: pron.replace(/^\[|\]$/g,''),
          html_content: html
        })
      }
    }
    buffer = []
  }

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const tc = await page.getTextContent()
    const text = tc.items.map((it: any) => it.str).join('\n')

    const dm = text.match(/DAY\s*0?(\d{1,2})/i)
    if (dm) {
      commitBuffered()
      currentDay = 'day' + String(dm[1]).padStart(2, '0')
    }
    buffer.push(...text.split(/\r?\n/))
  }
  commitBuffered()
  return out
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] as string))
}