# -*- coding: utf-8 -*-
"""
사랑영단어 수능 2000 → 클래스 기반 HTML + 공통 CSS 생성기
- 입력: ./사랑영단어 수능 2000.txt
- 출력: ./vocab_shared.css, ./사랑영단어_수능_2000_class_based.json
- chapter_id = (id - 1) // 40 + 1
"""
import json
import re
import html
import math
from pathlib import Path

SRC_TXT = Path("./사랑영단어 수능 2000.txt")
OUT_CSS = Path("./vocab_shared.css")
OUT_JSON = Path("./사랑영단어_수능_2000_class_based.json")

# 공통 CSS (라이트/다크모드 지원)
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

def regroup_example_lines(lines):
    """줄바꿈으로 끊긴 영문 예문을 연도 태그가 나올 때까지 병합."""
    out, buf = [], ""
    for ln in lines:
        ln = ln.rstrip()
        if not ln:
            continue
        if buf:
            # 자연스러운 공백 처리
            sep = "" if buf.endswith(("—","-","/","(")) or ln.startswith((")",",",".",";","?","!")) else " "
            buf += sep + ln
        else:
            buf = ln
        if YEAR_END.search(buf):
            out.append(buf)
            buf = ""
    if buf:
        out.append(buf)
    return out

def extract_defs(lines):
    """품사/의미 라인 추출."""
    defs, i = [], 0
    for i, ln in enumerate(lines):
        s = ln.strip()
        if s.startswith(("ⓥ","ⓝ","ⓐ","ⓟ")) or s.startswith("ad"):
            defs.append(s)
        else:
            break
    return defs, lines[i:]

def split_examples(lines):
    """예문 EN/KO를 페어링. 다음 문장이 연도 태그 없으면 KO로 간주."""
    grouped = regroup_example_lines(lines)
    pairs, i = [], 0
    while i < len(grouped):
        en = grouped[i]; i += 1
        ko = None
        if i < len(grouped) and not YEAR_END.search(grouped[i]):
            ko = grouped[i]; i += 1
        pairs.append((en, ko))
    return pairs

def pos_badge_and_meaning(text):
    if text.startswith("ⓥ"): return "verb", text[2:].strip()
    if text.startswith("ⓝ"): return "noun", text[2:].strip()
    if text.startswith("ⓐ"): return "adj",  text[2:].strip()
    if text.startswith("ⓟ"): return "prep", text[2:].strip()
    if text.startswith("ad"): return "adv",  text.replace("ad","ad.").strip()
    return "def", text.strip()

def build_html(word_id, headword, phonetic, defs, examples):
    defs_html = []
    for d in defs:
        badge, meaning = pos_badge_and_meaning(d)
        defs_html.append(
            f"<div class='pos'>{html.escape(badge)}</div>"
            f"<span class='mean'>{html.escape(meaning)}</span><br/>"
        )
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
    return (
        "<section class='voc'>"
        "  <article class='card'>"
        f"    <header class='head'><div class='hw'>{html.escape(headword)}</div>"
        f"      <div class='phon'>{html.escape(phonetic)}</div>"
        f"      <div class='meta'>#{str(word_id).zfill(4)}</div></header>"
        f"    <div class='defs'>{''.join(defs_html)}</div>"
        f"    <div class='examples'>{''.join(ex_html)}</div>"
        "  </article>"
        "</section>"
    )

def main():
    if not SRC_TXT.exists():
        raise FileNotFoundError(f"입력 파일이 없습니다: {SRC_TXT}")

    raw = SRC_TXT.read_text(encoding="utf-8").strip()
    blocks = [b.strip() for b in raw.split("---") if b.strip()]

    items = []
    for b in blocks:
        lines = [ln for ln in b.splitlines() if ln.strip()]
        if len(lines) < 4: 
            continue
        if not ID_RE.match(lines[0]) or not PHON_RE.match(lines[1]):
            continue

        word_id  = int(lines[0])                       # 파일의 4자리 id 사용
        phonetic = lines[1].strip()
        headword = lines[2].strip()
        rest     = lines[3:]

        defs, remainder = extract_defs(rest)
        examples = split_examples(remainder) if remainder else []

        html_content = build_html(word_id, headword, phonetic, defs, examples)

        # chapter_id 40개씩 챕터 묶음
        chapter_id =  ((word_id +39) // 40)
        items.append({
            "id": word_id,
            "notebook_id": "사랑영단어 수능 2000",
            "chapter_id": chapter_id,
            "headword": headword,
            "phonetic": phonetic,
            "html_content": html_content
        })

    # 출력 쓰기
    OUT_CSS.write_text(CSS, encoding="utf-8")
    OUT_JSON.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"CSS  → {OUT_CSS.resolve()}")
    print(f"JSON → {OUT_JSON.resolve()}")
    print(f"총 {len(items)}개 항목 생성 완료.")

if __name__ == "__main__":
    main()
