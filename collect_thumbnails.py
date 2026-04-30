#!/usr/bin/env python3
import os
import shutil
import glob
from pathlib import Path

# 소스 폴더 경로
source_dir = "/Users/minjikim/Documents/GitHub/JODH/ver.4/FINAL/진짜 Final/진짜 정말 Final/KoVox_ephemera"

# 임시 폴더 경로
temp_dir = "/Users/minjikim/Documents/GitHub/happyhillll.github.io/temp_thumbnails"

# 임시 폴더 생성
os.makedirs(temp_dir, exist_ok=True)

# 성공적으로 복사된 파일 수
copied_count = 0
skipped_count = 0

print("thumbnail 파일들을 수집하고 있습니다...")

# 모든 performance ID 폴더를 순회
for performance_dir in os.listdir(source_dir):
    performance_path = os.path.join(source_dir, performance_dir)
    
    # 디렉토리인지 확인
    if os.path.isdir(performance_path):
        # thumbnail_poster_01.gif 파일 찾기
        thumbnail_file = os.path.join(performance_path, "thumbnail_poster_01.gif")
        
        if os.path.exists(thumbnail_file):
            # performance ID를 파일명으로 사용하여 복사
            dest_file = os.path.join(temp_dir, f"{performance_dir}.gif")
            shutil.copy2(thumbnail_file, dest_file)
            copied_count += 1
            print(f"복사됨: {performance_dir}.gif")
        else:
            skipped_count += 1
            print(f"건너뜀: {performance_dir} (thumbnail 파일 없음)")

print(f"\n완료!")
print(f"복사된 파일: {copied_count}개")
print(f"건너뜀: {skipped_count}개")
print(f"임시 폴더: {temp_dir}")


