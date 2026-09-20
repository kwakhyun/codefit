# AI 실무 학습

`/learn/ai`에서 AI 도구와 기술을 용도별로 찾고 학습한다. 홈, 서비스 원리 학습 화면, 공통 메뉴, 내 기록에서 진입할 수 있다.

## 콘텐츠 범위

2026-09-21에 확인한 공식 문서와 공식 저장소를 바탕으로 15개 분야, 32개 수업을 제공한다. 각 수업은 독립적으로 시작할 수 있다.

| 분야                | 주요 도구와 개념                                                           |
| ------------------- | -------------------------------------------------------------------------- |
| 프롬프트와 맥락     | 프롬프트, 토큰, 컨텍스트                                                   |
| 에이전트 워크플로우 | 도구 호출, MCP, A2A, CrewAI                                                |
| 에이전트 프레임워크 | LangChain, LangGraph, 체크포인트                                           |
| 문서 검색           | LlamaIndex, RAG, Chroma, Qdrant, pgvector, Sentence Transformers, Haystack |
| 업무 자동화         | n8n, Dify                                                                  |
| 로컬 AI             | Ollama, LM Studio, llama.cpp, GGUF, Open WebUI                             |
| 모델 선택과 연결    | Hugging Face, Transformers, LiteLLM                                        |
| 판단과 분류         | Jev, TypeSafe, 확신도                                                      |
| 평가와 실행 기록    | LangSmith, Langfuse, promptfoo, Ragas                                      |
| 코딩 도구           | Cursor, Claude Code, Aider, Continue                                       |
| 모델 운영           | vLLM, Ray Serve, 배치 처리, KV 캐시                                        |
| 미세 조정과 데이터  | LoRA, QLoRA, PEFT, TRL, Unsloth, DVC, MLflow                               |
| 이미지와 음성       | ComfyUI, Diffusers, Whisper, LiveKit, STT, TTS                             |
| 출력 검증           | Pydantic, Pydantic AI, JSON Schema, NeMo Guardrails                        |
| 데모 앱             | Gradio, Streamlit                                                          |

도구별 설명은 해당 수업의 공식 문서 링크로 추적할 수 있다. 제공자 간 성능 비교나 요금은 단정하지 않는다. 학습용 사례와 수치는 실제 모델의 실행 결과가 아니다.

## 학습 동작

- 카테고리, 입문/기초/응용 수준, 기술명 검색을 함께 적용한다. 랭체인, 랭그래프 등 한글 검색어를 지원한다.
- 개념 이해 → 선택하며 실습 → 확인 문제로 진행한다.
- 실습 선택에 따른 모의 결과를 확인해야 확인 문제로 이동할 수 있다.
- 확인 문제의 정답을 제출해야 완료 처리한다. 오답은 설명을 보고 다시 풀 수 있다.
- 이전 단계 복습, 다음 수업 이동, 전체 목록 복귀를 제공한다.
- 외부 AI API 호출, 도구 설치, 터미널 명령 실행은 하지 않는다. Ollama 명령어는 학습자가 자신의 환경에서 사용할 수 있는 예시다.
- 키보드로 선택지를 조작할 수 있고 단계 이동 시 제목으로 초점을 이동한다. 선택 결과는 라이브 영역으로 안내한다.

## 기록 보관

`codefit.ai-learning.v1` 로컬 저장소에 수업별 단계, 실습 선택, 완료 여부만 저장한다. 확인 문제의 제출 전 선택은 저장하지 않는다. 계정, 서버, 다른 기기와 동기화하지 않는다.

저장소를 읽거나 쓸 수 없으면 메모리에서 현재 탭의 학습을 계속하고 저장 실패를 안내한다. 형식이 잘못된 기록, 알 수 없는 수업 ID, 범위를 벗어난 단계와 선택은 복원하지 않는다. 다른 탭의 저장 변경을 반영하고 새 기록을 쓸 때 기존 수업 기록을 유지한다.

## 유지보수와 검증

- 카탈로그: `src/lib/ai-learning/catalog.ts`
- 수업 내용과 출처: `src/lib/ai-learning/content.ts`, `extended-content.ts`
- 저장과 검색: `src/lib/ai-learning/progress.ts`, `src/hooks/use-ai-learning-progress.ts`
- 단위 검증: `npx vitest run src/lib/ai-learning/ai-learning.test.ts`
- 브라우저 검증: `npx playwright test e2e/ai-learning.spec.ts --project=chromium`

브라우저 검증은 검색과 필터, 모든 수업의 선택 및 완료, 새로고침 후 이어보기, 모바일 화면 너비, 접근성, 저장소 차단과 잘못된 주소 복구를 포함한다. 실제 AI 도구의 설치나 외부 API 연동 결과는 이 검증 범위에 포함하지 않는다.
