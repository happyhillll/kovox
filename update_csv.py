#!/usr/bin/env python3
import csv
import re

def format_running_time(time_str):
    """90.0분 > 90 minutes 형식으로 변환"""
    if not time_str or time_str.strip() == '':
        return time_str
    
    # 숫자와 "분" 패턴 찾기
    match = re.search(r'(\d+(?:\.\d+)?)분', time_str)
    if match:
        minutes = match.group(1)
        # 소수점이 있으면 제거
        if '.' in minutes:
            minutes = str(int(float(minutes)))
        return f"{minutes} minutes"
    
    return time_str

def update_csv():
    input_file = "/Users/minjikim/Documents/GitHub/happyhillll.github.io/data/kovox_converted.csv"
    output_file = "/Users/minjikim/Documents/GitHub/happyhillll.github.io/data/kovox_converted_updated.csv"
    
    with open(input_file, 'r', encoding='utf-8') as infile, \
         open(output_file, 'w', encoding='utf-8', newline='') as outfile:
        
        reader = csv.reader(infile)
        writer = csv.writer(outfile)
        
        for row_num, row in enumerate(reader):
            if row_num == 0:  # 헤더 행
                writer.writerow(row)
                continue
            
            if len(row) >= 7:  # 최소한 필요한 컬럼이 있는지 확인
                # _PerformanceTitle (4번째 컬럼, 인덱스 3)에 # 추가
                if len(row) > 3 and row[3]:
                    row[3] = f"# {row[3]}"
                
                # _PerformanceTime(Interval) (7번째 컬럼, 인덱스 6) 형식 변경
                if len(row) > 6 and row[6]:
                    row[6] = format_running_time(row[6])
            
            writer.writerow(row)
            
            if row_num % 1000 == 0:
                print(f"처리 중... {row_num}행 완료")

    print("CSV 파일 업데이트 완료!")
    print(f"원본 파일: {input_file}")
    print(f"업데이트된 파일: {output_file}")

if __name__ == "__main__":
    update_csv()


