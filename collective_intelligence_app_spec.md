# Collective Intelligence App — Product & Development Specification

## 1. 프로젝트 개요

### 프로젝트 한 줄 설명
**흩어진 생각을 연결해, 우리만의 지식으로 만듭니다.**

이 앱은 모임에 참여한 사람들이 각자의 생각, 질문, 해석, 반대 의견, 아이디어, 실천 내용을 기록하면, 이를 한곳에 모아 AI가 비슷한 생각끼리 연결하고 하나의 공동 지식으로 정리해주는 집단지성 플랫폼이다.

단순한 회의록이나 메모 앱이 아니라, 모임 안에서 생성된 생각을 구조화하고 연결하여 다시 꺼내 쓸 수 있는 공동 지식창고를 만드는 것이 목적이다.

---

## 2. 핵심 가치

1. 사람들의 생각을 한곳에 모은다.
2. 비슷한 생각과 반복되는 패턴을 자동으로 연결한다.
3. 서로 다른 의견과 반대 의견도 분리해 보존한다.
4. 모임이 끝난 뒤 핵심 지식과 질문을 자동으로 생성한다.
5. 모임의 기록이 시간이 지나도 축적되고 연결된다.
6. 개인의 기록이 공동의 지식으로 확장된다.

---

## 3. 핵심 사용자

### 1차 목표 사용자
- 독서모임
- 사업 회의
- 스터디
- 소규모 커뮤니티
- 교회 소그룹
- 프로젝트 회고 모임
- 투자 스터디
- 교육 모임

### 대표 사용 시나리오
독서모임 참여자 5명이 같은 책을 읽고 각자의 생각을 입력한다.

예시:

- 철우: 인간은 익숙한 세계를 깨야 성장한다.
- 민수: 성장은 환경보다 선택에서 시작된다.
- 지영: 데미안은 실제 인물이 아니라 내면의 목소리일 수 있다.
- 수현: 이 책의 핵심은 자아 발견이다.

앱은 이를 다음과 같이 정리한다.

- 핵심 주제: 성장, 선택, 자아, 내면
- 공통 의견: 성장에는 익숙한 세계를 벗어나는 과정이 필요하다.
- 의견 차이: 데미안을 실제 인물로 볼 것인지 상징으로 볼 것인지 해석이 나뉜다.
- 새로운 질문: 나는 지금 어떤 익숙한 세계를 깨야 하는가?
- 실천 항목: 이번 주에 피하고 있는 선택 한 가지를 기록한다.

---

## 4. 제품 정의

### 제품 카테고리
공동 지식 관리 플랫폼 / 집단지성 기록 앱 / 협업형 지식 그래프

### 핵심 차별점
기존 메모 앱은 기록을 저장하는 데 집중한다.

이 앱은 다음에 집중한다.

- 사람들의 생각을 연결
- 유사한 의견을 자동 분류
- 공통점과 차이점 발견
- 모임 결과를 지식으로 변환
- 시간이 지날수록 축적되는 공동 지식 그래프 생성

### 제품 철학
**옵시디언이 개인의 두 번째 뇌라면, 이 앱은 모임의 공동 두뇌다.**

---

## 5. MVP 범위

초기 버전은 반드시 아래 기능만 우선 개발한다.

### 필수 기능
1. 이메일 또는 소셜 로그인
2. 모임 생성
3. 초대 링크 또는 참여 코드 생성
4. 참여자가 모임에 입장
5. 각자 자신의 생각을 작성
6. 기록 유형 선택
7. 실시간 공동 기록 보기
8. AI 모임 요약 생성
9. 핵심 주제 자동 추출
10. 공통 의견과 다른 의견 분리
11. 새로운 질문 생성
12. 실천 항목 생성
13. 모임 결과 저장
14. 과거 모임 결과 다시 보기

### 초기 버전에서 제외
- 복잡한 결제 시스템
- 영상 회의
- 대규모 조직 관리
- 고급 권한 체계
- 완전한 옵시디언 수준의 그래프 편집
- 자동 음성 녹음
- 앱스토어 네이티브 앱
- 지나치게 복잡한 프로필 기능

초기에는 모바일 웹 기반 PWA로 개발한다.

---

## 6. 사용자 흐름

### 모임 생성자 흐름
1. 로그인
2. 새 모임 만들기
3. 모임명 입력
4. 모임 주제 입력
5. 날짜 및 설명 입력
6. 초대 링크 생성
7. 참여자에게 링크 공유
8. 모임 시작
9. 참여자 기록 확인
10. AI 분석 실행
11. 결과 리포트 확인
12. 결과 저장 또는 공유

### 참여자 흐름
1. 초대 링크 클릭
2. 로그인 또는 게스트 참여
3. 이름 입력
4. 모임 주제 확인
5. 자신의 생각 작성
6. 기록 유형 선택
7. 다른 참여자의 기록 확인
8. 공감 또는 연결 표시
9. 모임 종료 후 AI 결과 확인

---

## 7. 기록 유형

각 기록은 다음 유형 중 하나를 선택할 수 있다.

- 내 생각
- 질문
- 인상 깊은 문장
- 반대 의견
- 아이디어
- 실천할 점
- 결정 사항
- 참고 자료

기록 데이터 예시:

```json
{
  "type": "thought",
  "content": "사람은 익숙한 세계를 깨야 성장할 수 있다.",
  "tags": ["성장", "변화", "두려움"],
  "authorId": "user_123",
  "meetingId": "meeting_456"
}
```

---

## 8. 주요 화면

### 8.1 로그인 화면
- 이메일 로그인
- 구글 로그인
- 게스트 참여

### 8.2 홈 화면
- 내 모임
- 최근 참여한 모임
- 최근 생성된 지식
- 새 모임 만들기 버튼

### 8.3 모임 생성 화면
입력 항목:
- 모임명
- 주제
- 설명
- 날짜
- 공개 여부
- 참여 가능 인원

### 8.4 모임방 화면
상단:
- 모임명
- 오늘의 주제
- 참여자 수
- 초대 링크

중앙:
- 전체 기록 피드
- 사람별 보기
- 기록 유형별 보기
- 주제별 보기

하단:
- 생각 입력창
- 기록 유형 선택
- 태그 입력
- 저장 버튼

### 8.5 공동 지식보드
탭 구성:
- 전체 기록
- 핵심 주제
- 연결된 생각
- 공통 의견
- 다른 의견
- 질문
- 실천 항목

### 8.6 모임 결과 리포트
표시 내용:
- 모임 요약
- 핵심 주제
- 주요 주장
- 공통 의견
- 반대 또는 다른 의견
- 새롭게 생성된 질문
- 실천 항목
- 결정 사항
- 참여자별 주요 기여
- 다음 모임 추천 주제

### 8.7 지식 그래프 화면
노드:
- 기록
- 주제
- 질문
- 사람
- 모임

연결선:
- 유사한 생각
- 반대 의견
- 같은 주제
- 원인과 결과
- 질문과 답변
- 이전 모임과 연결

---

## 9. AI 핵심 기능

AI는 사용자의 글을 대신 쓰는 역할보다, 생각을 정리하고 연결하는 역할을 한다.

### 9.1 자동 태그 생성
입력된 기록에서 핵심 키워드를 3~5개 추출한다.

### 9.2 유사한 생각 연결
문장 임베딩을 생성하여 의미가 비슷한 기록끼리 연결한다.

예시:
- "익숙한 세계를 깨야 성장한다."
- "변화는 기존 질서를 벗어날 때 시작된다."

두 기록은 유사한 생각으로 연결한다.

### 9.3 공통 의견 추출
여러 참여자가 반복해서 언급한 핵심 내용을 정리한다.

### 9.4 다른 의견 추출
서로 다른 해석, 반대 의견, 충돌하는 관점을 분리한다.

### 9.5 새로운 질문 생성
기록 전체를 분석하여 다음 토론에 사용할 질문을 만든다.

### 9.6 실천 항목 생성
모임의 생각을 실제 행동으로 바꿀 수 있는 구체적인 실천 항목을 만든다.

### 9.7 모임 요약
모임 전체를 5~10개의 핵심 문장으로 요약한다.

### 9.8 장기 패턴 분석
여러 모임에서 반복되는 주제와 질문을 찾아낸다.

예시:
- 최근 5번의 모임에서 ‘실행 부족’이라는 주제가 반복됨
- 참여자들이 ‘선택’과 ‘두려움’을 자주 연결함
- 질문은 많지만 실천 기록은 적음

---

## 10. AI 출력 구조

AI 분석 결과는 반드시 JSON 형태로 반환한다.

```json
{
  "summary": "이번 모임에서는 성장, 선택, 자아 발견에 관한 논의가 중심이 되었다.",
  "coreTopics": [
    "성장",
    "선택",
    "자아 발견",
    "두려움"
  ],
  "commonIdeas": [
    {
      "title": "성장은 익숙한 세계를 벗어나는 과정이다.",
      "relatedNoteIds": ["note_1", "note_4"]
    }
  ],
  "differentIdeas": [
    {
      "title": "데미안의 존재에 대한 해석 차이",
      "sideA": "실제 인물로 본다.",
      "sideB": "내면의 상징으로 본다.",
      "relatedNoteIds": ["note_2", "note_5"]
    }
  ],
  "newQuestions": [
    "나는 현재 어떤 익숙한 세계에 머물러 있는가?",
    "선택을 막고 있는 두려움은 무엇인가?"
  ],
  "actionItems": [
    "이번 주에 미루고 있는 선택 한 가지를 실행한다.",
    "익숙해서 반복하고 있는 행동 한 가지를 기록한다."
  ],
  "nextMeetingTopics": [
    "두려움과 선택",
    "성장에 필요한 환경"
  ]
}
```

---

## 11. 데이터베이스 설계

Supabase PostgreSQL을 사용한다.

### users
```sql
id uuid primary key
email text
name text
avatar_url text
created_at timestamptz
```

### groups
```sql
id uuid primary key
name text
description text
owner_id uuid references users(id)
created_at timestamptz
```

### group_members
```sql
id uuid primary key
group_id uuid references groups(id)
user_id uuid references users(id)
role text
created_at timestamptz
```

### meetings
```sql
id uuid primary key
group_id uuid references groups(id)
title text
topic text
description text
meeting_date timestamptz
invite_code text unique
status text
created_by uuid references users(id)
created_at timestamptz
```

### meeting_participants
```sql
id uuid primary key
meeting_id uuid references meetings(id)
user_id uuid references users(id)
display_name text
joined_at timestamptz
```

### notes
```sql
id uuid primary key
meeting_id uuid references meetings(id)
author_id uuid references users(id)
note_type text
content text
tags jsonb
embedding vector
created_at timestamptz
updated_at timestamptz
```

### note_relations
```sql
id uuid primary key
source_note_id uuid references notes(id)
target_note_id uuid references notes(id)
relation_type text
similarity_score numeric
reason text
created_at timestamptz
```

### meeting_reports
```sql
id uuid primary key
meeting_id uuid references meetings(id)
summary text
core_topics jsonb
common_ideas jsonb
different_ideas jsonb
new_questions jsonb
action_items jsonb
next_topics jsonb
created_at timestamptz
```

### reactions
```sql
id uuid primary key
note_id uuid references notes(id)
user_id uuid references users(id)
reaction_type text
created_at timestamptz
```

---

## 12. 권한 설계

### 모임 생성자
- 모임 수정
- 참여자 초대
- AI 분석 실행
- 모임 종료
- 결과 공유
- 기록 삭제 또는 숨김

### 참여자
- 자신의 기록 작성
- 자신의 기록 수정 및 삭제
- 다른 참여자 기록 보기
- 공감 표시
- 결과 리포트 보기

### 게스트
- 초대 링크가 있을 때만 참여
- 해당 모임 안에서만 기록 작성
- 모임 종료 후 제한된 결과 보기

---

## 13. 기술 스택

### 프론트엔드
- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui
- React Query 또는 TanStack Query

### 백엔드
- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Realtime
- Supabase Edge Functions

### AI
- OpenAI API 또는 Gemini API
- 임베딩 모델
- JSON structured output

### 그래프
초기 MVP:
- React Flow

향후 고급 버전:
- Cytoscape.js 또는 D3.js

### 배포
- Vercel
- Supabase

### 앱 형태
- 1차: 반응형 웹앱
- 2차: PWA
- 3차: React Native 또는 Expo

---

## 14. 폴더 구조

```text
src/
  app/
    login/
    dashboard/
    meetings/
      new/
      [meetingId]/
        page.tsx
        report/
        graph/
    api/
      meetings/
      notes/
      ai/
  components/
    meeting/
    notes/
    report/
    graph/
    ui/
  lib/
    supabase/
    ai/
    embeddings/
    auth/
    validations/
  hooks/
  types/
  utils/

supabase/
  migrations/
  functions/
    analyze-meeting/
    generate-embedding/
```

---

## 15. 핵심 API

### POST /api/meetings
새 모임 생성

### GET /api/meetings/:id
모임 상세 조회

### POST /api/meetings/:id/join
초대 코드로 모임 참여

### POST /api/meetings/:id/notes
새 기록 작성

### GET /api/meetings/:id/notes
모임 기록 조회

### PATCH /api/notes/:id
기록 수정

### DELETE /api/notes/:id
기록 삭제

### POST /api/meetings/:id/analyze
AI 모임 분석 실행

### GET /api/meetings/:id/report
모임 결과 리포트 조회

### GET /api/meetings/:id/graph
지식 그래프 데이터 조회

---

## 16. AI 분석 프롬프트

### 시스템 프롬프트
```text
당신은 여러 사람의 생각을 구조화하고 연결하는 집단지성 분석가다.

입력된 기록을 단순히 요약하지 말고 다음을 수행하라.

1. 반복되는 핵심 주제를 찾는다.
2. 의미가 비슷한 생각을 묶는다.
3. 서로 다른 관점과 반대 의견을 분리한다.
4. 기록에 없는 내용을 사실처럼 만들지 않는다.
5. 새로운 질문을 생성한다.
6. 실제 행동으로 옮길 수 있는 실천 항목을 만든다.
7. 참여자의 고유한 관점을 지나치게 일반화하지 않는다.
8. 반드시 지정된 JSON 구조로만 응답한다.
```

### 사용자 프롬프트
```text
아래는 하나의 모임에서 작성된 참여자들의 기록이다.

모임 주제:
{{meetingTopic}}

기록:
{{notes}}

다음 항목을 분석하라.

- 전체 요약
- 핵심 주제
- 공통 의견
- 다른 의견
- 새롭게 생성할 질문
- 실천 항목
- 다음 모임 추천 주제

반드시 JSON 형식으로 반환하라.
```

---

## 17. 유사한 생각 연결 방식

### MVP 방식
1. 각 기록 저장
2. 기록 내용의 임베딩 생성
3. 같은 모임 안의 다른 기록과 cosine similarity 비교
4. 유사도 0.78 이상이면 관계 후보 생성
5. AI가 실제 연결 이유를 한 문장으로 생성
6. note_relations 테이블에 저장

### 관계 유형
- similar
- opposite
- expands
- question_answer
- cause_effect
- same_topic

---

## 18. 디자인 방향

### 전체 인상
- 차분함
- 지적임
- 신뢰감
- 기록과 연결이 잘 보이는 구조
- 불필요하게 화려하지 않음

### UI 원칙
- 모바일 우선
- 입력은 한 손으로 가능
- 모임 중 빠르게 기록 가능
- 생각 입력창은 항상 접근 가능
- 복잡한 기능보다 기록과 연결에 집중
- 그래프는 보기 쉬워야 하며 장식이 되어서는 안 됨

### 컬러 방향
- 기본 배경: 밝은 회색 또는 따뜻한 흰색
- 주요 텍스트: 짙은 회색
- 포인트 컬러: 한 가지
- 기록 유형별 색상 구분은 최소화

---

## 19. 수익 모델

### 무료
- 월 모임 3개
- 모임당 참여자 10명
- 기본 AI 요약
- 최근 모임 30일 보관

### Pro
- 모임 무제한
- 참여자 수 확대
- 장기 지식 보관
- 고급 지식 그래프
- 여러 모임 연결 분석
- PDF 또는 링크 공유
- 장기 패턴 리포트

### Team
- 조직 워크스페이스
- 관리자 권한
- 팀별 지식베이스
- 검색
- 외부 내보내기
- API 연동

초기 MVP에서는 결제 기능을 만들지 않는다.

---

## 20. 개발 순서

### 1단계
- Next.js 프로젝트 생성
- Supabase 연결
- 로그인 구현
- 기본 레이아웃 구현

### 2단계
- 모임 생성
- 초대 코드
- 모임 참여
- 참여자 목록

### 3단계
- 기록 작성
- 기록 유형
- 실시간 피드
- 수정 및 삭제

### 4단계
- AI 모임 요약
- 핵심 주제
- 공통 의견
- 다른 의견
- 질문
- 실천 항목

### 5단계
- 결과 리포트 화면
- 공유 링크
- 과거 모임 조회

### 6단계
- 임베딩 생성
- 유사 기록 연결
- 간단한 지식 그래프

### 7단계
- PWA
- 사용성 개선
- 오류 처리
- 보안 강화

---

## 21. MVP 완료 기준

다음 조건을 모두 만족하면 MVP가 완료된 것으로 본다.

- 사용자가 로그인할 수 있다.
- 모임을 만들 수 있다.
- 초대 링크로 다른 사람이 참여할 수 있다.
- 여러 명이 자신의 휴대폰에서 기록을 작성할 수 있다.
- 작성된 기록이 모임방에 표시된다.
- 모임 생성자가 AI 분석을 실행할 수 있다.
- AI가 핵심 주제, 공통 의견, 다른 의견, 질문, 실천 항목을 생성한다.
- 결과가 저장된다.
- 사용자가 과거 모임 결과를 다시 볼 수 있다.
- 모바일 화면에서 정상적으로 사용할 수 있다.

---

## 22. 토큰 비용 절감 원칙

AI 개발 도구에 매번 전체 프로젝트를 다시 설명하지 않는다.

### 가장 좋은 방식
1. 이 문서를 프로젝트 루트의 `PROJECT_SPEC.md`로 저장한다.
2. 개발 규칙은 `AGENTS.md` 또는 `DEVELOPMENT_RULES.md`로 분리한다.
3. DB 구조는 `DATABASE.md`로 분리한다.
4. AI 프롬프트는 `AI_PROMPTS.md`로 분리한다.
5. 한 번에 한 기능씩 요청한다.
6. 이미 만들어진 파일은 다시 생성하지 말고 수정만 요청한다.
7. 전체 코드를 매번 붙여 넣지 말고 파일 경로를 지정한다.
8. 오류가 난 파일과 관련 로그만 제공한다.
9. 긴 설명 대신 완료 조건을 명확히 적는다.
10. 동일한 요구사항을 반복하지 않는다.

### 토큰을 아끼는 요청 예시
```text
PROJECT_SPEC.md를 기준으로 MVP 2단계만 구현해라.

이번 작업 범위:
- 모임 생성
- 초대 코드 생성
- 초대 코드로 참여

수정 가능한 파일:
- src/app/meetings/*
- src/lib/supabase/*
- supabase/migrations/*

이번 작업에서 AI 분석, 그래프, 결제 기능은 만들지 마라.

완료 후 다음만 보고하라.
1. 수정된 파일 목록
2. 실행 방법
3. 남은 문제
```

### 피해야 할 요청
```text
앱 전체를 다시 분석하고 모든 코드를 새로 만들어줘.
```

이 방식은 기존 코드까지 다시 읽고 다시 생성하므로 토큰 사용량이 커진다.

---

## 23. 코드 제공 방식에 대한 원칙

외부에서 작성한 코드를 안티그래비티에 넣으면 생성 토큰은 줄어들 수 있다.

하지만 매우 긴 코드를 채팅창에 모두 붙여 넣으면 입력 토큰이 증가한다.

따라서 가장 효율적인 방식은 다음과 같다.

1. 기본 프로젝트 코드를 미리 생성한다.
2. 파일 형태로 프로젝트에 넣는다.
3. 안티그래비티에는 전체 코드를 다시 생성시키지 않는다.
4. 파일 경로와 수정 범위만 알려준다.
5. 한 번에 한 기능씩 구현한다.
6. 코드 리뷰나 오류 수정도 관련 파일만 대상으로 한다.

즉, 완성 코드가 이미 있으면 안티그래비티가 새로 생성하는 토큰은 줄어든다.

그러나 전체 코드를 매번 프롬프트에 붙여 넣으면 오히려 입력 토큰이 늘어날 수 있다.

가장 좋은 구조는:

```text
사람이 만든 기획 문서
+ 미리 준비된 기본 코드
+ 안티그래비티의 부분 수정
```

---

## 24. 안티그래비티 첫 실행 프롬프트

```text
이 프로젝트는 여러 사람의 생각을 모아 하나의 공동 지식으로 만드는 집단지성 앱이다.

프로젝트 루트의 PROJECT_SPEC.md를 먼저 읽고 전체 구조를 이해하라.

중요 원칙:
- 한 번에 전체 기능을 구현하지 마라.
- MVP 순서대로 개발하라.
- 기존 코드를 불필요하게 다시 작성하지 마라.
- TypeScript를 사용하라.
- 모바일 우선으로 개발하라.
- Supabase를 데이터베이스와 인증에 사용하라.
- AI 응답은 JSON structured output으로 처리하라.
- 모든 기능은 실제 실행 가능한 코드로 작성하라.
- 임시 목업 데이터보다 실제 DB 연결을 우선하라.
- 수정한 파일만 명확히 보고하라.

첫 작업:
1. Next.js 프로젝트 구조 점검
2. Supabase 연결
3. 로그인 화면
4. 대시보드 기본 레이아웃
5. 모임 목록을 표시할 빈 상태 화면

이번 작업에서는 다음을 구현하지 마라.
- AI 분석
- 지식 그래프
- 결제
- 음성 입력
- 알림

작업 완료 후 다음을 보고하라.
1. 생성 또는 수정된 파일
2. 환경변수
3. 실행 방법
4. 다음 단계
```

---

## 25. 최종 목표

이 앱의 최종 목표는 기록을 많이 저장하는 것이 아니다.

사람들의 생각을 연결하고,
반복되는 패턴을 발견하고,
서로 다른 관점을 보존하고,
모임에서 나온 지식을 실제 행동으로 바꾸는 것이다.

### 핵심 문장
**흩어진 생각을 연결해, 우리만의 지식으로 만듭니다.**

### 제품 정의
**개인의 생각이 모여 공동의 지식이 되는 집단지성 플랫폼**
