import type { Problem } from "../lib/problem";

type Seed = Omit<Problem, "createdAt" | "source">;
const seeds: Seed[] = [
  {
    id: "fe-search-race",
    domain: "frontend",
    language: "tsx",
    difficulty: "중",
    kind: "debugging",
    title: "검색 결과가 뒤바뀌는 버그 수정하기",
    summary: "늦게 도착한 응답이 최신 검색 결과를 덮어씁니다. 비동기 요청의 순서를 바로잡으세요.",
    scenario:
      "상품 검색창에서 ‘키보드’를 입력한 뒤 바로 ‘마우스’를 검색하면, 네트워크 상황에 따라 키보드 결과가 마지막에 표시됩니다. 아래 컴포넌트는 검색어가 바뀔 때마다 요청하지만 이전 요청을 관리하지 않습니다. React와 브라우저 표준 API만 사용해 수정하세요. API는 성공 시 문자열 배열을 반환합니다.",
    requirements: [
      "이전 검색 요청을 취소하거나 무시해 최신 검색어의 결과만 표시하세요.",
      "빈 검색어 또는 공백만 입력되면 요청하지 않고 결과와 오류를 초기화하세요.",
      "컴포넌트가 사라진 후에는 상태를 갱신하지 마세요.",
      "HTTP 오류와 네트워크 오류를 사용자에게 표시하고 요청 취소는 오류로 표시하지 마세요.",
    ],
    starterCode:
      'import { useEffect, useState } from "react";\n\nexport default function ProductSearch() {\n  const [query, setQuery] = useState("");\n  const [items, setItems] = useState<string[]>([]);\n\n  useEffect(() => {\n    fetch(`/api/products?q=${encodeURIComponent(query)}`)\n      .then((response) => response.json())\n      .then(setItems);\n  }, [query]);\n\n  return (\n    <section>\n      <input aria-label="상품 검색" value={query}\n        onChange={(event) => setQuery(event.target.value)} />\n      <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>\n    </section>\n  );\n}',
    hints: [
      "검색어가 바뀌면 이전 effect의 정리 함수가 먼저 호출됩니다. 그때 이전 요청을 어떻게 다룰 수 있을까요?",
      "AbortController의 signal을 fetch에 전달하고 정리 함수에서 abort()를 호출해 보세요. 이미 완료된 비동기 작업도 고려해야 합니다.",
      "effect마다 active 변수를 두고 정리 시 false로 바꾸면 상태 갱신을 보호할 수 있습니다. response.ok를 확인하고 AbortError는 오류 표시에서 제외하세요.",
    ],
    solution:
      'import { useEffect, useState } from "react";\n\nexport default function ProductSearch() {\n  const [query, setQuery] = useState("");\n  const [items, setItems] = useState<string[]>([]);\n  const [error, setError] = useState("");\n\n  useEffect(() => {\n    const term = query.trim();\n    const controller = new AbortController();\n    let active = true;\n    setError("");\n    setItems([]);\n    if (!term) return;\n\n    async function search() {\n      try {\n        const response = await fetch(`/api/products?q=${encodeURIComponent(term)}`, { signal: controller.signal });\n        if (!response.ok) throw new Error("검색에 실패했습니다.");\n        const result: string[] = await response.json();\n        if (active) setItems(result);\n      } catch (cause) {\n        if (active && !(cause instanceof Error && cause.name === "AbortError")) {\n          setError("검색에 실패했습니다. 다시 시도해 주세요.");\n        }\n      }\n    }\n    void search();\n    return () => { active = false; controller.abort(); };\n  }, [query]);\n\n  return (\n    <section>\n      <input aria-label="상품 검색" value={query} onChange={(e) => setQuery(e.target.value)} />\n      {error && <p role="alert">{error}</p>}\n      <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>\n    </section>\n  );\n}',
    explanation:
      "effect마다 요청의 수명을 관리합니다. AbortController는 불필요한 통신을 취소하고 active 플래그는 이미 진행된 응답 처리까지 막습니다. 취소는 정상적인 정리 과정이므로 실패 메시지와 구분합니다. 다른 올바른 동시성 제어 방식도 가능합니다.",
    examples: [
      {
        input: "키보드 → 마우스를 빠르게 입력",
        output: "마우스 검색 결과만 표시",
        note: "키보드 응답이 더 늦게 와도 결과가 뒤집히지 않습니다.",
      },
      {
        input: '검색어: "   "',
        output: "빈 목록, 오류 없음, 요청 없음",
        note: "이전 요청의 결과도 이후 표시되지 않아야 합니다.",
      },
    ],
    tags: ["React", "useEffect", "비동기", "AbortController"],
    minutes: 25,
  },
  {
    id: "be-pagination",
    domain: "backend",
    language: "python",
    difficulty: "하",
    kind: "implementation",
    title: "목록 API의 페이지네이션 구현하기",
    summary: "데이터를 페이지별로 나누고 잘못된 요청을 검증하는 함수를 만드세요.",
    scenario:
      "관리자 화면에서 전체 주문을 한 번에 불러와 응답이 느려졌습니다. Python 표준 라이브러리만 사용해 paginate(items, page, size)를 구현하세요. 입력 목록은 이미 원하는 순서로 정렬되어 있으며 page는 1부터 시작합니다.",
    requirements: [
      "page는 1 이상의 정수, size는 1~100의 정수인지 검증하고 아니면 ValueError를 발생시키세요. bool도 허용하지 마세요.",
      "data, total, page, total_pages를 가진 딕셔너리를 반환하세요.",
      "범위를 넘긴 페이지는 빈 data를 반환하고 입력 목록을 수정하지 마세요.",
    ],
    starterCode:
      "def paginate(items, page=1, size=20):\n    # 요청값을 검증하고 페이지 정보를 반환하세요.\n    pass\n",
    hints: [
      "슬라이싱 시작 위치는 페이지 번호와 페이지 크기로 계산할 수 있습니다.",
      "Python에서 bool은 int의 하위 타입입니다. type(value) is int로 구분할 수 있습니다.",
      "전체 페이지 수는 (total + size - 1) // size입니다. 빈 목록일 때는 0이 됩니다.",
    ],
    solution:
      'def paginate(items, page=1, size=20):\n    if type(page) is not int or page < 1:\n        raise ValueError("invalid page")\n    if type(size) is not int or not 1 <= size <= 100:\n        raise ValueError("invalid size")\n    total = len(items)\n    start = (page - 1) * size\n    return {"data": items[start:start + size], "total": total,\n            "page": page, "total_pages": (total + size - 1) // size}\n',
    explanation:
      "입력을 먼저 검증하면 나눗셈 오류와 음수 인덱스 동작을 피할 수 있습니다. 슬라이싱은 새 목록을 반환하며 범위 밖에서도 빈 목록을 안전하게 반환합니다.",
    examples: [
      {
        input: "paginate([1,2,3,4,5], 2, 2)",
        output: '{"data":[3,4],"total":5,"page":2,"total_pages":3}',
        note: "마지막 페이지에는 한 항목만 남습니다.",
      },
    ],
    tags: ["Python", "API", "입력 검증"],
    minutes: 15,
  },
  {
    id: "db-left-join",
    domain: "database",
    language: "sql",
    difficulty: "중",
    kind: "debugging",
    title: "주문이 없는 고객이 사라지는 쿼리 고치기",
    summary: "LEFT JOIN을 썼는데 일부 고객이 누락됩니다. 집계 쿼리의 조건 위치를 수정하세요.",
    scenario:
      "PostgreSQL의 customers(id, name)와 orders(id, customer_id, status, amount) 테이블이 있습니다. 모든 고객의 완료 주문 수와 합계를 조회해야 하는데, 완료 주문이 없는 고객이 누락됩니다. amount는 NULL이 아닌 numeric이며 고객 ID는 고유합니다.",
    requirements: [
      "완료 주문이 없는 고객도 결과에 포함하세요.",
      "status = 'completed'인 주문만 세고 합산하세요.",
      "주문 수와 합계의 빈 값은 0으로 표시하고 고객 ID 오름차순으로 정렬하세요.",
    ],
    starterCode:
      "SELECT c.id, c.name, COUNT(*) AS order_count, SUM(o.amount) AS total\nFROM customers c\nLEFT JOIN orders o ON o.customer_id = c.id\nWHERE o.status = 'completed'\nGROUP BY c.id, c.name;",
    hints: [
      "LEFT JOIN 이후 WHERE에서 오른쪽 테이블의 값을 검사하면 NULL로 채워진 행은 어떻게 될까요?",
      "완료 상태 조건을 JOIN의 ON 절로 옮기세요. COUNT(*)와 COUNT(o.id)의 차이도 확인하세요.",
      "SUM의 NULL은 COALESCE로 0으로 바꿀 수 있습니다. 결과 순서는 ORDER BY로 명시하세요.",
    ],
    solution:
      "SELECT c.id, c.name, COUNT(o.id) AS order_count,\n       COALESCE(SUM(o.amount), 0) AS total\nFROM customers c\nLEFT JOIN orders o\n  ON o.customer_id = c.id AND o.status = 'completed'\nGROUP BY c.id, c.name\nORDER BY c.id;",
    explanation:
      "ON 절의 조건은 결합할 주문만 제한하므로 고객은 유지됩니다. COUNT(o.id)는 NULL을 제외해 주문이 없는 고객을 0으로 계산합니다. SUM은 대상이 없으면 NULL이므로 COALESCE가 필요합니다.",
    examples: [
      {
        input: "고객 1: completed 100, pending 50 / 고객 2: 주문 없음",
        output: "1: order_count=1, total=100 / 2: order_count=0, total=0",
        note: "완료 주문만 집계하면서 고객 두 명 모두 보존합니다.",
      },
    ],
    tags: ["PostgreSQL", "JOIN", "집계"],
    minutes: 20,
  },
  {
    id: "game-movement",
    domain: "game",
    language: "csharp",
    difficulty: "하",
    kind: "debugging",
    title: "프레임마다 달라지는 캐릭터 이동 속도",
    summary: "고주사율 화면에서 캐릭터가 더 빨라집니다. Unity 이동 로직을 수정하세요.",
    scenario:
      "Unity 프로젝트가 기존 Input Manager를 사용합니다. transform으로 이동하는 캐릭터가 144 FPS 환경에서 더 빠르게 움직이고 대각선 이동도 빠릅니다. 충돌 처리는 이 문제의 범위가 아닙니다.",
    requirements: [
      "이동량을 경과 시간에 비례하게 만들어 FPS와 무관한 초당 속도를 유지하세요.",
      "대각선 방향의 입력 벡터 길이를 최대 1로 제한하세요.",
      "아날로그 입력의 크기가 1보다 작으면 그 크기를 유지하고 입력이 0이면 움직이지 마세요.",
    ],
    starterCode:
      'using UnityEngine;\n\npublic class PlayerMovement : MonoBehaviour\n{\n    public float speed = 5f;\n    void Update()\n    {\n        var direction = new Vector3(Input.GetAxis("Horizontal"), 0f, Input.GetAxis("Vertical"));\n        transform.position += direction * speed;\n    }\n}',
    hints: [
      "초당 이동 속도에 현재 프레임에서 경과한 시간을 곱해 보세요.",
      "입력을 무조건 normalized로 바꾸면 작은 아날로그 입력까지 최대 속도가 됩니다.",
      "Vector3.ClampMagnitude(direction, 1f)와 Time.deltaTime을 함께 사용해 보세요.",
    ],
    solution:
      'using UnityEngine;\n\npublic class PlayerMovement : MonoBehaviour\n{\n    public float speed = 5f;\n    void Update()\n    {\n        var direction = new Vector3(Input.GetAxis("Horizontal"), 0f, Input.GetAxis("Vertical"));\n        direction = Vector3.ClampMagnitude(direction, 1f);\n        transform.position += direction * speed * Time.deltaTime;\n    }\n}',
    explanation:
      "deltaTime을 곱하면 프레임 수가 아닌 경과 시간에 따라 이동합니다. ClampMagnitude는 길이가 1을 초과할 때만 줄이므로 아날로그 입력의 작은 값도 유지합니다.",
    examples: [
      {
        input: "speed=5, 입력 (1,0,1), 1초 경과",
        output: "총 이동 거리 약 5",
        note: "30 FPS와 144 FPS에서 같은 거리를 이동해야 합니다.",
      },
    ],
    tags: ["Unity", "C#", "벡터"],
    minutes: 15,
  },
  {
    id: "infra-docker",
    domain: "infra",
    language: "dockerfile",
    difficulty: "중",
    kind: "refactoring",
    title: "무겁고 권한이 큰 Docker 이미지 개선하기",
    summary: "빌드 도구가 포함된 이미지를 다단계 빌드와 일반 사용자 실행으로 개선하세요.",
    scenario:
      "Node.js 서비스는 npm run build로 dist/server.js를 생성합니다. package-lock.json이 존재하고 실행에 필요한 모듈은 dependencies에 있습니다. src, package.json, lock 파일만 필요하며 별도 네이티브 OS 의존성은 없습니다. 아래 Dockerfile을 Node 22 Alpine 기반으로 개선하세요.",
    requirements: [
      "빌드 단계와 실행 단계를 분리하고 런타임 이미지에 src 및 빌드 전용 모듈을 포함하지 마세요.",
      "npm ci와 잠금 파일을 사용해 의존성을 설치하고 실행 단계에는 프로덕션 의존성만 포함하세요.",
      "루트가 아닌 사용자로 dist/server.js를 실행하고 NODE_ENV=production을 설정하세요.",
    ],
    starterCode:
      'FROM node:22-alpine\nWORKDIR /app\nCOPY . .\nRUN npm install\nRUN npm run build\nCMD ["node", "dist/server.js"]',
    hints: [
      "AS build로 빌드 단계를 이름 붙이고 두 번째 FROM에서 필요한 결과물만 가져오세요.",
      "package.json과 잠금 파일을 먼저 복사하면 소스 변경 시 의존성 설치 캐시를 활용할 수 있습니다.",
      "실행 단계에서는 npm ci --omit=dev와 USER node를 사용하고 dist만 복사하세요.",
    ],
    solution:
      'FROM node:22-alpine AS build\nWORKDIR /app\nCOPY package.json package-lock.json ./\nRUN npm ci\nCOPY src ./src\n# 프로젝트 빌드 설정 파일이 있다면 별도로 복사합니다.\nRUN npm run build\n\nFROM node:22-alpine AS runtime\nWORKDIR /app\nENV NODE_ENV=production\nCOPY package.json package-lock.json ./\nRUN npm ci --omit=dev && npm cache clean --force\nCOPY --from=build --chown=node:node /app/dist ./dist\nUSER node\nCMD ["node", "dist/server.js"]',
    explanation:
      "단계를 분리하면 빌드 도구와 원본 소스가 실행 이미지에 남지 않습니다. 명시적인 파일 복사로 불필요한 파일을 배제하고 node 사용자로 프로세스 권한을 줄입니다. 실제 프로젝트에 빌드 설정 파일이 있으면 빌드 단계에 추가해야 합니다.",
    examples: [
      {
        input: "컨테이너 시작",
        output: "node 사용자가 dist/server.js 실행",
        note: "실행 이미지의 node_modules에는 devDependencies가 없어야 합니다.",
      },
    ],
    tags: ["Docker", "다단계 빌드", "권한"],
    minutes: 25,
  },
  {
    id: "net-framing",
    domain: "network",
    language: "python",
    difficulty: "상",
    kind: "implementation",
    title: "잘려서 도착하는 TCP 메시지 복원하기",
    summary: "TCP의 바이트 스트림에서 길이 헤더를 읽고 완전한 메시지를 복원하세요.",
    scenario:
      "메시지는 4바이트 big-endian unsigned 길이 헤더와 본문으로 전송됩니다. socket.recv는 요청한 바이트보다 적게 반환할 수 있습니다. 블로킹 소켓이 주어지며 읽기 중 EOF는 recv가 b''를 반환합니다. 본문 최대 크기는 1 MiB입니다. socket.timeout 등 다른 예외는 그대로 전달하세요.",
    requirements: [
      "헤더와 본문 각각 필요한 바이트를 모두 읽을 때까지 반복하세요.",
      "필요한 데이터가 남아 있는데 EOF가 오면 EOFError를 발생시키세요.",
      "길이가 1 MiB를 넘으면 본문을 읽기 전에 ValueError를 발생시키고 길이가 0이면 b''를 반환하세요.",
    ],
    starterCode:
      "import struct\n\ndef read_exact(sock, size):\n    # 정확히 size 바이트를 읽으세요.\n    pass\n\ndef read_message(sock):\n    # 길이 헤더를 검증한 뒤 본문을 읽으세요.\n    pass\n",
    hints: [
      "TCP에는 애플리케이션 메시지 경계가 없습니다. 한 번의 recv 호출이 한 메시지라는 가정을 버리세요.",
      "아직 필요한 바이트 수만 recv에 요청하고 받은 조각을 누적하세요.",
      "struct.unpack('!I', header)[0]으로 헤더를 해석하고 최대 길이를 먼저 검사하세요.",
    ],
    solution:
      'import struct\n\ndef read_exact(sock, size):\n    result = bytearray()\n    while len(result) < size:\n        chunk = sock.recv(size - len(result))\n        if not chunk:\n            raise EOFError("incomplete message")\n        result.extend(chunk)\n    return bytes(result)\n\ndef read_message(sock):\n    size = struct.unpack("!I", read_exact(sock, 4))[0]\n    if size > 1024 * 1024:\n        raise ValueError("message too large")\n    return read_exact(sock, size)\n',
    explanation:
      "정확한 길이를 읽는 함수를 분리하면 헤더와 본문 모두 같은 처리 방식을 사용합니다. 길이 제한을 메모리 할당과 본문 읽기보다 먼저 검사해 큰 입력으로 인한 자원 소모를 줄입니다.",
    examples: [
      {
        input: "헤더: 00 00 00 05 / 수신 조각: he, l, lo",
        output: "b'hello'",
        note: "TCP 조각의 크기에 상관없이 동일한 본문을 반환합니다.",
      },
    ],
    tags: ["TCP", "소켓", "바이트 스트림"],
    minutes: 35,
  },
  {
    id: "mobile-state",
    domain: "mobile",
    language: "kotlin",
    difficulty: "중",
    kind: "refactoring",
    title: "흩어진 화면 상태를 하나의 타입으로",
    summary: "로딩과 오류가 동시에 표시되는 문제를 sealed interface로 해결하세요.",
    scenario:
      "Kotlin 앱의 상품 화면이 isLoading, error, products 세 변수로 상태를 관리합니다. 모순된 조합을 없애도록 UI와 독립적인 상태 타입과 순수 전이 함수 reduce(state, event)를 작성하세요. 외부 프레임워크는 필요하지 않습니다.",
    requirements: [
      "초기, 로딩, 성공, 실패를 sealed interface의 서로 배타적인 상태로 표현하세요.",
      "성공 상태는 상품 목록을, 실패 상태는 오류 메시지를 포함하게 하세요.",
      "Load, Loaded, Failed 이벤트를 정의하고 reduce가 각 이벤트에 맞는 새 상태를 반환하게 하세요.",
    ],
    starterCode:
      "data class Product(val id: String, val name: String)\n\n// 아래 세 변수 대신 상태와 이벤트를 설계하세요.\nvar isLoading = false\nvar error: String? = null\nvar products: List<Product> = emptyList()\n",
    hints: [
      "불리언 3개는 많은 조합을 만듭니다. 한 번에 하나의 상태만 존재하도록 표현해 보세요.",
      "sealed interface UiState 아래에 data object와 data class를 둘 수 있습니다.",
      "Event도 sealed interface로 정의하면 when 표현식의 모든 경우를 컴파일러가 검사할 수 있습니다.",
    ],
    solution:
      'data class Product(val id: String, val name: String)\n\nsealed interface UiState {\n    data object Idle : UiState\n    data object Loading : UiState\n    data class Success(val products: List<Product>) : UiState\n    data class Error(val message: String) : UiState\n}\nsealed interface Event {\n    data object Load : Event\n    data class Loaded(val products: List<Product>) : Event\n    data class Failed(val message: String) : Event\n}\n@Suppress("UNUSED_PARAMETER")\nfun reduce(state: UiState, event: Event): UiState = when (event) {\n    Event.Load -> UiState.Loading\n    is Event.Loaded -> UiState.Success(event.products)\n    is Event.Failed -> UiState.Error(event.message)\n}\n',
    explanation:
      "상태를 하나의 합 타입으로 묶으면 로딩과 성공 같은 모순된 조합을 만들 수 없습니다. 순수 함수 전이는 UI 없이도 검증할 수 있습니다. 실제 비동기 요청의 순서 관리는 별도로 처리해야 합니다.",
    examples: [
      {
        input: 'reduce(UiState.Loading, Event.Failed("연결 실패"))',
        output: 'UiState.Error("연결 실패")',
        note: "이 시점에 로딩 상태가 동시에 존재할 수 없습니다.",
      },
    ],
    tags: ["Kotlin", "상태 모델링", "sealed interface"],
    minutes: 25,
  },
  {
    id: "data-leakage",
    domain: "data",
    language: "python",
    difficulty: "중",
    kind: "debugging",
    title: "전처리에 숨어 있는 데이터 누수 찾기",
    summary: "검증 데이터까지 학습한 스케일러를 훈련 데이터만 사용하도록 고치세요.",
    scenario:
      "이미 분리된 훈련 행렬과 검증 행렬을 표준화하려고 합니다. 외부 라이브러리 없이 각 열의 평균과 모집단 표준편차를 계산하세요. 훈련 행렬은 비어 있지 않은 동일 너비의 유한 실수 행으로 구성됩니다. 검증 행렬은 비어 있을 수 있으며 같은 너비입니다.",
    requirements: [
      "평균과 표준편차를 훈련 데이터에서만 계산하세요.",
      "동일한 훈련 통계로 훈련 데이터와 검증 데이터를 변환해 두 행렬을 반환하세요.",
      "표준편차가 0인 열은 나눗셈 분모로 1을 사용하고 원본 데이터를 수정하지 마세요.",
    ],
    starterCode:
      "def standardize(train, valid):\n    all_rows = train + valid  # 검증 데이터가 통계에 섞입니다.\n    means = [sum(col) / len(col) for col in zip(*all_rows)]\n    return [[x - m for x, m in zip(row, means)] for row in train], valid\n",
    hints: [
      "검증 데이터는 미래에 처음 보는 데이터라고 생각하세요. 통계 계산에 참여할 수 있을까요?",
      "열 단위로 평균을 계산한 뒤 제곱 편차의 평균에 제곱근을 적용하세요.",
      "훈련 통계와 변환 함수를 분리해 두 데이터셋에 같은 변환을 적용하세요.",
    ],
    solution:
      "from math import sqrt\n\ndef standardize(train, valid):\n    columns = list(zip(*train))\n    means = [sum(col) / len(col) for col in columns]\n    scales = [sqrt(sum((x - mean) ** 2 for x in col) / len(col)) or 1\n              for col, mean in zip(columns, means)]\n    def transform(rows):\n        return [[(x - mean) / scale for x, mean, scale in zip(row, means, scales)]\n                for row in rows]\n    return transform(train), transform(valid)\n",
    explanation:
      "검증 데이터를 전처리 통계에서 제외해야 모델 평가에 미래 데이터의 정보가 섞이지 않습니다. 값이 모두 같은 열은 분모를 1로 대체해 0으로 나누는 오류를 피합니다.",
    examples: [
      {
        input: "train=[[1,5],[3,5]], valid=[[5,5]]",
        output: "([[-1,0],[1,0]], [[3,0]])",
        note: "첫 열 평균 2, 표준편차 1은 훈련 데이터에서만 계산합니다.",
      },
    ],
    tags: ["전처리", "데이터 누수", "Python"],
    minutes: 25,
  },
  {
    id: "security-redirect",
    domain: "security",
    language: "javascript",
    difficulty: "중",
    kind: "implementation",
    title: "외부 사이트로 새는 로그인 리다이렉트 막기",
    summary: "돌아갈 주소를 검증해 오픈 리다이렉트 취약점을 방지하세요.",
    scenario:
      "로그인 후 next 파라미터의 경로로 이동하는 서비스입니다. 허용 origin은 https://app.example.com으로 고정됩니다. 입력이 문자열이 아니거나 주소가 잘못됐으면 '/'를 반환하고, 같은 origin의 URL만 pathname+search+hash 형태로 반환하는 safeRedirect를 작성하세요.",
    requirements: [
      "URL 표준 파서를 사용해 상대 주소와 절대 주소를 처리하세요.",
      "origin이 고정된 서비스 origin과 다르거나 사용자명 또는 비밀번호가 있는 URL은 '/'로 대체하세요.",
      "정상 주소는 경로, 쿼리와 해시를 보존하고 파싱 실패나 문자열 외 입력은 '/'를 반환하세요.",
    ],
    starterCode:
      'function safeRedirect(next) {\n  // 입력 URL을 검증하고 안전한 내부 경로를 반환하세요.\n  return next || "/";\n}\n',
    hints: [
      "startsWith('/')만으로 검사하면 //외부도메인 같은 입력이 통과할 수 있습니다.",
      "new URL(next, 고정된_origin)으로 파싱한 뒤 .origin을 정확히 비교하세요.",
      "username과 password도 확인하고 try/catch로 잘못된 주소를 처리하세요.",
    ],
    solution:
      'function safeRedirect(next) {\n  if (typeof next !== "string") return "/";\n  try {\n    const url = new URL(next, "https://app.example.com");\n    if (url.origin !== "https://app.example.com" || url.username || url.password) return "/";\n    return url.pathname + url.search + url.hash;\n  } catch {\n    return "/";\n  }\n}',
    explanation:
      "URL 파서가 백슬래시나 프로토콜 상대 주소를 해석한 결과에 대해 origin을 비교합니다. 부분 문자열이나 접두사 검사보다 허용 범위를 정확하게 제한할 수 있습니다.",
    examples: [
      {
        input: 'safeRedirect("//outside.example/path")',
        output: '"/"',
        note: "프로토콜 상대 주소로 외부 사이트에 이동하는 요청을 막습니다.",
      },
      {
        input: 'safeRedirect("/orders?page=2#latest")',
        output: '"/orders?page=2#latest"',
        note: "내부 경로의 쿼리와 해시는 유지합니다.",
      },
    ],
    tags: ["URL", "입력 검증", "리다이렉트"],
    minutes: 20,
  },
  {
    id: "sys-lru",
    domain: "systems",
    language: "typescript",
    difficulty: "상",
    kind: "implementation",
    title: "가장 오래 쓰지 않은 항목을 지우는 LRU 캐시",
    summary: "고정 용량 캐시에 조회 순서를 반영하고 오래된 항목을 제거하세요.",
    scenario:
      "TypeScript의 Map이 삽입 순서를 유지한다는 성질을 이용해 문자열 키, 숫자 값의 LRUCache를 구현하세요. capacity는 양의 정수여야 합니다. get과 put은 항목 수에 비례하는 순회를 하지 않아야 합니다. Map의 기본 연산 비용은 엔진에 따릅니다.",
    requirements: [
      "유효하지 않은 capacity는 RangeError로 거부하고 get은 없는 키에 undefined를 반환하세요.",
      "get과 put으로 접근한 키를 가장 최근 사용한 위치로 이동하세요.",
      "용량을 넘기면 가장 오래 사용하지 않은 키를 삭제하고 기존 키를 갱신할 때는 불필요한 삭제가 없도록 하세요.",
    ],
    starterCode:
      "class LRUCache {\n  private items = new Map<string, number>();\n  constructor(private capacity: number) {}\n\n  get(key: string): number | undefined {\n    return this.items.get(key);\n  }\n\n  put(key: string, value: number): void {\n    this.items.set(key, value);\n  }\n}\n",
    hints: [
      "Map에서 기존 키에 set만 호출하면 삽입 순서가 바뀌지 않습니다.",
      "최근 사용한 키를 delete한 뒤 set하면 마지막 위치로 이동합니다.",
      "초과 시 items.keys().next().value로 가장 앞의 키를 얻으세요. 값이 0이어도 존재하는 키입니다.",
    ],
    solution:
      'class LRUCache {\n  private items = new Map<string, number>();\n  constructor(private capacity: number) {\n    if (!Number.isInteger(capacity) || capacity < 1) throw new RangeError("capacity");\n  }\n  get(key: string): number | undefined {\n    if (!this.items.has(key)) return undefined;\n    const value = this.items.get(key)!;\n    this.items.delete(key);\n    this.items.set(key, value);\n    return value;\n  }\n  put(key: string, value: number): void {\n    this.items.delete(key);\n    this.items.set(key, value);\n    if (this.items.size > this.capacity) {\n      const oldest = this.items.keys().next().value;\n      if (oldest !== undefined) this.items.delete(oldest);\n    }\n  }\n}\n',
    explanation:
      "삽입 순서를 최근 접근 순서로 유지하면 첫 키가 제거 대상이 됩니다. get에서도 삭제 후 재삽입이 필요하며, has로 존재 여부를 검사하면 값이 0인 항목도 정상 처리합니다.",
    examples: [
      {
        input: 'capacity=2; put("a",0); put("b",2); get("a"); put("c",3); get("b")',
        output: "undefined",
        note: "a를 조회했으므로 b가 가장 오래된 항목입니다.",
      },
    ],
    tags: ["자료구조", "Map", "캐시"],
    minutes: 40,
  },
  {
    id: "fe-cart",
    domain: "frontend",
    language: "typescript",
    difficulty: "하",
    kind: "refactoring",
    title: "원본을 바꾸는 장바구니 함수 리팩터링",
    summary: "상태를 직접 수정하는 함수를 예측 가능한 순수 함수로 바꾸세요.",
    scenario:
      "장바구니 상태를 여러 컴포넌트에서 공유합니다. 아래 함수가 원본 객체를 수정해 변경 감지가 어긋납니다. ID는 고유하며 수량은 1 이상인 장바구니가 주어집니다. 지정한 ID의 수량을 바꾸는 updateQuantity를 작성하세요.",
    requirements: [
      "입력 배열과 내부 객체를 수정하지 않고 새 배열을 반환하세요.",
      "대상 ID의 수량을 갱신하고 0 이하이면 항목을 제거하세요.",
      "대상 외 항목의 객체 참조는 유지하고 존재하지 않는 ID는 기존 내용이 유지된 새 배열을 반환하세요.",
    ],
    starterCode:
      "type Item = { id: string; quantity: number };\n\nfunction updateQuantity(items: Item[], id: string, quantity: number): Item[] {\n  const item = items.find((item) => item.id === id);\n  if (item) item.quantity = quantity;\n  return items;\n}",
    hints: [
      "배열을 복사해도 내부 객체를 수정하면 기존 상태가 바뀝니다.",
      "삭제는 filter, 변경은 map으로 나눌 수 있습니다.",
      "대상 항목만 스프레드로 새 객체를 만들고 나머지 항목은 그대로 반환하세요.",
    ],
    solution:
      "type Item = { id: string; quantity: number };\n\nfunction updateQuantity(items: Item[], id: string, quantity: number): Item[] {\n  if (quantity <= 0) return items.filter((item) => item.id !== id);\n  return items.map((item) => item.id === id ? { ...item, quantity } : item);\n}",
    explanation:
      "새 배열과 수정된 항목의 새 객체를 만들되 다른 항목의 참조는 보존합니다. 이렇게 하면 원본 상태를 유지하면서 변경된 항목을 참조 비교로 구분할 수 있습니다.",
    examples: [
      {
        input: 'items=[{id:"a",quantity:2}], id="a", quantity=0',
        output: "[]",
        note: "원본 items에는 여전히 수량 2인 항목이 남아 있습니다.",
      },
    ],
    tags: ["불변성", "TypeScript", "상태 관리"],
    minutes: 15,
  },
  {
    id: "be-go-cancel",
    domain: "backend",
    language: "go",
    difficulty: "상",
    kind: "debugging",
    title: "요청이 끝나도 남아 있는 고루틴 정리하기",
    summary: "취소 신호를 전달하고 채널 송신에서 멈추는 고루틴을 수정하세요.",
    scenario:
      "Go 서비스의 스트림 생성기가 소비자가 떠난 뒤에도 채널 송신에서 대기합니다. count(ctx, n)은 0부터 n-1까지 순서대로 보내야 하며 n은 0 이상의 정수입니다. 함수가 반환한 채널은 읽기 전용입니다.",
    requirements: [
      "채널 송신과 context 취소를 select로 함께 처리하세요.",
      "취소되거나 모든 값을 보냈을 때 고루틴을 종료하고 생산자가 채널을 닫으세요.",
      "취소가 없으면 0부터 n-1까지 순서를 보존하고 n=0일 때도 채널을 닫으세요.",
    ],
    starterCode:
      'package stream\n\nimport "context"\n\nfunc count(ctx context.Context, n int) <-chan int {\n    out := make(chan int)\n    go func() {\n        for i := 0; i < n; i++ {\n            out <- i\n        }\n    }()\n    return out\n}\n',
    hints: [
      "소비자가 더 읽지 않으면 버퍼 없는 채널의 송신은 계속 기다립니다.",
      "select 안에 out <- i와 <-ctx.Done() 두 경우를 두세요.",
      "고루틴 시작 부분에 defer close(out)를 넣으면 정상 종료와 취소 모두에서 채널이 닫힙니다.",
    ],
    solution:
      'package stream\n\nimport "context"\n\nfunc count(ctx context.Context, n int) <-chan int {\n    out := make(chan int)\n    go func() {\n        defer close(out)\n        for i := 0; i < n; i++ {\n            select {\n            case <-ctx.Done():\n                return\n            case out <- i:\n            }\n        }\n    }()\n    return out\n}\n',
    explanation:
      "송신을 select에 넣으면 소비자가 없어도 취소를 받을 수 있습니다. defer로 채널 소유자인 생산자가 종료 시 채널을 닫습니다. 취소와 송신이 동시에 준비되면 둘 중 하나가 선택될 수 있다는 Go select의 성질도 이해해야 합니다.",
    examples: [
      {
        input: "count(ctx, 3), 취소 없음",
        output: "0, 1, 2 수신 후 채널 닫힘",
        note: "소비자가 떠나 ctx를 취소하면 송신 대기도 종료됩니다.",
      },
    ],
    tags: ["Go", "고루틴", "context"],
    minutes: 35,
  },
];
export const seedProblems: Problem[] = seeds.map((p, index) => ({
  ...p,
  source: "curated",
  createdAt: new Date(Date.UTC(2026, 8, 1, 0, index)).toISOString(),
}));
