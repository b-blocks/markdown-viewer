# 디자인 패턴 적용 가이드

이 프로젝트에는 여러 디자인 패턴이 적용되어 있습니다.

## 적용된 패턴들

### 1. Observer Pattern (`Observer.js`)
**목적**: 모듈 간 느슨한 결합을 통한 이벤트 기반 통신

**사용 예시**:
```javascript
import { eventBus } from './patterns/Observer.js'

// 이벤트 구독
eventBus.on('memo:added', (data) => {
  console.log('메모가 추가되었습니다:', data.memo)
})

// 이벤트 발행
eventBus.emit('memo:added', { memo: newMemo })
```

**이점**:
- 모듈 간 직접적인 의존성 제거
- 확장 가능한 이벤트 시스템
- 디버깅 및 로깅 용이

### 2. State Pattern (`State.js`)
**목적**: 상태 전이 관리 및 상태 변경 알림

**사용 예시** (Auto-scroll):
```javascript
import StateMachine from './patterns/State.js'

const stateMachine = new StateMachine('stopped', {
  stopped: ['scrolling'],
  scrolling: ['stopped', 'at-bottom']
})

stateMachine.onStateChange(({ from, to }) => {
  console.log(`상태 변경: ${from} -> ${to}`)
})

stateMachine.transition('scrolling')
```

**이점**:
- 명확한 상태 전이 규칙
- 상태 변경 추적 가능
- 상태 기반 UI 업데이트

### 3. Factory Pattern (`Factory.js`)
**목적**: 일관된 DOM 요소 생성

**사용 예시**:
```javascript
import DOMFactory from './patterns/Factory.js'

// 메모 요소 생성
const memoElement = DOMFactory.createMemoElement(memo, index)

// 로딩 스피너 생성
const spinner = DOMFactory.createLoadingSpinner('로딩 중...')

// 에러 메시지 생성
const error = DOMFactory.createErrorElement('에러 발생')
```

**이점**:
- 일관된 DOM 구조
- 재사용 가능한 요소 생성
- 유지보수 용이

### 4. Strategy Pattern (`Strategy.js`)
**목적**: 다양한 렌더링 전략 교체 가능

**사용 예시**:
```javascript
import { Renderer, MarkdownRenderingStrategy, HTMLRenderingStrategy } from './patterns/Strategy.js'

const renderer = new Renderer(new MarkdownRenderingStrategy())
renderer.render(markdown, contentPanel)

// 전략 변경
renderer.setStrategy(new HTMLRenderingStrategy())
renderer.render(html, contentPanel)
```

**이점**:
- 런타임에 전략 교체 가능
- 새로운 렌더링 방식 추가 용이
- 테스트 용이

### 5. Command Pattern (`Command.js`)
**목적**: 액션을 객체로 캡슐화하여 실행/취소 가능

**사용 예시**:
```javascript
import { AddMemoCommand, CommandInvoker } from './patterns/Command.js'

const invoker = new CommandInvoker()
const command = new AddMemoCommand(memo, localStorage, memoList)

// 실행
invoker.execute(command)

// 취소
invoker.undo()
```

**이점**:
- 실행 취소/재실행 가능
- 액션 큐잉 및 로깅 가능
- 트랜잭션 처리 용이

## 패턴 적용 위치

- **Observer Pattern**: 모든 모듈 간 통신
- **State Pattern**: `autoScroll.js` - 스크롤 상태 관리
- **Factory Pattern**: `memoSystem.js`, `markdownRenderer.js`, `main.js` - DOM 요소 생성
- **Strategy Pattern**: `markdownRenderer.js` - 렌더링 전략
- **Command Pattern**: `memoSystem.js` - 메모 액션 (추가/수정/삭제)

## 추가 활용 가능성

1. **Mediator Pattern**: 모듈 간 복잡한 상호작용 조정
2. **Singleton Pattern**: 설정 및 캐시 관리
3. **Decorator Pattern**: 기능 확장 (예: 로깅, 성능 측정)
4. **Template Method Pattern**: 공통 알고리즘 구조화

