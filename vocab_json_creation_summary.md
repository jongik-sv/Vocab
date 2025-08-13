# Vocabulary JSON File Creation

The vocabulary JSON file has been successfully created according to the specifications in 추출방법.md.

## File Details
- **Input file**: 사랑영단어 수능 2000.txt
- **Output file**: 사랑영단어_수능_2000_parsed.json
- **Total entries**: 1,993

## Structure
Each entry contains:
- `id`: The numeric ID from the source file
- `notebook_id`: "사랑영단어 수능 2000"
- `chapter_id`: Calculated using the formula (id + 39) // 40
- `headword`: The English word or phrase
- `phonetic`: The phonetic transcription (if available)
- `html_content`: Formatted HTML content with meanings, example sentences, and translations

## Parsing Logic
1. Entries are separated by `---` markers
2. The first line of each entry is the ID
3. Phonetic transcriptions are in brackets [ ] on the second line (if present)
4. The headword follows the phonetic line
5. Content lines are processed as:
   - Meaning lines (Korean definitions)
   - Example sentence pairs (English + Korean translation)
   - Year tags (e.g., "06모고", "11수능") are preserved in the English sentences

## Chapter ID Calculation
- Groups words into chapters of 40 entries each
- Uses the formula (id + 39) // 40
- Examples:
  - IDs 1-40 → Chapter 1
  - IDs 41-80 → Chapter 2
  - IDs 81-120 → Chapter 3
  - etc.

The JSON file is now ready for use in applications that need structured vocabulary data.