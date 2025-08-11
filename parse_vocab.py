import re

def is_korean(text):
    if not text or not text.strip():
        return False
    return bool(re.search(r'[\uac00-\ud7a3]', text))

def is_special_line(line):
    line = line.strip()
    return (
        not line or
        re.match(r'^\\d{4}$', line) or
        line.startswith('[') or
        line.startswith('ⓥ') or
        line.startswith('ⓝ') or
        line.startswith('ⓐ') or
        line.startswith('--')
    )

def process_file(input_path, output_path):
    with open(input_path, 'r', encoding='utf-8') as f:
        lines = [line.strip() for line in f.readlines()]

    with open(output_path, 'w', encoding='utf-8') as f_out:
        i = 0
        while i < len(lines):
            line = lines[i]

            if is_special_line(line) or is_korean(line):
                f_out.write(line + '\n')
                i += 1
                continue

            # At this point, the line is English.
            # Differentiate between the word and an example sentence.
            if ' ' not in line:  # This is the word itself.
                f_out.write(line + '\n')
                i += 1
                continue
            else:  # This is an example sentence.
                english_sentence = line
                
                # Look ahead for continuations.
                next_i = i + 1
                while next_i < len(lines):
                    next_line = lines[next_i]
                    # Stop merging if the next line is Korean or a special line.
                    if is_korean(next_line) or is_special_line(next_line):
                        break
                    
                    # It's a continuation line.
                    english_sentence += ' ' + next_line.strip()
                    next_i += 1
                
                f_out.write(english_sentence + '\n')
                i = next_i  # Jump the main loop counter past the merged lines.

if __name__ == "__main__":
    process_file('사랑영단어 수능 2000.txt', '사랑영단어_수정.txt')
    print("파일 처리 완료: 사랑영단어_수정.txt")