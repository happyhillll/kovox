import csv
import re

input_file = '/Users/minjikim/GitHub/happyhillll.github.io/data/(0711)reallywanttogohome.csv'
output_file = '/Users/minjikim/GitHub/happyhillll.github.io/data/(0711)reallywanttogohome_filled.csv'

# config.json의 detail.structure에 맞는 칼럼명 매핑
col_map = {
    '공연ID': '_PerformanceID',
    '티켓주소': '_티켓 사이트 주소',
    '공연제목': '_PerformanceTitle',
    '공연일': '_PerformanceDate',
    '공연장': '_Venue',
    '출연자': '_SingerAbstract',
    '반주자이름': '_AccompaniedPerformer',
    '반주자프로필': '_AccompaniedPerformerAbstract',
    # 필요한 만큼 추가
}

with open(input_file, 'r', encoding='utf-8') as infile, open(output_file, 'w', encoding='utf-8', newline='') as outfile:
    reader = csv.DictReader(infile)
    # 헤더 변환
    new_fieldnames = [col_map.get(col, col) for col in reader.fieldnames]
    if 'year' not in new_fieldnames:
        new_fieldnames.append('year')
    writer = csv.DictWriter(outfile, fieldnames=new_fieldnames)
    writer.writeheader()
    for row in reader:
        # 칼럼명 변환
        new_row = {col_map.get(k, k): v for k, v in row.items()}
        # PerformanceID 자동 채움
        perf_id = new_row.get('_PerformanceID', '')
        ticket_url = new_row.get('_티켓 사이트 주소', '')
        if (not perf_id or perf_id.strip() == '') and ticket_url:
            m = re.search(r'/([^/]+)$', ticket_url.strip())
            if m:
                new_row['_PerformanceID'] = m.group(1)
        # year 컬럼 채우기 (_PerformanceDate에서 연도 추출)
        perf_date = new_row.get('_PerformanceDate', '')
        year_match = re.search(r'(\d{4})', perf_date)
        if year_match:
            new_row['year'] = year_match.group(1)
        else:
            new_row['year'] = ''
        writer.writerow(new_row)

print('완료: (0711)reallywanttogohome_filled.csv 파일이 생성되었습니다.') 