// src/utils/tts.ts
let cachedVoices: SpeechSynthesisVoice[] = []

export async function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  const synth = window.speechSynthesis
  const tryLoad = (res: (v: SpeechSynthesisVoice[]) => void) => {
    const list = synth.getVoices()
    if (list && list.length) { cachedVoices = list; res(list) }
    else setTimeout(() => tryLoad(res), 200)
  }
  return new Promise<SpeechSynthesisVoice[]>(tryLoad)
}

export function listVoices(langHint: string = 'en') {
  if (!cachedVoices.length) cachedVoices = window.speechSynthesis.getVoices()
  return cachedVoices
    .filter(v => v.lang?.toLowerCase().startsWith(langHint.toLowerCase()))
    .sort((a,b) => (a.name || '').localeCompare(b.name || ''))
}

export function speak(text: string, opts?: { lang?: 'en-US'|'en-GB', rate?: number, pitch?: number }) {
  if (!text?.trim()) return
  const synth = window.speechSynthesis
  try { synth.cancel() } catch {}
  const u = new SpeechSynthesisUtterance(text)
  u.lang = opts?.lang ?? 'en-US'
  u.rate = opts?.rate ?? 1.0
  u.pitch = opts?.pitch ?? 1.0
  const voice =
    listVoices(u.lang)[0] ||
    cachedVoices.find(v => v.lang?.startsWith('en')) ||
    cachedVoices[0]
  if (voice) u.voice = voice
  synth.speak(u)
}