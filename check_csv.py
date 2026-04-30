#!/usr/bin/env python3
import csv

def check_csv():
    file_path = "/Users/minjikim/Documents/GitHub/happyhillll.github.io/data/kovox_converted_updated.csv"
    
    with open(file_path, 'r', encoding='utf-8') as file:
        reader = csv.reader(file)
        
        # 헤더 확인
        header = next(reader)
        print("헤더:")
        for i, col in enumerate(header):
            print(f"{i}: {col}")
        
        print("\n첫 번째 데이터 행:")
        first_row = next(reader)
        print(f"Performance Title (컬럼 3): {first_row[3]}")
        print(f"Performance Time (컬럼 6): {first_row[6]}")
        
        print("\n두 번째 데이터 행:")
        second_row = next(reader)
        print(f"Performance Title (컬럼 3): {second_row[3]}")
        print(f"Performance Time (컬럼 6): {second_row[6]}")

if __name__ == "__main__":
    check_csv()


