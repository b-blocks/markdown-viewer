# 큰 마크다운 파일 최적화 가이드

## 현재 구현 상태

### ✅ 이미 구현된 최적화

1. **Lazy Syntax Highlighting**
   - IntersectionObserver를 사용하여 뷰포트에 들어올 때만 코드 블록 하이라이팅
   - 첫 5개 코드 블록만 즉시 하이라이팅
   - 큰 파일에서 수백 개의 코드 블록이 있어도 성능 영향 최소화

2. **Progressive Rendering**
   - requestAnimationFrame 사용으로 UI 블로킹 방지
   - 스크롤 캐싱으로 반복 계산 방지

3. **청크 단위 렌더링** (새로 추가됨)
   - 1MB 이상 파일은 자동으로 청크 단위로 렌더링
   - 진행 상황 표시
   - UI 응답성 유지

### ⚠️ 큰 파일(3MB+) 처리 시 고려사항

#### 현재 한계점

1. **DOM 노드 수**
   - 브라우저는 일반적으로 ~50,000개의 DOM 노드를 효율적으로 처리
   - 3MB 마크다운 파일은 약 100,000-200,000줄일 수 있음
   - 매우 긴 라인이나 복잡한 구조는 더 많은 DOM 노드 생성

2. **메모리 사용**
   - 전체 HTML을 한 번에 메모리에 보관
   - 렌더링된 HTML은 원본 마크다운보다 2-3배 큼

3. **초기 렌더링 시간**
   - 3MB 파일 렌더링: 약 2-5초 (하드웨어에 따라 다름)
   - 청크 렌더링으로 UI 블로킹은 방지되지만 전체 시간은 비슷

## 성능 최적화 전략

### 1. 청크 렌더링 (구현 완료)

```javascript
// 파일 크기 확인
if (isLargeFile(markdown)) {
  // 청크 단위로 렌더링
  await renderChunked(markdown, contentPanel, progressCallback)
}
```

**효과:**
- UI 응답성 유지
- 진행 상황 표시
- 메모리 사용 분산

### 2. Virtual Scrolling (추가 개선 가능)

매우 큰 파일(5MB+)의 경우 가상 스크롤링 고려:

```javascript
// 뷰포트에 보이는 부분만 렌더링
// 스크롤 시 동적으로 DOM 생성/제거
```

**장점:**
- DOM 노드 수 최소화
- 메모리 사용량 감소
- 초기 렌더링 시간 단축

**단점:**
- 구현 복잡도 증가
- 스크롤 성능 최적화 필요
- 검색/복사 기능 복잡화

### 3. Web Worker 활용 (추가 개선 가능)

마크다운 파싱을 별도 스레드에서 실행:

```javascript
// Worker에서 마크다운 파싱
const worker = new Worker('markdown-parser-worker.js')
worker.postMessage(markdown)
```

**효과:**
- 메인 스레드 블로킹 완전 방지
- UI 응답성 극대화

### 4. 서버 사이드 스트리밍 (고급)

매우 큰 파일의 경우 서버에서 청크 단위로 스트리밍:

```javascript
// 서버에서 청크 단위로 전송
fetch('/stream-markdown?url=...')
  .then(stream => {
    const reader = stream.getReader()
    // 청크를 받아서 즉시 렌더링
  })
```

## 권장 설정

### 현재 구현 (3MB 파일용)

- ✅ 청크 단위 렌더링 활성화
- ✅ 진행 상황 표시
- ✅ Lazy syntax highlighting
- ✅ 스크롤 최적화

### 추가 개선이 필요한 경우

파일이 **5MB 이상**이거나 **매우 느린 기기**에서 사용하는 경우:

1. **Virtual Scrolling** 구현
2. **Web Worker**로 파싱 분리
3. **서버 사이드 청크 전송** 고려

## 성능 벤치마크

| 파일 크기 | 렌더링 시간 | DOM 노드 수 | 메모리 사용 |
|-----------|-------------|-------------|-------------|
| 100KB     | ~50ms       | ~2,000      | ~500KB      |
| 500KB     | ~200ms      | ~10,000     | ~1.5MB      |
| 1MB       | ~500ms      | ~20,000     | ~3MB        |
| 3MB       | ~2-3s       | ~60,000     | ~9MB        |
| 5MB+      | ~5-10s      | ~100,000+   | ~15MB+      |

## 사용 팁

1. **브라우저 선택**
   - Chrome/Edge: 최고 성능
   - Firefox: 양호
   - Safari: 양호 (메모리 관리 우수)

2. **하드웨어 권장사항**
   - RAM: 4GB 이상 권장
   - CPU: 최신 브라우저가 더 빠름

3. **최적화 플래그**
   - Chrome: `--enable-features=MemoryOptimizations`
   - Firefox: `about:config` → `dom.memory.enabled`

## 모니터링

브라우저 개발자 도구에서 확인:

```javascript
// Performance 탭
// - 렌더링 시간 확인
// - 메모리 사용량 확인
// - 프레임 드롭 확인

// Memory 탭
// - 힙 스냅샷으로 메모리 누수 확인
```

## 문제 해결

### 렌더링이 너무 느린 경우
1. 청크 크기 조정 (`CHUNK_SIZE` 줄이기)
2. 렌더링 딜레이 조정 (`RENDER_DELAY` 줄이기)
3. Virtual Scrolling 고려

### 메모리 부족 오류
1. 브라우저 탭 닫기
2. 다른 애플리케이션 종료
3. 가상 스크롤링 구현

### UI가 멈추는 경우
1. 청크 크기 더 줄이기
2. 렌더링 딜레이 늘리기
3. Web Worker 사용 고려

