import re
import json

def parse_vocabulary_file(file_path):
    # Parse the vocabulary text file and convert it to JSON format
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Split by --- separator
    entries = re.split('---\\s*\n', content.strip())
    
    vocab_list = []
    
    for entry in entries:
        if not entry.strip():
            continue
            
        lines = entry.strip().split('\n')
        
        # Skip empty entries
        if len(lines) < 2:
            continue
            
        # Extract ID (first line)
        id_line = lines[0].strip()
        if not id_line.isdigit():
            continue
            
        id = int(id_line)
        
        # Extract phonetic (second line in brackets)
        phonetic = ""
        headword_index = 1
        if len(lines) > 1 and lines[1].startswith('[') and ']' in lines[1]:
            phonetic = lines[1][1:lines[1].find(']')]
            headword_index = 2
        
        # Extract headword
        if len(lines) <= headword_index:
            continue
        headword = lines[headword_index].strip()
        
        # Extract content lines (after headword)
        content_lines = lines[headword_index + 1:]
        
        # Process content lines into HTML format
        html_content = ""
        i = 0
        while i < len(content_lines):
            line = content_lines[i].strip()
            if not line:
                i += 1
                continue
                
            # Check if line is an example sentence (contains year info)
            if re.search('\\d{2}(모고|수능)', line):
                # This is an English example sentence
                english_line = line
                
                # Check if next line is Korean translation
                korean_translation = ""
                if i + 1 < len(content_lines):
                    next_line = content_lines[i + 1].strip()
                    if next_line and not re.search('\\d{2}(모고|수능)', next_line):
                        korean_translation = next_line
                        i += 1  # Skip the next line as it's a translation
                
                # Format with HTML
                html_content += '<p>' + english_line + '</p>\n'
                if korean_translation:
                    html_content += '<p>' + korean_translation + '</p>\n'
            else:
                # This is a meaning or regular text
                html_content += '<p>' + line + '</p>\n'
            
            i += 1
        
        # Calculate chapter_id using the formula from requirements
        chapter_id = (id + 39) // 40
        
        # Create vocab entry
        vocab_entry = {
            "id": id,
            "notebook_id": "사랑영단어 수능 2000",
            "chapter_id": chapter_id,
            "headword": headword,
            "phonetic": phonetic,
            "html_content": html_content.strip()
        }
        
        vocab_list.append(vocab_entry)
    
    return vocab_list

def save_to_json(vocab_list, output_file):
    # Save vocabulary list to JSON file
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(vocab_list, f, ensure_ascii=False, indent=2)

# Parse the vocabulary file
vocab_list = parse_vocabulary_file("사랑영단어 수능 2000.txt")

# Save to JSON
save_to_json(vocab_list, "사랑영단어_수능_2000_parsed.json")

print("Parsed " + str(len(vocab_list)) + " vocabulary entries and saved to 사랑영단어_수능_2000_parsed.json")