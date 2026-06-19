#!/usr/bin/env bash
#
# KoVox 발행 — 한 번에 실행
#   1) sync_csv.py      편집된 rdb.js -> 제출용 5개 CSV 그 자리 갱신
#   2) generate_seo.py  편집 내용으로 SEO 페이지 + sitemap 재생성
#   3) git add/commit/push  라이브(kovox.co.kr) 배포
#
# 사용:
#   ./publish.sh                 (기본 커밋 메시지: 날짜)
#   ./publish.sh "커밋 메시지"   (메시지 지정)
#
set -uo pipefail
cd "$(dirname "$0")"

MSG="${1:-Update KoVox data $(date '+%Y-%m-%d %H:%M')}"

echo "▶ 1/3  CSV 동기화 (sync_csv.py)"
if ! python3 sync_csv.py; then
  echo "⚠  CSV 동기화 실패 — sync_csv.py 의 OUT_DIR 경로를 확인하세요. (계속 진행)"
fi

echo ""
echo "▶ 2/3  SEO 재생성 (generate_seo.py)"
if ! python3 generate_seo.py; then
  echo "✗  SEO 재생성 실패 — 중단합니다 (배포하지 않음)."
  exit 1
fi

echo ""
echo "▶ 3/3  git 커밋 & 푸시"
git add -A
if git diff --cached --quiet; then
  echo "변경 사항이 없습니다 — 커밋/푸시를 생략합니다."
  exit 0
fi
git commit -q -m "$MSG"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if git push origin "$BRANCH"; then
  echo ""
  echo "✅  배포 완료: \"$MSG\"  (브랜치: $BRANCH)"
  echo "    GitHub Pages 빌드 후 1~2분 내 kovox.co.kr 반영."
else
  echo "✗  push 실패 — 커밋은 로컬에 남아 있습니다. 'git push' 를 수동으로 다시 시도하세요."
  exit 1
fi
