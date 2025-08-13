# -*- coding: utf-8 -*-
"""
사랑영단어 수능 2000 → 스타일 복원 + 의미 탐지 보강 최종판
- 입력 : ./사랑영단어 수능 2000.txt  (세션상 경로)
- 출력 : ./vocab_shared.css, ./사랑영단어_수능2000_styled_final.json
- 규칙 요약:
  * '---' 단독 라인으로 블록 분리
  * id(4자리) → phonetic([..], 선택) → headword → html_content
  * 뜻: 첫 영어 라인 이전 구간에서 최대 3줄
        - (A) 라인 시작이 ⓥ/ⓝ/ⓐ/ⓟ/ad/pn/~ 이고 '한글 포함'  → 의미
        - (B) 위 토큰이 없더라도 '한글 포함'이면 의미로 인정(예: '마치 ~처럼')
  * 예문(EN): 영어 시작 라인 연속 병합 (줄바꿈 자연 병합)
  * 번역(KO): EN 뒤 연속 한글 라인 병합
  * 연도 태그: EN 끝의 YY모고|수능 → <span class='year-tag'>YY모고</span>
  * chapter_id = ((id + 39) // 40) → 두 자리 문자열
  * html_content: 클래스 기반 카드(스타일 유지)
"""
import json, re, html
from pathlib import Path

SRC = Path("./사랑영단어 수능 2000.txt")
OUT_JSON = Path("./사랑영단어_수능2000_styled_final.json")
OUT_CSS  = Path("./vocab_shared.css")

CSS = """
/* ----- Vocabulary Card Styles (Shared) ----- */
:root{
  --bg:#ffffff; --ink:#111827; --muted:#6b7280; --border:#e5e7eb; --elev:rgba(0,0,0,.04);
  --chip-bg:#eef2ff; --chip-ink:#3730a3;
  --tag-bg:#fde68a; --tag-ink:#92400e;
  --subtle:#f9fafb; --ex-border:#f3f4f6; --ex-bg:#fcfcfd;
  --radius:16px;
  --font:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Inter,'Apple SD Gothic Neo','Noto Sans KR',Helvetica,Arial,sans-serif;
}
.voc { font-family: var(--font); line-height:1.6; display:block; }
.voc .card { background:var(--bg); border:1px solid var(--border); border-radius:var(--radius); padding:16px; box-shadow:0 1px 2px var(--elev); }
.voc .head { display:flex; align-items:baseline; gap:8px; flex-wrap:wrap; }
.voc .hw   { font-size:22px; font-weight:700; color:var(--ink); }
.voc .phon { font-size:14px; color:var(--muted); }
.voc .meta { margin-left:auto; font-size:12px; color:#9ca3af; }
.voc .defs { margin-top:8px; padding:10px; background:var(--subtle); border-radius:12px; }
.voc .pos  { display:inline-flex; align-items:center; gap:6px; font-weight:600; padding:2px 8px; border-radius:999px; background:var(--chip-bg); color:var(--chip-ink); font-size:12px; margin-right:6px; }
.voc .mean { color:#374151; }
.voc .examples { margin-top:10px; display:flex; flex-direction:column; gap:10px; }
.voc .ex   { padding:10px 12px; border:1px solid var(--ex-border); border-radius:12px; background:var(--ex-bg); }
.voc .en   { color:var(--ink); }
.voc .ko   { color:#4b5563; margin-top:6px; }
.voc .year-tag { display:inline-block; margin-left:8px; padding:2px 6px; border-radius:999px; background:var(--tag-bg); color:var(--tag-ink); font-size:12px; font-weight:600; }
@media (prefers-color-scheme: dark) {
  :root{
    --bg:#0b0e14; --ink:#e5e7eb; --muted:#94a3b8; --border:#1f2937; --elev:rgba(0,0,0,.25);
    --subtle:#0f172a; --ex-border:#111827; --ex-bg:#0f172a;
    --chip-bg:#0b3bff22; --chip-ink:#a5b4fc;
    --tag-bg:#f59e0b22; --tag-ink:#fbbf24;
  }
}
""".strip()

# Regex helpers
ID_RE      = re.compile(r"^\d{4}$")
PHON_RE    = re.compile(r"^\[.*?\]$")
ENG_START  = re.compile(r"^[A-Za-z]")   # letter 시작
HANGUL_RE  = re.compile(r"[\uac00-\ud7a3]")
YEAR_TAIL  = re.compile(r"(?:\s|-)?(\d{2})(모고|수능)\s*$")
MEAN_TOK   = re.compile(r"^\s*(ⓥ|ⓝ|ⓐ|ⓟ|ad\b|pn\b|~)", re.IGNORECASE)

def is_english_start(s:str)->bool:
    s = s.lstrip()
    return bool(s and ENG_START.match(s))

def has_hangul(s:str)->bool:
    return bool(HANGUL_RE.search(s))

def is_tokened_meaning(s:str)->bool:
    """토큰이 있는 의미 라인인지 확인: ⓥ/ⓝ/ⓐ/ⓟ/ad/pn/~ 으로 시작하고 한글 포함"""
    s_stripped = s.strip()
    has_token = bool(MEAN_TOK.match(s_stripped))
    has_korean = has_hangul(s_stripped)
    return has_token and has_korean

def smart_join(prev:str, nxt:str)->str:
    if not prev: return nxt
    return prev + ("" if prev.endswith(("—","-","/","(")) or nxt.startswith((")",",",".",";","?","!","'","\"")) else " ") + nxt

def highlight_year_tail(en_line:str)->str:
    m = YEAR_TAIL.search(en_line)
    if not m:
        return html.escape(en_line)
    core = en_line[:m.start()].rstrip()
    return html.escape(core) + f"<span class='year-tag'>{m.group(1)}{m.group(2)}</span>"

def split_blocks(text:str):
    return [b.strip() for b in re.split(r"^\s*---\s*$", text, flags=re.M) if b.strip()]

def parse_block(block:str):
    lines = [ln.rstrip() for ln in block.splitlines() if ln.strip()]
    if len(lines) < 2: return None
    if not ID_RE.match(lines[0]): return None
    word_id = int(lines[0])

    idx, phon = 1, ""
    if idx < len(lines) and PHON_RE.match(lines[idx]):
        phon = lines[idx].strip(); idx += 1

    if idx >= len(lines): return None
    headword = lines[idx].strip(); idx += 1
    content = lines[idx:]

    # 1) 뜻: 첫 영어 라인 이전에서 최대 3줄
    meanings, i = [], 0
    while i < len(content) and len(meanings) < 3:
        s = content[i]
        
        # 영어로 시작하지만 토큰이 있는 의미라면 의미로 처리
        if is_tokened_meaning(s):
            meanings.append(s.strip())
            i += 1
            continue
            
        # 일반 영어 라인이면 의미 추출 종료
        if is_english_start(s): 
            break
            
        # 한글 포함 라인이면 의미로 처리
        if has_hangul(s):
            meanings.append(s.strip())
            i += 1
        else:
            break

    # 2) 예문/번역
    examples = []
    while i < len(content):
        # 토큰이 있는 의미 라인은 건너뛰기 (이미 의미에서 처리됨)
        if is_tokened_meaning(content[i]):
            i += 1
            continue
            
        # 영어로 시작하지 않으면 건너뛰기
        if not is_english_start(content[i]): 
            i += 1
            continue
            
        # EN merge
        en_buf = content[i].strip(); i += 1
        while i < len(content) and is_english_start(content[i]) and not is_tokened_meaning(content[i]):
            en_buf = smart_join(en_buf, content[i].strip()); i += 1
            
        # KO merge
        ko_buf = ""
        while i < len(content) and has_hangul(content[i]) and not is_english_start(content[i]) and not is_tokened_meaning(content[i]):
            ko_buf = smart_join(ko_buf, content[i].strip()); i += 1
            
        examples.append((en_buf, ko_buf or None))

    # HTML build (class-based)
    defs_html = "".join(f"<span class='mean'>{html.escape(m)}</span><br/>" for m in meanings)
    ex_html_parts = []
    for en, ko in examples:
        en_html = highlight_year_tail(en)
        blk = f"<div class='ex'><div class='en'>{en_html}</div>"
        if ko: blk += f"<div class='ko'>{html.escape(ko)}</div>"
        blk += "</div>"
        ex_html_parts.append(blk)
    phon_html = f"<div class='phon'>{html.escape(phon)}</div>" if phon else ""
    html_content = (
        "<section class='voc'>"
        "  <article class='card'>"
        f"    <header class='head'><div class='hw'>{html.escape(headword)}</div>{phon_html}<div class='meta'>#{str(word_id).zfill(4)}</div></header>"
        f"    <div class='defs'>{defs_html}</div>"
        f"    <div class='examples'>{''.join(ex_html_parts)}</div>"
        "  </article>"
        "</section>"
    )
    return {
        "id": f"{word_id:04d}",
        "notebook_id": "사랑영단어 수능 2000",
        "chapter_id": f"{((word_id + 39)//40):02d}",
        "headword": headword,
        "phonetic": phon,
        "html_content": html_content
    }

# 실행
raw = Path(SRC).read_text(encoding="utf-8")
blocks = split_blocks(raw)
items = [rec for b in blocks if (rec := parse_block(b))]

# 저장
OUT_CSS.write_text(CSS, encoding="utf-8")
OUT_JSON.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")

len(items), OUT_JSON.as_posix(), OUT_CSS.as_posix()
