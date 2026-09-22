# 문서 안내

현재 사용 방법은 [서비스 README](../README.md), 실행 방법은 [개발과 운영](development.md)을 기준으로 읽으세요. 날짜가 붙은 설계 변경, 측정값과 화면 캡처는 해당 시점의 기록이며 현재 배포의 검증 결과로 합산하지 않습니다.

## 기능과 화면

| 주제                                                | 문서                                                                                                                       |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 세 작업 공간, 메뉴 순서와 선택 보관                 | [사용자 타입에 따른 탐색](personalized-navigation.md)                                                                      |
| 작업 공간별 홈, 전용 이미지와 선택형 안내           | [화면별 이미지와 탐색 UI](design/experience-ui.md)                                                                         |
| 21개 입문 실습, 단계 조작과 학습 기록               | [서비스 원리 배우기](beginner-training.md)                                                                                 |
| 서비스 분야와 사례의 구성 이력                      | [서비스 분야별 실습](design/service-domain-curriculum.md)                                                                  |
| AI 코드 이해와 코칭                                 | [이해 훈련 코치](understanding-coach.md), [질문 대상 선택](coach-targeting.md)                                             |
| 원본·수정 코드의 실행 비교                          | [학습 실험](learning-experiments.md), [실험 후속 질문](experiment-followup.md), [실행 환경의 무결성](sandbox-integrity.md) |
| 공개 저장소 기반 훈련 생성, 진행 저장과 샘플 분리   | [내 프로젝트로 연습](project-practice.md)                                                                                  |
| 공개 링크 분석, 질문과 계정별 기록                  | [프로젝트 점검](project-check.md)                                                                                          |
| 전체 프로젝트 검색, 클래스 관리, 복습과 재분석 이력 | [내 프로젝트 관리](project-classes.md)                                                                                     |
| 기본 AI 수업, 모의 실습과 브라우저 진도             | [AI 실무 배우기](ai-learning.md)                                                                                           |
| 프로젝트 코드에 맞춘 AI 활용 학습과 적용 기록       | [프로젝트 AI 활용 학습](project-ai-workshop.md)                                                                            |
| 공개 Git 플랫폼별 연결 범위와 수집 방식             | [공개 소스 저장소 연결](public-repositories.md)                                                                            |
| 라이트·다크 테마, 이미지와 로딩 표시                | [화면 테마](themes.md), [공통 UI](ui-system.md)                                                                            |
| JS 실행 후 공개 본문과 스크린샷 수집                | [프로젝트 화면 수집](project-browser.md)                                                                                   |
| 답변의 인용 근거와 평가 계약                        | [프로젝트 답변 평가](project-assessment.md)                                                                                |
| 내 프로젝트 확인 과제, 보완 답변과 공통 실습        | [프로젝트 학습](project-learning.md)                                                                                       |
| 공개 보안 설정과 탭 임시 확인 기록                  | [보안 설정 점검](security-check.md)                                                                                        |
| 첫 미션 선택과 선택적 AI 안내                       | [핏 시작 가이드](design/fit-start-guide.md)                                                                                |

[AI 실무 배우기](ai-learning.md)는 15개 분야, 32개 수업의 모의 실습과 브라우저 진도 보관을 설명합니다.

공개 코드 읽기 추천과 서버 설정은 [Jev 코드 읽기 추천](jev-quality.md)를 참고하세요.

## 개발과 운영

| 목적                                          | 문서                                  |
| --------------------------------------------- | ------------------------------------- |
| 로컬 실행, 환경 변수, 검증 명령과 데이터 이관 | [개발과 운영](development.md)         |
| 인증, 저장, 실행과 AI 요청 구조               | [설계와 구현](engineering.md)         |
| Google/GitHub 설정, 계정 연결과 생성 한도     | [인증](authentication.md)             |
| JSON 백업의 포함 범위, 크기와 복원 정책       | [학습 기록 백업](workspace-backup.md) |
| 실행 시점, 대상, 통과 범위와 미검증 항목      | [검증 기록](VERIFICATION.md)          |

## 그림과 이전 UI 변경 기록

- [세 작업 공간 전용 이미지의 프롬프트와 경로](design/workspace-visuals.json)
- [공통 이미지의 프롬프트와 경로](design/experience-visuals.json)
- [실습 상황 그림](design/scenario-visuals.md), [로그인 제공자 아이콘](design/provider-icons.md)
- [가독성 조정 이력](ui-readability.md), [서비스 용어](design/service-copy.md), [2026-09-18 UI 검토](design/release-ui-review.md)

`artifacts/`, 개인 검토와 대회 관련 자료는 공개 문서의 필수 링크 대상으로 사용하지 않습니다. 문서에 적힌 로컬 산출물 경로는 재현 시 생성되는 파일이며 새 체크아웃에 들어 있지 않을 수 있습니다. 실제 연동 제공자와 고정 평가 사례는 기능 및 검증 범위를 설명하기 위해 명시합니다.
