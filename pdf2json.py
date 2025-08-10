import re
import json
import zipfile
from PyPDF2 import PdfReader

# PDF 경로
pdf_path = "./사랑영단어 수능 2000.pdf"

# notebook_id 고정 값
notebook_id_value = "사랑영단어 수능"

# 결과 저장 리스트
result = []

# PDF 읽기
reader = PdfReader(pdf_path)

current_day = None

# 정규식 패턴
day_pattern = re.compile(r"DAY\s*(\d{1,2})")
word_pattern = re.compile(r"^[A-Za-z\-]+$")  # 영단어
phonetic_pattern = re.compile(r"\[.*?\]")  # 발음기호 대괄호 포함

for page in reader.pages:
    text = page.extract_text()
    if not text:
        continue

    lines = text.split("\n")
    i = 0
    while i < len(lines):
        line = lines[i].strip()

        # DAY 정보 갱신
        day_match = day_pattern.match(line)
        if day_match:
            day_num = int(day_match.group(1))
            current_day = f"day{day_num:02d}"
            i += 1
            continue

        # 단어 라인 처리
        if word_pattern.match(line) and current_day:
            headword = line
            phonetic = None
            html_content = ""

            # 다음 줄이 발음기호인지 확인
            if i + 1 < len(lines) and phonetic_pattern.search(lines[i+1]):
                phonetic = lines[i+1].strip()
                i += 1

            # 다음 줄을 뜻 + 예문으로
            if i + 1 < len(lines):
                meaning_example = lines[i+1].strip()
                html_content = meaning_example

            result.append({
                "notebook_id": notebook_id_value,
                "chapter_id": current_day,
                "headword": headword,
                "phonetic": phonetic,
                "html_content": html_content,
                "tags": None
            })

        i += 1

# JSON 파일 저장
json_path = "./사랑영단어_수능_2000.json"
with open(json_path, "w", encoding="utf-8") as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

# ZIP으로 압축
zip_path = "./사랑영단어_수능_2000.zip"
with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
    zipf.write(json_path, arcname="사랑영단어_수능_2000.json")

zip_path
