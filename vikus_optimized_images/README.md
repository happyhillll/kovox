# VIKUS Viewer 이미지 사용법

## 폴더 구조
```
vikus_optimized_images/
├── *.gif                    # 최적화된 썸네일 이미지들
├── image_metadata.json      # 이미지 메타데이터
├── performance_mapping.json # 공연 ID와 제목 매핑
└── README.md               # 이 파일
```

## 사용 방법

### 1. VIKUS Viewer에 이미지 추가
- `vikus_optimized_images/` 폴더의 모든 `.gif` 파일을 VIKUS viewer의 이미지 폴더로 복사하세요.

### 2. 공연 정보 매핑
- `performance_mapping.json` 파일을 참조하여 공연 ID와 제목을 매핑하세요.
- 이 파일에는 각 공연의 ID, 제목, 이미지 파일명이 포함되어 있습니다.

### 3. 이미지 메타데이터
- `image_metadata.json` 파일에는 각 이미지의 최적화 정보가 포함되어 있습니다.
- 원본 크기, 최적화된 크기, 파일 크기 등을 확인할 수 있습니다.

## 이미지 사양
- 형식: GIF (애니메이션 보존)
- 권장 크기: 300x400 픽셀 (비율 유지)
- 최적화: 파일 크기 최소화

## 주의사항
- 모든 이미지는 공연 ID로 명명되어 있습니다.
- 일부 공연은 이미지가 없을 수 있습니다.
- GIF 형식은 애니메이션이 포함된 경우 원본을 그대로 유지합니다.

## VIKUS Viewer 설정
VIKUS viewer에서 다음 설정을 권장합니다:
- 이미지 폴더: `vikus_optimized_images/`
- 지원 형식: GIF, JPG, PNG
- 썸네일 크기: 300x400 픽셀
