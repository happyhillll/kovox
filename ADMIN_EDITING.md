# KoVox 로컬 인라인 편집

공개 전, 로컬에서 데이터 오류를 사이트 화면에서 직접 고치기 위한 도구입니다.
백엔드 JSON을 직접 만지지 않고, detail 페이지의 **✎ 버튼**으로 수정하면
`kovox/data/kovox-data.js` / `kovox/data/kovox-rdb.js` 파일이 바로 수정됩니다.

## 실행

```bash
cd /Users/minjikim/Documents/GitHub/kovox
node serve.js
```

브라우저에서 **http://localhost:8000** 로 접속합니다.
(편집 버튼은 `localhost` 에서만 보입니다. `file://` 로 열거나 공개 사이트에서는 나타나지 않습니다.)

## 동작 방식

```
✎ 버튼으로 수정 → POST /api/edit → serve.js 가 kovox/data/*.js 직접 수정
   (.bak 백업 생성) → 페이지 자동 새로고침 → 인덱스 재빌드 → 엔티티 연결 일관
```

- **단일 정본**: 정적 파일이 곧 데이터입니다. 오버레이/병합 레이어가 없습니다.
- 저장 시 자동으로 `*.bak` 백업이 만들어집니다 (`.gitignore` 처리됨).
- 수정이 끝나면 평소처럼 `git add . && git commit && git push` 로 배포합니다.

## 세 가지 편집 (예: `#/detail/25000952`)

| 항목 | 위치 | 저장 대상 |
|---|---|---|
| **detail images 숨기기** | `● DETAIL IMAGES` 옆 ✎ | `KOVOX_DATA.performances[].hide_detail_images` |
| **singer 정보 / 줄바꿈** | SINGER 이름 아래 ✎ | `KOVOX_RDB.persons[].person_profile` (`pre-line` 으로 줄바꿈 표시) |
| **accompanist 정보 추가/수정** | ACCOMPANIST 이름 아래 ✎ | `KOVOX_RDB.persons[].person_profile` (반주자 엔티티 → 다른 공연에도 반영) |
| **host / sponsor 수정·추가** | HOST / SPONSOR 칸 아래 ✎ | 그룹 연결 시 `groups[].group_name`, 아니면 `performances[].host_organization` / `sponsoring_organization` |
| **program 곡 삭제** | 각 곡 오른쪽 🗑 삭제 | `programs` 행 + 해당 `participations` 삭제 (work 엔티티는 보존) |
| **program 곡 추가 (중간 삽입)** | 곡 사이/맨 앞 `+ 곡 추가` | 새 `programs` 행(중간 `program_order`) + 필요 시 새 `works` 행 |
| **composer (Unknown 수정)** | PROGRAMME 작곡가명 옆 ✎ | `KOVOX_RDB.works[].mb_composer` + `KOVOX_DATA.performances[].composers[]` |
| **work 이름 수정** | PROGRAMME 각 곡 아래 `✎ work 수정` | 아래 3가지 방식 |

### work 이름 수정 (3가지 방식 · Contribute 와 동일 UX)
- **기존 곡 검색 (SEARCH EXISTING WORKS)**: `KOVOX_RDB.works` 에서 제목·작곡가로 검색 → 선택하면
  이 program 항목을 그 **기존 work 에 재연결**(`programs[].work_id` 변경). work 상세·similar·통계가 올바르게 병합됩니다.
- **MusicBrainz**: `musicbrainz.org` API 로 곡 검색 → 선택하면 현재 work 의 `mb_title`·`mb_composer`·`mbid`·`mb_language` 를 채웁니다.
- **직접 입력**: 제목을 텍스트로 입력 → 현재 work 의 `mb_title` 을 바로 수정.

> 재연결(기존 곡 검색)로 작곡가가 다른 work 에 연결하면 Archive 의 composer 칩(`KOVOX_DATA.composers[]`)은
> 자동 갱신되지 않습니다. 필요하면 `✎ composer` 로 함께 고치세요.

### 곡 추가 (`+ 곡 추가`)
곡과 곡 사이(또는 맨 앞)의 `+ 곡 추가` 버튼으로 같은 3가지 방식(기존 곡 / MusicBrainz / 직접 입력)으로 삽입합니다.
- **새 작곡가**가 들어가면 재그룹 시 자동으로 새 composer 그룹이 PROGRAMME 에 표시됩니다.
- 삽입 위치는 앞뒤 곡의 `program_order` 중간값으로 계산되어 순서가 유지됩니다.
- 추가/삭제 시 그 공연의 `KOVOX_DATA.composers[]` 도 함께 재계산됩니다.

## 서버 편집 프로토콜 (`POST /api/edit`)
`{ edits: [ ... ] }`, 각 edit:
- `op: 'set'`(기본) — `{ store, collection, key, match, set }`
- `op: 'insert'` — `{ store, collection, rows }`
- `op: 'delete'` — `{ store, collection, key, match, allowEmpty? }`

`store` 는 `'data'`(kovox-data.js) / `'rdb'`(kovox-rdb.js). 한 요청의 모든 edit 은 메모리에서 먼저 적용된 뒤
한 번에 파일로 저장되므로, 하나라도 실패하면 아무것도 기록되지 않습니다(원자적).

### composer 엔티티 연결
- composer 편집기는 **기존 작곡가명 자동완성**을 제공합니다.
- 기존 이름과 **정확히 일치**하면 입력창 아래 `✓ 기존 composer "…" 에 연결됩니다` 가 뜨고,
  저장 시 `#/composer/<이름>` 페이지·programme·통계에 자동으로 합쳐집니다.
- 다른 표기를 입력하면 `⚠ 새 composer 로 생성됩니다` 경고가 뜹니다. (오타로 별도 엔티티가
  생기는 것을 막기 위함 — 가급적 자동완성 목록에서 고르세요.)

## 알려진 한계

- Composers **랜딩 페이지**(`#/composers`)의 Top-50 순위와 count 는 미리 계산된 스냅샷입니다.
  composer 를 고쳐도 이 순위 숫자는 자동 갱신되지 않습니다. (composer **상세/연결**은 정상 동작)
  순위까지 정확히 맞추려면 원래 데이터 생성 파이프라인으로 `composers` 집계를 다시 굽습니다.
- composer 는 **곡(work)** 의 속성이라, 여러 공연이 공유하는 work 의 작곡가를 고치면
  그 work 가 등장하는 **모든 공연**에 반영됩니다 (엔티티 데이터로서는 올바른 동작).
