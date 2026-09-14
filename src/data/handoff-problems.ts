import type { Problem } from "../lib/problem";
import { HANDOFF_TRACKS, handoffId } from "../lib/handoff/catalog";

type Case = { expression: string; expected: unknown; note: string };
type Spec = {
  contract: string;
  core: string;
  extension: string;
  starter: string;
  alternateStarter: string;
  solution: string;
  diagnosis: string;
  cases: Case[];
  kind?: Problem["kind"];
};

/** These are trusted fixtures executed ONLY by developer tests, never submitted code. */
export const handoffSpecs: Record<string, Spec> = {
  latest: {
    contract:
      "createLatest(load, publish)는 { run(query), dispose() }를 반환합니다. load는 Promise를 반환합니다. run은 성공 시 undefined로 완료되고 load 실패는 호출자에게 거절됩니다. query는 문자열이며 publish는 예외를 던지지 않습니다.",
    core: "run 호출 순서를 기준으로 최신 요청의 결과만 publish한다. 이전 요청이 늦게 완료되어도 화면을 덮지 않는다.",
    extension:
      "dispose 이후에는 진행 중 응답을 publish하지 않으며 새 run은 load를 호출하지 않는다.",
    starter:
      "function createLatest(load, publish) {\n  return {\n    async run(query) { publish(await load(query)); },\n    dispose() {}\n  };\n}",
    alternateStarter:
      "function createLatest(load, publish) {\n  let current;\n  return {\n    async run(query) {\n      current = query;\n      const value = await load(query);\n      if (current === query) publish(value);\n    },\n    dispose() {}\n  };\n}",
    solution:
      "function createLatest(load, publish) {\n  let revision = 0;\n  let disposed = false;\n  return {\n    async run(query) {\n      if (disposed) return;\n      const mine = ++revision;\n      const value = await load(query);\n      if (!disposed && mine === revision) publish(value);\n    },\n    dispose() { disposed = true; revision++; }\n  };\n}",
    diagnosis:
      "완료 순서는 호출 순서와 다릅니다. 검색어 비교만으로는 동일 검색어의 연속 호출을 구분할 수 없습니다. 호출마다 증가하는 번호와 dispose 상태로 결과 반영을 제한합니다. 이전 네트워크 요청 자체를 취소하지는 않습니다.",
    cases: [
      {
        expression:
          "(async () => { const pending = []; const out = []; const c = createLatest(() => new Promise(r => pending.push(r)), v => out.push(v)); const a = c.run('same'), b = c.run('same'); pending[1]('new'); await b; pending[0]('old'); await a; return out; })()",
        expected: ["new"],
        note: "같은 검색어여도 마지막 호출의 결과만 반영합니다.",
      },
      {
        expression:
          "(async () => { let resolve; let calls = 0; const out = []; const c = createLatest(() => { calls++; return new Promise(r => resolve = r); }, v => out.push(v)); const pending = c.run('x'); c.dispose(); resolve('late'); await pending; await c.run('y'); return { out, calls }; })()",
        expected: { out: [], calls: 1 },
        note: "해제 뒤의 요청과 응답을 모두 차단합니다.",
      },
      {
        expression:
          "(async () => { const out = []; const c = createLatest(async () => { throw Error('load failed'); }, v => out.push(v)); try { await c.run('x'); } catch (e) { return [e.message, out.length]; } })()",
        expected: ["load failed", 0],
        note: "실패는 호출자에게 전달합니다.",
      },
    ],
  },
  cart: {
    contract:
      "changeQuantity(items, id, delta)는 새 배열을 반환합니다. items는 고유한 문자열 id와 0 이상의 정수 quantity를 가진 객체 배열입니다. delta는 정수이며 합계는 안전한 정수 범위입니다. 항목의 다른 필드는 보존합니다.",
    core: "일치하는 항목의 수량만 delta만큼 바꾸되 입력 배열과 객체는 변경하지 않는다. 새 수량은 0보다 작지 않다.",
    extension: "새 수량이 0인 대상 항목은 제거한다. 존재하지 않는 id는 내용 변경 없이 반환한다.",
    starter:
      "function changeQuantity(items, id, delta) {\n  const item = items.find(item => item.id === id);\n  if (item) item.quantity += delta;\n  return items;\n}",
    alternateStarter:
      "function changeQuantity(items, id, delta) {\n  const next = [...items];\n  const item = next.find(item => item.id === id);\n  if (item) item.quantity = Math.max(0, item.quantity + delta);\n  return next;\n}",
    solution:
      "function changeQuantity(items, id, delta) {\n  return items.flatMap(item => {\n    if (item.id !== id) return [item];\n    const quantity = Math.max(0, item.quantity + delta);\n    return quantity === 0 ? [] : [{ ...item, quantity }];\n  });\n}",
    diagnosis:
      "배열만 복사해도 내부 객체는 공유됩니다. 수정 대상 객체를 복사하고 수량이 0이면 제거합니다. 바뀌지 않은 항목의 참조는 유지해도 되며 원본을 수정하지 않는 것이 계약입니다.",
    cases: [
      {
        expression:
          "(() => { const items = [{id:'a', quantity:2, label:'상품'}]; const next = changeQuantity(items, 'a', 1); return { before:items[0].quantity, after:next[0].quantity, label:next[0].label, copied:next !== items && next[0] !== items[0] }; })()",
        expected: { before: 2, after: 3, label: "상품", copied: true },
        note: "원본과 추가 필드를 보존합니다.",
      },
      {
        expression: "changeQuantity([{id:'a',quantity:1},{id:'b',quantity:2}], 'a', -5)",
        expected: [{ id: "b", quantity: 2 }],
        note: "대상 항목의 수량이 소진되면 제거합니다.",
      },
      {
        expression: "changeQuantity([{id:'a',quantity:0}], 'missing', 3)",
        expected: [{ id: "a", quantity: 0 }],
        note: "관계없는 0개 항목은 제거하지 않습니다.",
      },
    ],
  },
  page: {
    contract:
      "paginate(items, page, size)는 { items, page, totalPages }를 반환합니다. items는 배열입니다. page는 유한한 정수일 때만 사용하며 나머지는 1로 정규화합니다. size는 1~100 사이 정수만 사용하고 나머지는 10입니다. 문자열 숫자도 잘못된 입력으로 취급합니다.",
    core: "totalPages는 최소 1이며 page를 1부터 totalPages 사이로 제한한다. 해당 페이지의 원소를 순서대로 반환하고 원본을 수정하지 않는다.",
    extension:
      "빈 배열, 마지막 페이지 초과, 음수, 소수, NaN, 문자열 입력에도 정해진 정규화 규칙을 적용한다.",
    starter:
      "function paginate(items, page, size) {\n  const totalPages = Math.ceil(items.length / size);\n  return { items: items.splice((page - 1) * size, size), page, totalPages };\n}",
    alternateStarter:
      "function paginate(items, page, size) {\n  size = Number(size) || 10;\n  page = Number(page) || 1;\n  return { items: items.slice((page - 1) * size, page * size), page, totalPages: Math.ceil(items.length / size) };\n}",
    solution:
      "function paginate(items, page, size) {\n  size = Number.isInteger(size) && size >= 1 && size <= 100 ? size : 10;\n  const totalPages = Math.max(1, Math.ceil(items.length / size));\n  page = Number.isInteger(page) ? page : 1;\n  page = Math.min(totalPages, Math.max(1, page));\n  return { items: items.slice((page - 1) * size, page * size), page, totalPages };\n}",
    diagnosis:
      "splice는 원본을 바꾸며 빈 배열의 페이지 수 0은 UI 계약에 어긋납니다. 숫자 변환을 먼저 하면 문자열도 허용하게 되므로 타입과 정수 범위를 검사한 후 페이지를 제한합니다.",
    cases: [
      {
        expression: "paginate([1,2,3], 99, 2)",
        expected: { items: [3], page: 2, totalPages: 2 },
        note: "마지막 페이지로 제한합니다.",
      },
      {
        expression: "paginate([], -3, 0)",
        expected: { items: [], page: 1, totalPages: 1 },
        note: "빈 목록에도 표시할 페이지 1이 존재합니다.",
      },
      {
        expression:
          "(() => { const items = [1,2,3]; const result = paginate(items, '2', '1'); return { result, items }; })()",
        expected: { result: { items: [1, 2, 3], page: 1, totalPages: 1 }, items: [1, 2, 3] },
        note: "문자열을 숫자로 강제 변환하지 않습니다.",
      },
      {
        expression: "paginate([1], NaN, 1.5)",
        expected: { items: [1], page: 1, totalPages: 1 },
        note: "비정상 숫자도 기본값으로 처리합니다.",
      },
    ],
  },
  config: {
    contract:
      "parseConfig(env)는 { debug, port }를 반환합니다. env는 문자열 또는 undefined 값을 가진 객체입니다. DEBUG 생략 시 false, PORT 생략 시 3000입니다. DEBUG는 정확히 true 또는 false만 허용합니다. PORT는 선행 0 없는 1~65535의 10진 정수 문자열입니다. 그 외에는 Error를 던지며 입력을 수정하지 않습니다.",
    core: "문자열 false를 false로 읽고 잘못된 DEBUG 값을 거부한다. 입력 객체를 변경하지 않는다.",
    extension:
      "PORT 기본값, 형식과 범위를 검증한다. 공백, 소수, 지수 표기, 빈 값, 선행 0은 거부한다.",
    starter:
      "function parseConfig(env) {\n  env.DEBUG = Boolean(env.DEBUG);\n  return { debug: env.DEBUG, port: parseInt(env.PORT || '3000', 10) };\n}",
    alternateStarter:
      "function parseConfig(env) {\n  return { debug: env.DEBUG === 'true', port: Number(env.PORT ?? 3000) };\n}",
    solution:
      "function parseConfig(env) {\n  if (env.DEBUG !== undefined && env.DEBUG !== 'true' && env.DEBUG !== 'false') throw new Error('Invalid DEBUG');\n  const raw = env.PORT ?? '3000';\n  if (!/^[1-9][0-9]{0,4}$/.test(raw) || Number(raw) > 65535) throw new Error('Invalid PORT');\n  return { debug: env.DEBUG === 'true', port: Number(raw) };\n}",
    diagnosis:
      "비어 있지 않은 문자열은 Boolean 변환 시 참입니다. parseInt는 뒤의 잘못된 문자도 무시합니다. 허용한 문자열 형식과 범위를 검사하고 새 객체를 반환합니다.",
    cases: [
      {
        expression:
          "(() => { const env = {DEBUG:'false',PORT:'8080'}; return { result:parseConfig(env), env }; })()",
        expected: { result: { debug: false, port: 8080 }, env: { DEBUG: "false", PORT: "8080" } },
        note: "false 문자열과 원본을 보존합니다.",
      },
      {
        expression: "parseConfig({})",
        expected: { debug: false, port: 3000 },
        note: "생략한 필드만 기본값을 씁니다.",
      },
      {
        expression:
          "['', '0', '65536', '01', '1e2', '30x', ' 80', '8.5'].every(PORT => { try { parseConfig({PORT}); return false; } catch { return true; } })",
        expected: true,
        note: "잘못된 포트를 모두 거부합니다.",
      },
      {
        expression:
          "['TRUE', '', 'yes'].every(DEBUG => { try { parseConfig({DEBUG}); return false; } catch { return true; } })",
        expected: true,
        note: "허용하지 않은 DEBUG 값은 거부합니다.",
      },
    ],
  },
  dedupe: {
    contract:
      "createOnce(work)는 run(id)를 반환합니다. id는 문자열이며 work(id)는 Promise 또는 동기 값을 반환하거나 예외를 던질 수 있습니다. run은 항상 Promise입니다. 하나의 createOnce 인스턴스 안에서만 중복을 합칩니다. 분산 처리나 영구 저장은 범위 밖입니다.",
    core: "같은 id의 성공 결과를 재사용하되 실패한 id는 다시 실행할 수 있다. 서로 다른 id는 독립적으로 처리한다.",
    extension:
      "같은 id로 동시에 들어온 호출은 진행 중인 한 실행을 공유한다. 동기 예외도 거절된 Promise로 전달하고 재시도를 허용한다.",
    starter:
      "function createOnce(work) {\n  const seen = new Set();\n  return async function run(id) {\n    if (seen.has(id)) return;\n    seen.add(id);\n    return work(id);\n  };\n}",
    alternateStarter:
      "function createOnce(work) {\n  const results = new Map();\n  return async function run(id) {\n    if (results.has(id)) return results.get(id);\n    const result = await work(id);\n    results.set(id, result);\n    return result;\n  };\n}",
    solution:
      "function createOnce(work) {\n  const jobs = new Map();\n  return function run(id) {\n    if (jobs.has(id)) return jobs.get(id);\n    const promise = Promise.resolve().then(() => work(id)).catch(error => {\n      jobs.delete(id);\n      throw error;\n    });\n    jobs.set(id, promise);\n    return promise;\n  };\n}",
    diagnosis:
      "시작 시 처리 완료로 표시하면 실패도 차단합니다. 완료 값만 저장하면 동시 요청이 중복 실행됩니다. Promise를 먼저 등록하고 실패하면 제거합니다. 메모리 사용량 제한과 여러 프로세스의 중복 처리는 별도로 해결해야 합니다.",
    cases: [
      {
        expression:
          "(async () => { let calls = 0; const run = createOnce(async () => ++calls); const values = await Promise.all([run('a'),run('a')]); return {values,calls}; })()",
        expected: { values: [1, 1], calls: 1 },
        note: "동시 호출을 하나로 합칩니다.",
      },
      {
        expression:
          "(async () => { let calls = 0; const run = createOnce(() => { if (++calls === 1) throw Error('retry'); return 7; }); try { await run('a'); } catch {} return [await run('a'), await run('a'), calls]; })()",
        expected: [7, 7, 2],
        note: "실패는 재시도하고 성공은 재사용합니다.",
      },
      {
        expression:
          "(async () => { let calls = 0; const run = createOnce(id => { calls++; return id; }); return [await run('a'), await run('b'), calls]; })()",
        expected: ["a", "b", 2],
        note: "다른 id는 별도로 실행합니다.",
      },
    ],
  },
  total: {
    kind: "refactoring",
    contract:
      "summarize(orders)는 { paid, pending, cancelled }를 반환합니다. 각 주문은 status(paid, pending, cancelled 중 하나), 0 이상의 안전한 정수 amount(원 단위)를 가집니다. 합계도 안전한 정수입니다. 기존 paid와 pending 합산은 정상입니다. 입력을 변경하지 않습니다.",
    core: "기존 paid와 pending 결과 및 입력 불변성을 유지하고, 상태별로 반복되는 필터와 합산을 하나의 순회로 정리한다.",
    extension:
      "cancelled 합계를 별도 필드로 추가한다. 취소 금액을 paid나 pending 합계에 포함하지 않는다. 빈 배열은 세 합계 모두 0이다.",
    starter:
      "function summarize(orders) {\n  const paid = orders.filter(o => o.status === 'paid').reduce((sum, o) => sum + o.amount, 0);\n  const pending = orders.filter(o => o.status === 'pending').reduce((sum, o) => sum + o.amount, 0);\n  return { paid, pending };\n}",
    alternateStarter:
      "function summarize(orders) {\n  let paid = 0;\n  for (const order of orders) if (order.status === 'paid') paid += order.amount;\n  let pending = 0;\n  for (const order of orders) if (order.status === 'pending') pending += order.amount;\n  return { paid, pending };\n}",
    solution:
      "function summarize(orders) {\n  const result = { paid: 0, pending: 0, cancelled: 0 };\n  for (const order of orders) result[order.status] += order.amount;\n  return result;\n}",
    diagnosis:
      "기존 paid와 pending은 정상입니다. 기존 동작을 보존하는 순회 통합과 cancelled라는 새 요구사항을 분리해 설명합니다. 원 단위 정수라는 계약 안에서만 합산하며 임의의 소수 통화까지 지원한다고 주장하지 않습니다.",
    cases: [
      {
        expression:
          "summarize([{status:'paid',amount:100},{status:'pending',amount:50},{status:'cancelled',amount:20},{status:'paid',amount:30}])",
        expected: { paid: 130, pending: 50, cancelled: 20 },
        note: "기존 합계와 새 합계를 구분합니다.",
      },
      {
        expression: "summarize([])",
        expected: { paid: 0, pending: 0, cancelled: 0 },
        note: "빈 입력의 기본값을 유지합니다.",
      },
      {
        expression:
          "(() => { const orders = [{status:'paid',amount:0}]; const before = JSON.stringify(orders); summarize(orders); return JSON.stringify(orders) === before; })()",
        expected: true,
        note: "입력을 수정하지 않습니다.",
      },
    ],
  },
};

export const handoffProblems: Problem[] = HANDOFF_TRACKS.flatMap((track) => {
  const spec = handoffSpecs[track.key];
  return [false, true].map((variant): Problem => ({
    id: handoffId(track.key, variant),
    title: variant ? track.variantTitle : track.title,
    summary: `${variant ? "변형 재도전" : "AI 코드 인수인계"}: ${track.brief}`,
    scenario: `AI가 작성했다고 가정한 교육용 코드입니다. ${variant ? track.variantTitle + ". 이전 답을 보지 않고 다른 구현을 검토하세요. " : track.brief + " "}브라우저 또는 Node.js의 ES2022 JavaScript이며 외부 의존성은 없습니다. ${spec.contract} 코드 이해, 문제 판단, 수정과 확장, 검증 계획, 인수인계 판단을 함께 제출하세요. 서비스는 제출 코드를 실행하지 않습니다.`,
    domain: track.domain,
    language: "javascript",
    difficulty: track.key === "latest" || track.key === "dedupe" ? "상" : "중",
    kind: spec.kind ?? "debugging",
    source: "curated",
    createdAt: "2026-09-14T00:00:00.000Z",
    handoff: { track: track.key, variant, skill: track.skill },
    requirements: [
      "구조 이해에 함수의 입력과 출력, 처리 흐름과 상태 소유 범위를 코드에 근거해 설명한다.",
      "문제 판단에 재현 조건과 원인을 구체적으로 설명한다. 정상인 부분을 오류라고 단정하지 않는다.",
      spec.core,
      spec.extension,
      "검증 계획에 정상과 경계 조건의 입력 및 기대 결과를 제시하고, 회귀 테스트 코드를 작성한다. 실행 여부를 사실대로 구분한다.",
      "인수인계 판단에 변경 및 유지한 부분, 구현의 적용 범위, 남은 위험과 배포 전 확인 사항을 구체적으로 정리한다.",
    ],
    starterCode: variant ? spec.alternateStarter : spec.starter,
    solution: spec.solution,
    explanation: `${spec.diagnosis} 참고 코드는 저장소 자동 테스트에서 계약과 예제를 확인했습니다. 이것은 사용자의 풀이 실행 결과가 아닙니다. 인수인계 메모에는 자신의 코드 흐름과 실제 검증 근거를 작성하세요.`,
    hints: [
      "입력과 상태가 언제 만들어지고 누가 바꾸는지 먼저 따라가 보세요. 정상 동작과 새 요구사항을 구분하세요.",
      `확인할 핵심 역량은 ${track.skill}입니다. 요구사항의 경계 조건을 작은 예제로 나눠 보세요.`,
      spec.diagnosis,
    ],
    examples: spec.cases
      .slice(0, 2)
      .map((c) => ({ input: c.expression, output: JSON.stringify(c.expected), note: c.note })),
    tags: ["인수인계", track.skill, variant ? "변형 재도전" : "실무 훈련"],
    minutes: track.key === "latest" || track.key === "dedupe" ? 35 : 25,
  }));
});
