# -*- coding: utf-8 -*-
"""
사랑영단어 수능 2000 → 클래스 기반 HTML + 공통 CSS 생성기 (예문/번역 분리: 기존 로직 준용)
- 입력: /mnt/data/사랑영단어 수능 2000.txt
- 출력: /mnt/data/vocab_shared.css, /mnt/data/사랑영단어_수능_2000_class_based.json
- chapter_id = ((id + 39) // 40)
"""
import json, re, html
from pathlib import Path

SRC_TXT = Path("/mnt/data/사랑영단어 수능 2000.txt")
OUT_CSS = Path("/mnt/data/vocab_shared.css")
OUT_JSON = Path("/mnt/data/사랑영단어_수능_2000_class_based.json")

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

ID_RE    = re.compile(r"^\d{4}$")
PHON_RE  = re.compile(r"^\[.*?\]$")
YEAR_END = re.compile(r"(?:\d{2}(?:모고|수능))\s*$")
ENG_START = re.compile(r"^[A-Za-z]")

def split_blocks(raw: str):
    return [b.strip() for b in re.split(r"^\s*---\s*$", raw, flags=re.M) if b.strip()]

def first_english_index(lines):
    for i, ln in enumerate(lines):
        if ENG_START.match(ln.strip()):
            return i
    return None

def regroup_until_year(lines):
    """기존 로직: 연도 태그로 문장 경계를 판단하여 병합."""
    out, buf = [], ""
    for ln in lines:
        s = ln.rstrip()
        if not s:
            continue
        if buf:
            sep = "" if buf.endswith(("—","-","/","(")) or s.startswith((")",",",".",";","?","!","'","\"")) else " "
            buf += sep + s
        else:
            buf = s
        if YEAR_END.search(buf):
            out.append(buf)
            buf = ""
    if buf:
        out.append(buf)
    return out

def split_examples_from_grouped(grouped):
    """기존 방식: 다음 문장이 연도 태그가 없으면 번역으로 간주."""
    pairs = []
    i = 0
    while i < len(grouped):
        en = grouped[i]; i += 1
        ko = None
        if i < len(grouped) and not YEAR_END.search(grouped[i]):
            ko = grouped[i]; i += 1
        pairs.append((en, ko))
    return pairs

def build_html(word_id, headword, phonetic, meanings, examples):
    # 의미 영역: POS 없이 의미 줄만 표시
    defs_html = []
    for m in meanings:
        defs_html.append(f"<span class='mean'>{html.escape(m.strip())}</span><br/>")
    # 예문 영역
    ex_html = []
    for en, ko in examples:
        en = en.strip()
        tag = ""
        m = YEAR_END.search(en)
        if m:
            tag = f"<span class='year-tag'>{html.escape(m.group(0).strip())}</span>"
            en = en[:m.start()].rstrip()
        block = f"<div class='ex'><div class='en'>{html.escape(en)}{tag}</div>"
        if ko:
            block += f"<div class='ko'>{html.escape(ko.strip())}</div>"
        block += "</div>"
        ex_html.append(block)
    phon = f"<div class='phon'>{html.escape(phonetic)}</div>" if phonetic else ""
    return (
        "<section class='voc'>"
        "  <article class='card'>"
        f"    <header class='head'><div class='hw'>{html.escape(headword)}</div>"
        f"      {phon}"
        f"      <div class='meta'>#{str(word_id).zfill(4)}</div></header>"
        f"    <div class='defs'>{''.join(defs_html)}</div>"
        f"    <div class='examples'>{''.join(ex_html)}</div>"
        "  </article>"
        "</section>"
    )

raw = SRC_TXT.read_text(encoding="utf-8").strip()
blocks = split_blocks(raw)

items = []
for b in blocks:
    lines = [ln for ln in b.splitlines() if ln.strip()]
    if len(lines) < 2:
        continue

    # ID
    if not ID_RE.match(lines[0].strip()):
        continue
    word_id = int(lines[0].strip())

    # phonetic (optional)
    idx = 1
    phonetic = ""
    if idx < len(lines) and PHON_RE.match(lines[idx].strip()):
        phonetic = lines[idx].strip()
        idx += 1

    # headword
    if idx >= len(lines):
        continue
    headword = lines[idx].strip()
    idx += 1

    remainder = [ln for ln in lines[idx:] if ln.strip()]

    # 의미: 첫 영어 라인 이전까지
    en_start = first_english_index(remainder)
    if en_start is None:
        meanings = [s.strip() for s in remainder]
        grouped = []
    else:
        meanings = [s.strip() for s in remainder[:en_start] if s.strip()]
        grouped = regroup_until_year(remainder[en_start:])

    examples = split_examples_from_grouped(grouped) if grouped else []

    html_content = build_html(word_id, headword, phonetic, meanings, examples)
    chapter_id = (word_id + 39) // 40

    items.append({
        "id": word_id,
        "notebook_id": "사랑영단어 수능 2000",
        "chapter_id": chapter_id,
        "headword": headword,
        "phonetic": phonetic,
        "html_content": html_content
    })

# 저장
OUT_CSS.write_text(CSS, encoding="utf-8")
OUT_JSON.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"CSS  → {OUT_CSS}")
print(f"JSON → {OUT_JSON}")
print(f"총 {len(items)}개 항목 생성 완료.")
