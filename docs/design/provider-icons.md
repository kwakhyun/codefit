# 로그인 제공자 아이콘

2026-09-18 공식 배포 자료를 로컬 정적 자산으로 적용했다. Google은 최신 컬러 G, GitHub는 공식 흰색 Invertocat SVG 원본이다. 임의 제작한 G 문자와 GitBranch 아이콘을 대체한다. 색상과 비율을 변형하지 않으며 CODE:FIT 로고보다 보조적으로 표시한다.

- Google: https://developers.google.com/identity/branding-guidelines — 공식 https://developers.google.com/static/identity/images/g-logo.png
- GitHub: https://brand.github.com/foundations/logo — 공식 GitHub_Logos.zip의 `GitHub Logos/SVG/GitHub_Invertocat_White.svg`
- 자산: `public/brand/providers/`
- 공통 렌더링: `src/components/account/provider-icon.tsx`
- 적용: 로그인, 프로필 계정 연결, 홈/입문 목록/프로젝트 점검/문제 생성 창의 비회원 로그인 유도 영역

제공자명과 로그인 맥락을 함께 표기한다. Google 색상 로고는 흰색 배경에 배치하며 두 제공자를 같은 크기로 표현한다. 제휴나 보증을 의미하지 않는다. 일반 기술 카테고리는 회사와의 관계를 뜻하지 않으므로 기존 범용 아이콘을 유지한다.
