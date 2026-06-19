#!/usr/bin/env python3
"""
Sync the KoVox source CSVs from the edited kovox-rdb.js.

읽기:  kovox/data/kovox-rdb.js  (편집 정본)
쓰기:  OUT_DIR 의 KoVox_{work,person,performance,program,participation}.csv (그 자리 갱신)
       - 쓰기 전 기존 파일을 OUT_DIR/_csv_backups/<timestamp>/ 에 백업
       - 컬럼 순서/형식은 원본 헤더 그대로 유지

사용: python3 sync_csv.py
"""
import json
import os
import csv
import shutil
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE_DIR, "kovox", "data", "kovox-rdb.js")

# 출력 폴더 (제출용 2nd Revision). 다른 곳에 쓰려면 이 경로만 바꾸면 됩니다.
OUT_DIR = "/Users/minjikim/Documents/GitHub/JODH/ver.4/FINAL/진짜 Final/진짜 정말 Final/ㅈㅔㅊㅜㄹ/Revision/output_kopis/nom_bid_rebuild/ㅠㅠ/ㅎㅎ/ㅋㅋ/제출용/2nd Revision"

# 각 CSV 의 컬럼 순서 (원본 헤더 그대로)
SCHEMA = {
    "KoVox_work.csv": ("works", [
        "work_id", "title_variant", "mb_title", "mb_type", "mb_language", "mb_composer",
        "mb_composer_birth_year", "mb_composer_death_year", "mb_lyricist", "mb_arranger",
        "mbid", "mb_parent_work_title", "mbid_parent_work"]),
    "KoVox_person.csv": ("persons", [
        "person_id", "person_name", "person_role", "person_medium", "person_profile", "person_isni"]),
    "KoVox_performance.csv": ("performances", [
        "performance_id", "performance_date", "performance_title", "venue_name", "duration_minutes",
        "performance_abstract", "start_time", "host_organization", "sponsoring_organization", "mt20id"]),
    "KoVox_program.csv": ("programs", [
        "program_item_id", "performance_id", "work_id", "program_order", "is_intermission"]),
    "KoVox_participation.csv": ("participations", [
        "performance_id", "program_item_id", "person_id"]),
}


def load_rdb():
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        content = f.read()
    json_str = content.split("=", 1)[1].strip().rstrip().rstrip(";")
    return json.loads(json_str)


def cell(v):
    if v is None:
        return ""
    return v


def main():
    rdb = load_rdb()
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_dir = os.path.join(OUT_DIR, "_csv_backups", stamp)

    for fname, (coll, cols) in SCHEMA.items():
        rows = rdb.get(coll, [])
        path = os.path.join(OUT_DIR, fname)

        # 1) 기존 파일 백업
        if os.path.exists(path):
            os.makedirs(backup_dir, exist_ok=True)
            shutil.copy2(path, os.path.join(backup_dir, fname))

        # 2) 원자적 쓰기 (임시파일 -> rename)
        tmp = path + ".tmp"
        with open(tmp, "w", encoding="utf-8", newline="") as f:
            w = csv.writer(f)
            w.writerow(cols)
            for r in rows:
                w.writerow([cell(r.get(c)) for c in cols])
        os.replace(tmp, path)
        print(f"  {fname:26s} <- {coll:14s} {len(rows):6d} rows")

    print(f"\n백업: {backup_dir}")
    print("완료: rdb.js -> 5개 CSV 그 자리 갱신")


if __name__ == "__main__":
    main()
