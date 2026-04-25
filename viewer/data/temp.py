import os
import re

folders = ["data/1024", "data/4096"]

for folder in folders:
    for filename in os.listdir(folder):
        # unknown_숫자.jpg 패턴만 변경
        m = re.match(r"unknown_(\\d+)\\.jpg$", filename)
        if m:
            new_name = f"{m.group(1)}.jpg"
            src = os.path.join(folder, filename)
            dst = os.path.join(folder, new_name)
            # 파일명 충돌 방지
            if not os.path.exists(dst):
                os.rename(src, dst)
                print(f"{filename} → {new_name}")
            else:
                print(f"이미 존재: {new_name} (스킵)")
print("이름 변경 완료!")