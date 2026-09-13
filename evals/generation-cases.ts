import type { z } from "zod";
import type { generationSchema } from "../src/lib/problem";

// Freeze topics and the rubric before making any model calls. Generated requirements
// are not treated as the oracle: they must also satisfy these original topic contracts.
export const generationCases: (Omit<z.infer<typeof generationSchema>, "requestId"> & {
  id: string;
})[] = [
  {
    id: "frontend-race",
    domain: "frontend",
    language: "tsx",
    difficulty: "중",
    kind: "debugging",
    topic:
      "React 19 상품 검색의 응답 역전 오류 수정. fetch가 늦게 끝나도 최신 검색만 표시하고, 공백 검색은 요청 없이 목록을 비우며, HTTP 오류와 unmount를 처리. API는 상품명 문자열 배열을 반환.",
  },
  {
    id: "backend-dedupe",
    domain: "backend",
    language: "python",
    difficulty: "하",
    kind: "implementation",
    topic:
      "Python 3.12 dedupe_emails(emails) 구현. ASCII 이메일 문자열을 strip 및 소문자로 비교해 중복 제거. 최초 원본 문자열과 순서 유지, 공백뿐인 항목 제외, 입력 목록 불변. 표준 라이브러리만 사용.",
  },
  {
    id: "game-movement",
    domain: "game",
    language: "csharp",
    difficulty: "하",
    kind: "debugging",
    topic:
      "Unity 6 기존 Input Manager의 3D 캐릭터 이동 오류 수정. 대각선 속도 제한, 프레임 독립 이동, 작은 아날로그 입력 유지. Rigidbody 없이 XZ 평면 transform 이동, speed는 음수가 아님.",
  },
  {
    id: "network-frames",
    domain: "network",
    language: "python",
    difficulty: "상",
    kind: "implementation",
    topic:
      "Python 3.12 TCP length-prefix 프레임 파서. 4바이트 big-endian 길이, 최대 1024바이트, 0길이 허용. feed(bytes)->list[bytes]는 분할/합쳐진 수신 처리. 초과 길이는 ValueError 후 명시적 reset 전 모든 feed 거절. 표준 라이브러리만 사용.",
  },
  {
    id: "database-report",
    domain: "database",
    language: "sql",
    difficulty: "중",
    kind: "refactoring",
    topic:
      "PostgreSQL 16 고객별 완료 주문 통계 쿼리 리팩터링. 고객(id PK,name), 주문(id PK,customer_id,status,amount numeric not null) 스키마 정의. 주문 없는 고객 포함, 완료 주문만 count/sum, 없으면 0, 고객 id 정렬. 기존 정답 쿼리의 중복 계산 줄이기.",
  },
  {
    id: "infra-config",
    domain: "infra",
    language: "python",
    difficulty: "상",
    kind: "refactoring",
    topic:
      "Python 3.12 설정 검증 리팩터링. parse_config(env:dict[str,str])->dict: PORT 정수1..65535 기본8080, WORKERS 정수1..32 기본4, DEBUG true/false 기본false. 앞뒤공백 제거. 오류 필드명 정렬해 단일 ValueError로 모두 보고. 입력 불변, 파일/환경변수 읽기 금지.",
  },
];

export const generationRubric = {
  solutionCorrectness:
    "정답이 원래 주제와 생성된 모든 요구사항을 만족하는가? 제어 흐름과 경계값을 검토한다.",
  exampleConsistency: "구체적인 입력/출력이 정답 및 계약과 일치하는가?",
  contractClarity: "런타임, 의존성, 자료형, 오류/경계값 정책이 모순 없이 명시되는가?",
  exerciseFit:
    "분야/언어/난이도/유형에 맞는가? refactoring 시작 코드는 동작하고 debugging에는 실제 결함이 있는가?",
  teachingQuality: "3단계 힌트가 정답을 그대로 노출하지 않고 설명이 원인과 경계값을 설명하는가?",
};
