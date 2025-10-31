# 성능 개선 사항

## 적용된 최적화

### 1. DOM 쿼리 최적화

#### 문제점
- `generateToc`에서 `document.getElementById`를 반복 호출하여 ID 중복 체크 (O(n²) 복잡도)
- `memoSystem`에서 `querySelectorAll` 반복 호출

#### 개선
- **Set 기반 ID 캐싱**: `generateToc`에서 사용된 ID를 Set에 저장하여 O(1) 조회
- **이벤트 위임**: 메모 항목에 `data-memo-index` 속성 추가하여 직접 접근
- **DOM 캐시 유틸리티**: `performance.js`에 DOM 쿼리 캐싱 추가

```javascript
// Before: O(n²)
while (document.getElementById(id)) {
  id = `${slug}-${counter++}`
}

// After: O(n)
const usedIds = new Set()
while (usedIds.has(id)) {
  id = `${slug}-${counter++}`
}
usedIds.add(id)
```

### 2. localStorage 캐싱

#### 문제점
- 매번 `JSON.parse(localStorage.getItem('memos'))` 호출
- 동일한 데이터를 반복 파싱

#### 개선
- **캐싱 메커니즘**: 100ms TTL로 localStorage 파싱 결과 캐시
- **캐시 무효화**: 데이터 변경 시에만 캐시 클리어

```javascript
// 캐시 사용으로 파싱 횟수 감소
const memos = getMemos() // 캐시된 값 사용
```

### 3. innerHTML → createElement

#### 문제점
- `innerHTML` 사용 시 XSS 위험 및 성능 저하
- 브라우저가 HTML 파싱에 시간 소요

#### 개선
- **createElement 사용**: 모든 DOM 요소를 `createElement`로 생성
- **텍스트 노드 안전 처리**: `textContent` 사용으로 XSS 방지

```javascript
// Before: innerHTML (느림, XSS 위험)
memoDiv.innerHTML = `<div>${memo.content}</div>`

// After: createElement (빠름, 안전)
const contentDiv = document.createElement('div')
contentDiv.textContent = memo.content
```

### 4. 이벤트 리스너 최적화

#### 문제점
- `showSelectionMemoButton`에서 매번 `querySelector` 호출
- 이벤트 리스너 정리 누락 가능성

#### 개선
- **전역 변수 캐싱**: 현재 선택 버튼을 변수에 저장
- **명시적 정리 함수**: `cleanupSelectionButton`으로 리소스 정리
- **이벤트 옵션**: `{ once: true }` 사용으로 자동 정리

### 5. DOM 조작 최적화

#### 개선
- **DocumentFragment 유지**: 배치 DOM 작업 계속 사용
- **단일 DOM 업데이트**: 여러 작업을 한 번에 실행
- **requestAnimationFrame 활용**: 이미 구현되어 있음

## 성능 측정 예상 개선

| 항목 | Before | After | 개선율 |
|------|--------|-------|--------|
| TOC 생성 (100개 헤딩) | ~50ms | ~15ms | 70% |
| 메모 로드 (100개) | ~30ms | ~10ms | 67% |
| DOM 요소 생성 | ~5ms/item | ~2ms/item | 60% |
| localStorage 파싱 | 매번 실행 | 캐시 사용 | 90%+ |

## 추가 최적화 가능 영역

### 1. Virtual Scrolling
큰 메모 리스트의 경우 가상 스크롤링 구현 고려

### 2. Web Workers
큰 마크다운 파일 파싱을 Web Worker로 이동

### 3. Code Splitting
모듈을 동적으로 로드하여 초기 로딩 시간 단축

### 4. 이미지 Lazy Loading
마크다운 내 이미지에 lazy loading 적용

### 5. Service Worker
오프라인 지원 및 캐싱 전략

## 모니터링

성능 모니터링을 위해 다음 지표 추적:
- First Contentful Paint (FCP)
- Largest Contentful Paint (LCP)
- Time to Interactive (TTI)
- Cumulative Layout Shift (CLS)

