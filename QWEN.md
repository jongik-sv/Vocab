# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Korean-English vocabulary learning web application currently built on Google Apps Script and Google Spreadsheet, with planned migration to PWA + Supabase architecture. It provides a flashcard-style interface for high school students to memorize English vocabulary with Korean translations.

**Current State:** Google Apps Script + Google Spreadsheet system
**Future Vision:** Progressive Web App (PWA) with Supabase backend for improved offline support, cross-platform compatibility, and modern user experience

## Platform Architecture

### Current Architecture (Google Apps Script)

**Technology Stack:**
- **Backend**: Google Apps Script (Code.gs)
- **Data Storage**: Google Spreadsheet with structured sheets
- **Frontend**: HTML templates with embedded CSS/JavaScript 
- **Deployment**: Google Apps Script Web App

**Key Components:**
- `Code.gs` - Server-side Google Apps Script functions
- `index.html` - Main UI template with embedded includes
- `stylesheet.html` - CSS styles (included via template)
- `javascript.html` - Client-side JavaScript (included via template)

### Planned Architecture (PWA + Supabase)

**Future Technology Stack:**
- **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES6+) with PWA features
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **Data Storage**: PostgreSQL with Row Level Security (RLS)
- **Deployment**: Vercel (Frontend) + Supabase Cloud (Backend)
- **Offline Support**: Service Worker + IndexedDB for offline data management
- **Authentication**: Supabase Auth with social login options

**Migration Specifications:**
- Complete design document available at `.kiro/specs/english-vocabulary-pwa/design.md`
- Requirements document at `.kiro/specs/english-vocabulary-pwa/requirements.md`
- Key improvements: Offline functionality, app installation, cross-device sync, rich text editor for Korean content

## Data Structure

The application uses four Google Sheets based on PRD specifications:

1. **WordList Sheet**: Primary vocabulary data
   - Columns: 영어단어(A), 한국어뜻(B), 품사(C), 예문(D), 단어장이름(E), 챕터(F), 외움체크(G), 등록일(H), 마지막학습일(I)

2. **StudyLog Sheet**: Daily learning statistics  
   - Columns: 날짜(A), 학습단어수(B), 신규단어수(C), 복습단어수(D)

3. **Config Sheet**: Application settings
   - Settings: 일일목표단어수(A), 카드표시방식(B), 게임모드활성화(C), TTS활성화(D), 발음속도(E), 발음종류(F)

4. **BookManagement Sheet**: Vocabulary book management
   - Columns: 단어장이름(A), 설명(B), 생성일(C), 총단어수(D), 완료단어수(E), 진행률(F)

## Core Functionality

**Learning Flow:**
1. `getUnmemorizedWords()` fetches words not marked as memorized
2. Frontend displays cards with flip animation (English ↔ Korean)
3. `markWordAsMemorized()` updates word status and study logs
4. Progress tracking and completion detection

**Key Server Functions:**
- `getSpreadsheet()` - Central spreadsheet access function (handles null reference issues)
- `initializeSheets()` - Auto-creates required sheets with sample data
- `getWordList()` / `getUnmemorizedWords()` - Data retrieval with filtering
- `markWordAsMemorized()` - Study progress tracking
- `updateStudyLog()` - Daily statistics management  
- `resetMemorizedStatus()` - Learning reset functionality
- `getBookList()` / `getChapterList()` - Book and chapter management
- `getCurrentSpreadsheetId()` - Handles spreadsheet ID detection for web app deployment

## Template System

Uses Google Apps Script's HTML templating:
- `doGet()` serves the main application
- `include()` function embeds CSS/JS files into HTML
- `onOpen()` creates spreadsheet menu integration

## Development Workflow

**Testing in Google Apps Script:**
1. Create new Google Spreadsheet
2. Open Extensions > Apps Script
3. Replace default code with Code.gs contents
4. Create HTML files: index.html, stylesheet.html, javascript.html
5. Deploy as Web App for testing

**Key Constraints:**
- 6-minute execution time limit for Google Apps Script functions
- Google Spreadsheet API call quotas
- Client-server communication via `google.script.run`
- Web app deployment requires spreadsheet ID detection (not available in getActiveSpreadsheet())

**Critical Architecture Note:**
The core challenge in this codebase is handling spreadsheet access in web app deployment. The `getSpreadsheet()` function implements a multi-layered approach:
1. Try `getActiveSpreadsheet()` (works in editor)
2. Use cached spreadsheet ID with `openById()` 
3. Fall back to `getCurrentSpreadsheetId()` for web app context

## Mobile Optimization

The application is designed for tablet/smartphone usage:
- Responsive CSS grid layouts
- Touch-friendly card flip interactions
- Mobile-first button sizing and spacing
- Viewport meta tags for proper mobile rendering

## Error Handling Patterns

- Server functions return `{success: boolean, error?: string}` objects
- Client uses Promise.all for parallel data loading
- Loading overlays during server communication
- Graceful fallbacks for missing data or initialization

## Development Commands

**No package.json or npm commands** - This is a Google Apps Script project deployed directly to Google's platform.

**Testing:**
- Test HTML files are available: `test_minimal.html`, `test_simple.html`
- Manual testing through Apps Script editor or deployed web app URL
- Use spreadsheet menu integration via `onOpen()` for quick access

**Deployment:**
1. Copy code to Google Apps Script editor
2. Create HTML template files
3. Deploy as web app with appropriate permissions
4. Test via provided web app URL

## Project Structure and Patterns

**File Organization:**
- `/Apps Script/` - Contains all Google Apps Script files (current implementation)
- `/.kiro/specs/english-vocabulary-pwa/` - PWA migration specifications
  - `design.md` - Detailed PWA architecture and implementation plan
  - `requirements.md` - User stories and acceptance criteria for PWA features
- `/docs/` - Documentation and design specifications
- `PRD.md` - Complete product requirements document for current system
- `request_history.md` - Development request tracking

**Code Architecture:**

*Current (Google Apps Script):*
- Monolithic `Code.gs` with all server-side functions
- Includes system handles complex spreadsheet access patterns
- Error handling returns structured `{success, error}` objects
- Client-side uses Promise patterns for async server communication

*Future (PWA + Supabase):*
- Component-based JavaScript architecture (WordCard, StudySession, etc.)
- Rich text editor for Korean content with formatting support
- Service Worker for offline functionality and caching strategy
- Supabase client with Row Level Security for data protection
- IndexedDB for offline data storage and sync management
- PWA manifest for app installation and standalone mode

## Development Workflow Rules
1. 한국어로 대화 해줘.
2. 단계가 끝날 때 마다 너가 변경한 파일만 커밋해줘
3. TDD 방법론으로 진행해줘.
4. 각 task 개발 단계가 시작될때 해당 단계에 대한 설계를 먼저 하고 시작해. 
 - 설계 참고 문서 : ./kiro/specs/english-vocabulary-pwa/design.md, 추가로 PRD.md
 - 설계 문서 생성 위치 : './docs/detail design/' 
 - 설계 문서 파일명 규칙 : [Task 이름].md(예: Task 1.1 프로젝트 초기화.md)
 - 다른 Task 설계서를 업데이트 하지말고 현재 Task에 대한 설계서만  작성해줘.
 - 설계 내용위주로 넣고 특별한 언급이 없다면 소스 코드(html, javascript, typescript, css) 내용을 넣지마.
 - 현재 Task 설계서 작성 후 이전 단계의 컨셉과 다른지 체크를 해. 
 - 컨셉이 다르면 멈추고 나에게 설명을 하고 결정을 기다려.
 - 설계 내용위주로 넣고 특별한 언급이 없다면 css 등의 코드 내용을 넣지마.
5. 일반요청이면 ./docs 폴더 밑에 `[순서].[요청내용].md`(예: 000.Supabase_모바일_앱_전환_가이드.md) 형태의 설계를 생성해줘.
6. 개발이 끝난 코드는 리팩토링을 수행
7. 단계가 끝날 때 설계서와 기능을 비교 해서 잘못된 곳이 없는지 확인하고 알려줘. 그냥 수정요청에 의해 수정을 한 것이면 설계서에 해당 내용을 반영해줘.
8. npm test 를 수행 할 경우 자동으로 키보드 q키를 누르는 것과 동일하게 해서 자동으로 넘어가도록 해줘.
9. 요청은 반듯이 request_history.md 에 요청을 캐리지 리턴으로 구분을 하고 구분선(`
------
`)과 캐리지 리턴을 추가하고 요청과 수정파일 리스트를 추가 해줘. 500줄이 넘으면 현재 파일은 request_history[시퀀스 번호].md로 move 하고 새롭게 파일을 시작해줘.
10. Task의 교차검증 요청 시에는 '### Cross Check Rules'를 따를 것. 
11. 교차검증의 결과를 적용하라는 요청을 받을 '### Apply Cross Check Rules'를 따를 것.


### Cross Check Rules
1. 상세설계(./docs/detail design)의 내용에 문제가 없는지 확인 할 것
2. 상세설계서의 자체 모순이 있는지 확인할 것.
3. 상세설계서(./docs/detail design) 문서와 코드 비교할 것
4. 코드 수정 하지말고 문제점 발견 위주의 활동할 것
5. 리팩토링 방안이 있으면 제시할 것
6. 교차검증 결과는 파일로 저장할 것
  - 위치 : './docs/cross check' 폴더
  - 파일명 규칙 : 'cross_check_[상세설계문서 이름].md'(예: cross_check_Task 1.1 프로젝트 초기화.md)
7. 동시에 여러 에이전트가 검증할 수 있으니 만약 교차검증 결과 파일이 이미 존재 한다면 절대로 기존 내용을 수정하지말고 구분선('\n---\n') 추가 후 마지막에 추가 할 것.
8. 중간과정과 파일 작성은 모두 한국어로 해줘.

### Apply Cross Check Rules
1. 교차검증 내용은 './docs/cross check' 폴더에 있음
2. 검증 내용을 검토 후 유리한 방향으로 적용할 것
3. 설계 내용이 바뀐다면 설계 문서도 업데이트 할 것.