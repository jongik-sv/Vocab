// src/utils/tts.ts
let cachedVoices: SpeechSynthesisVoice[] = []
let isInitialized = false

export async function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!window.speechSynthesis) {
    console.error('TTS: SpeechSynthesis API가 지원되지 않습니다.')
    return []
  }

  const synth = window.speechSynthesis
  
  // 기존 음성이 있으면 중지
  try { synth.cancel() } catch {}

  const tryLoad = (res: (v: SpeechSynthesisVoice[]) => void, attempt = 0) => {
    const list = synth.getVoices()
    console.log(`TTS: 음성 로드 시도 ${attempt + 1}, 발견된 음성: ${list.length}개`)
    
    if (list && list.length) { 
      cachedVoices = list
      isInitialized = true
      console.log('TTS: 사용 가능한 음성들:', list.map(v => `${v.name} (${v.lang})`))
      res(list)
    }
    else if (attempt < 10) {
      setTimeout(() => tryLoad(res, attempt + 1), 200)
    }
    else {
      console.warn('TTS: 음성 로드 타임아웃 - 기본 음성으로 진행')
      cachedVoices = list
      isInitialized = true
      res(list)
    }
  }

  return new Promise<SpeechSynthesisVoice[]>(tryLoad)
}

export function listVoices(langHint: string = 'en') {
  if (!cachedVoices.length) cachedVoices = window.speechSynthesis?.getVoices() || []
  return cachedVoices
    .filter(v => v.lang?.toLowerCase().startsWith(langHint.toLowerCase()))
    .sort((a,b) => (a.name || '').localeCompare(b.name || ''))
}

export async function speak(text: string, opts?: { lang?: 'en-US'|'en-GB', rate?: number, pitch?: number }) {
  if (!text?.trim()) {
    console.warn('TTS: 빈 텍스트입니다.')
    return
  }

  if (!window.speechSynthesis) {
    console.error('TTS: SpeechSynthesis API가 지원되지 않습니다.')
    alert('음성 기능이 지원되지 않는 브라우저입니다.')
    return
  }

  // 초기화되지 않았으면 로드
  if (!isInitialized) {
    console.log('TTS: 음성 초기화 중...')
    await loadVoices()
  }

  const synth = window.speechSynthesis
  
  // 기존 음성 중지
  try { synth.cancel() } catch {}
  
  const u = new SpeechSynthesisUtterance(text)
  u.lang = opts?.lang ?? 'en-US'
  u.rate = opts?.rate ?? 1.0
  u.pitch = opts?.pitch ?? 1.0
  
  // 음성 선택
  const availableVoices = listVoices(u.lang)
  const voice = 
    availableVoices[0] ||
    cachedVoices.find(v => v.lang?.startsWith('en')) ||
    cachedVoices[0]
  
  if (voice) {
    u.voice = voice
    console.log(`TTS: "${text}" 재생 중 (${voice.name}, ${voice.lang})`)
  } else {
    console.warn('TTS: 적절한 음성을 찾을 수 없습니다. 시스템 기본 음성 사용')
  }

  // 이벤트 리스너 추가
  u.onstart = () => console.log('TTS: 음성 재생 시작')
  u.onend = () => console.log('TTS: 음성 재생 완료')
  u.onerror = (e) => {
    console.error('TTS: 음성 재생 오류:', e)
    if (e.error === 'not-allowed') {
      alert('음성 재생이 차단되었습니다. 브라우저 설정에서 음성 권한을 허용해주세요.')
    }
  }

  try {
    synth.speak(u)
  } catch (error) {
    console.error('TTS: speak() 호출 오류:', error)
    alert('음성 재생에 실패했습니다.')
  }
}

// TTS 초기화 함수
export async function initTTS(): Promise<boolean> {
  try {
    console.log('TTS: 초기화 시작')
    await loadVoices()
    
    // 무음으로 테스트 음성 재생 (사용자 권한 확인용)
    const testUtterance = new SpeechSynthesisUtterance('')
    testUtterance.volume = 0
    window.speechSynthesis.speak(testUtterance)
    
    console.log('TTS: 초기화 완료')
    return true
  } catch (error) {
    console.error('TTS: 초기화 실패:', error)
    return false
  }
}