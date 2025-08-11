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

// TTS 상태 관리 변수
let isSpeaking = false
let lastSpeakTime = 0

export async function speak(text: string, opts?: { lang?: 'en-US'|'en-GB', rate?: number, pitch?: number, retries?: number }) {
  const maxRetries = opts?.retries ?? 2
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`TTS: 재시도 ${attempt}/${maxRetries}`)
        // 재시도 전 잠깐 대기
        await new Promise(resolve => setTimeout(resolve, 200))
      }
      
      return await _speakOnce(text, opts)
    } catch (error) {
      console.log(`TTS: ${attempt + 1}번째 시도 실패:`, error.message)
      
      if (attempt === maxRetries) {
        console.error('TTS: 모든 재시도 실패')
        throw error
      }
    }
  }
}

async function _speakOnce(text: string, opts?: { lang?: 'en-US'|'en-GB', rate?: number, pitch?: number }) {
  if (!text?.trim()) {
    console.warn('TTS: 빈 텍스트입니다.')
    return
  }

  if (!window.speechSynthesis) {
    console.error('TTS: SpeechSynthesis API가 지원되지 않습니다.')
    alert('음성 기능이 지원되지 않는 브라우저입니다.')
    return
  }

  // 너무 빠른 연속 호출 방지 (300ms 간격으로 줄임)
  const now = Date.now()
  if (now - lastSpeakTime < 300) {
    console.log('TTS: 너무 빠른 호출 - 대기 중...')
    await new Promise(resolve => setTimeout(resolve, 300 - (now - lastSpeakTime)))
  }
  lastSpeakTime = Date.now()

  // 이미 재생 중이면 대기
  if (isSpeaking) {
    console.log('TTS: 기존 음성 재생 중 - 대기...')
    await waitForSpeechEnd()
  }

  // 초기화되지 않았으면 로드
  if (!isInitialized) {
    console.log('TTS: 음성 초기화 중...')
    await loadVoices()
  }

  const synth = window.speechSynthesis
  
  // 기존 음성 완전 중지 및 대기
  try { 
    if (synth.speaking) {
      synth.cancel()
      // 취소 완료 대기
      await new Promise(resolve => {
        let attempts = 0
        const checkStopped = () => {
          if (!synth.speaking || attempts > 10) {
            resolve(undefined)
          } else {
            attempts++
            setTimeout(checkStopped, 50)
          }
        }
        checkStopped()
      })
    }
  } catch (e) {
    console.log('TTS: cancel 오류 무시:', e)
  }
  
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

  // Promise로 음성 재생 완료 대기
  return new Promise<void>((resolve, reject) => {
    u.onstart = () => {
      console.log('TTS: 음성 재생 시작')
      isSpeaking = true
    }
    
    u.onend = () => {
      console.log('TTS: 음성 재생 완료')
      isSpeaking = false
      resolve()
    }
    
    u.onerror = (e) => {
      console.error('TTS: 음성 재생 오류:', e.error, e)
      isSpeaking = false
      
      if (e.error === 'not-allowed') {
        console.warn('TTS: 음성 권한이 차단됨')
        reject(new Error(`TTS Error: ${e.error}`))
      } else if (e.error === 'interrupted') {
        console.log('TTS: 음성이 중단됨 - 정상 처리')
        resolve() // interrupted는 에러가 아닌 정상 중단으로 처리
      } else if (e.error === 'synthesis-failed') {
        console.warn('TTS: 음성 합성 실패 - 재시도 가능')
        reject(new Error(`TTS Error: ${e.error}`))
      } else {
        console.error('TTS: 알 수 없는 오류:', e.error)
        reject(new Error(`TTS Error: ${e.error}`))
      }
    }

    try {
      synth.speak(u)
    } catch (error) {
      console.error('TTS: speak() 호출 오류:', error)
      isSpeaking = false
      reject(error)
    }
  })
}

// 음성 재생 완료 대기 함수
async function waitForSpeechEnd(): Promise<void> {
  return new Promise(resolve => {
    const checkInterval = setInterval(() => {
      if (!isSpeaking && !window.speechSynthesis.speaking) {
        clearInterval(checkInterval)
        resolve()
      }
    }, 100)
    
    // 최대 10초 대기 후 강제 해제
    setTimeout(() => {
      clearInterval(checkInterval)
      isSpeaking = false
      resolve()
    }, 10000)
  })
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