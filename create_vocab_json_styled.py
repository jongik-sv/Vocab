'''
import json
import re
import datetime

LOG_FILE = 'debug.log'

def log(message):
    """Appends a message to the log file."""
    with open(LOG_FILE, 'a', encoding='utf-8') as f:
        f.write(f"[{datetime.datetime.now()}] {message}\n")

def create_html_content(item_id, chapter_id, headword, phonetic, content_lines):
    """
    Parses content lines and builds an HTML structure compatible with vocab_shared.css.
    """
    # Start of the card
    head_html = '''<div class="head">
        <span class="hw">{}</span>
        <span class="phon">{}</span>
        <div class="meta">Ch. {:02} / No. {:04}</div>
    </div>'''.format(headword, phonetic, chapter_id, item_id)

    defs_html_parts = []
    examples_html_parts = []
    
    # Separate definitions and examples
    current_defs = []
    lines = iter(content_lines)

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # Check for part-of-speech markers (e.g., ⓥ, ⓝ, ⓐ)
        pos_match = re.match(r'^(ⓥ|ⓝ|ⓐ|ⓟ|ad|conj|prep|pron|aux)\s*(.*)', line)
        if pos_match:
            pos_symbol = pos_match.group(1)
            mean_text = pos_match.group(2).strip()
            current_defs.append('<div><span class="pos">{}</span> <span class="mean">{}</span></div>'.format(pos_symbol, mean_text))
        # Check for English example lines
        elif re.search(r'[a-zA-Z]', line) and re.search(r'\d{2}(모고|수능)$', line):
            en_sentence = line
            ko_sentence = ""
            
            # Extract year tag
            year_tag_match = re.search(r'(\s*\d{2}(모고|수능))$', en_sentence)
            year_tag = ''
            if year_tag_match:
                tag_text = year_tag_match.group(1).strip()
                en_sentence = en_sentence[:year_tag_match.start()].strip()
                year_tag = '<span class="year-tag">{}</span>'.format(tag_text)
            
            try:
                next_line = next(lines).strip()
                if next_line and re.search(r'[가-힣]', next_line):
                    ko_sentence = next_line
            except StopIteration:
                pass # No more lines

            examples_html_parts.append('''<div class="ex">
                <p class="en">{} {}</p>
                <p class="ko">{}</p>
            </div>'''.format(en_sentence, year_tag, ko_sentence))
        # Fallback for definitions without a POS marker (like for idioms)
        else:
            current_defs.append('<div><span class="mean">{}</span></div>'.format(line))

    # Assemble the final HTML
    defs_section = ""
    if current_defs:
        defs_section = '''<div class="defs">
{}
</div>'''.format("\n".join(current_defs))

    examples_section = ""
    if examples_html_parts:
        examples_section = '''<div class="examples">
{}
</div>'''.format("\n".join(examples_html_parts))

    card_html = '''<div class="voc">
    <div class="card">
        {} 
        {}
        {}
    </div>
</div>'''.format(head_html, defs_section, examples_section)
    
    return card_html

def parse_vocab_file(input_path, output_path):
    log("---" + " Parsing vocabulary file " + "---")
    try:
        with open(input_path, 'r', encoding='utf-8') as f:
            content = f.read()
        log(f"Successfully read {input_path}")
    except FileNotFoundError:
        log(f"Error: Input file not found at {input_path}")
        return

    blocks = content.strip().split('---')
    log(f"Found {len(blocks)} blocks to process.")
    vocab_list = []

    for i, block in enumerate(blocks):
        block = block.strip()
        if not block:
            continue

        lines = block.splitlines()
        
        try:
            raw_id = lines.pop(0).strip()
            if not (raw_id.isdigit() and len(raw_id) == 4):
                log(f"Skipping block {i+1} due to invalid ID: {raw_id}")
                continue
            item_id = int(raw_id)

            phonetic = ''
            if lines and lines[0].startswith('[') and lines[0].endswith(']'):
                phonetic = lines.pop(0).strip()

            headword = lines.pop(0).strip()
            
            chapter_id = (item_id + 39) // 40

            html_content = create_html_content(item_id, chapter_id, headword, phonetic, lines)

            vocab_item = {
                "id": item_id,
                "notebook_id": "사랑영단어 수능 2000",
                "chapter_id": chapter_id,
                "headword": headword,
                "phonetic": phonetic,
                "html_content": html_content
            }
            vocab_list.append(vocab_item)

        except (IndexError, ValueError) as e:
            log(f"Skipping malformed block: {block[:50]}... | Error: {e}")
            continue
    log(f"Finished processing blocks. {len(vocab_list)} items created.")

    try:
        log(f"Writing {len(vocab_list)} items to {output_path}")
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(vocab_list, f, ensure_ascii=False, indent=2)
        log(f"Successfully created JSON file at: {output_path}")
    except IOError as e:
        log(f"Error writing to output file: {e}")


if __name__ == '__main__':
    log("Starting script...")
    input_file = '사랑영단어 수능 2000.txt'
    output_file = '사랑영단어_수능_2000_upload.json'
    parse_vocab_file(input_file, output_file)
    log("...script finished.")
'''