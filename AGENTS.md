<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 검증 범위

새 기능과 변경으로 영향을 받는 기존 기능에 필요한 테스트만 실행한다. 전체 검증은 사용자가 별도로 요청한 경우에만 진행한다.

## 공개 저장소 콘텐츠

- 채용 지원 대상 회사명, 특정 회사나 개인을 대상으로 한 평가, 대회 출품·모의 심사·선정 예측 자료를 Git 추적 대상에 추가하지 않는다.
- 프로젝트의 우열, 시장성, 브랜드 추천, 포트폴리오 적합성, 배포 권고 등 주관적 평가 문서를 커밋하지 않는다. 개인 검토 자료는 저장소 밖이나 .gitignore로 제외한 로컬 경로에 보관한다.
- 기능 명세, 설계 근거, 재현 가능한 테스트와 측정 결과는 사실과 검증 범위를 명시해 보관한다. 실제 연동 제공자, 기술 의존성, 출처·라이선스에 필요한 명칭은 유지한다.
- 제외 요청은 파일 삭제가 아니다. 로컬 원본을 유지하고 이미 추적 중인 파일은 `git rm --cached`로 추적만 해제한다. 공개 문서의 링크와 실행 스크립트 등록도 확인한다. 다른 작업의 무관한 코드 변경은 커밋에 포함하지 않는다.
