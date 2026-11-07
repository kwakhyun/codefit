import type { ExampleTest } from "../lib/example-tests";

/** Public example checks for built-in JavaScript/TypeScript function problems. They run in
 * the learner's browser sandbox (QuickJS) against the learner's own code; nothing here is
 * secret. Problems that need React, the DOM or browser-only APIs such as URL have none. */
export const exampleTests: Record<string, ExampleTest[]> = {
  "fe-cart": [
    {
      id: "copy",
      expression: `(() => { const items = [{ id: "a", quantity: 2 }]; const next = updateQuantity(items, "a", 5); return [items[0].quantity, next[0].quantity, next !== items]; })()`,
      expected: [2, 5, true],
      label: "원본 배열과 객체를 바꾸지 않고 새 배열을 반환합니다.",
    },
    {
      id: "remove",
      expression: `updateQuantity([{ id: "a", quantity: 2 }, { id: "b", quantity: 1 }], "a", 0)`,
      expected: [{ id: "b", quantity: 1 }],
      label: "수량이 0이면 항목을 제거합니다.",
    },
    {
      id: "negative",
      expression: `updateQuantity([{ id: "a", quantity: 2 }], "a", -1)`,
      expected: [],
      label: "음수 수량도 항목을 제거합니다.",
    },
    {
      id: "reference",
      expression: `(() => { const items = [{ id: "a", quantity: 2 }, { id: "b", quantity: 1 }]; const next = updateQuantity(items, "a", 3); return next[1] === items[1]; })()`,
      expected: true,
      label: "다른 항목의 객체 참조는 그대로 유지합니다.",
    },
    {
      id: "missing",
      expression: `(() => { const items = [{ id: "a", quantity: 2 }]; const next = updateQuantity(items, "missing", 3); return [next !== items, next[0] === items[0], next.length]; })()`,
      expected: [true, true, 1],
      label: "없는 ID는 내용이 같은 새 배열을 반환합니다.",
    },
  ],
  "sys-lru": [
    {
      id: "recent",
      expression: `(() => { const c = new LRUCache(2); c.put("a", 0); c.put("b", 2); c.get("a"); c.put("c", 3); return [c.get("b") === undefined, c.get("a"), c.get("c")]; })()`,
      expected: [true, 0, 3],
      label: "조회한 키는 최근 위치로 옮기고 가장 오래된 키를 지웁니다.",
    },
    {
      id: "update",
      expression: `(() => { const c = new LRUCache(2); c.put("a", 1); c.put("b", 2); c.put("a", 10); c.put("c", 3); return [c.get("a"), c.get("b") === undefined, c.get("c")]; })()`,
      expected: [10, true, 3],
      label: "기존 키를 갱신해도 최근 위치로 옮깁니다.",
    },
    {
      id: "missing",
      expression: `new LRUCache(2).get("missing") === undefined`,
      expected: true,
      label: "없는 키는 undefined를 반환합니다.",
    },
    {
      id: "capacity",
      expression: `(() => { const rejected = (value) => { try { new LRUCache(value); return false; } catch (e) { return e instanceof RangeError; } }; return [rejected(0), rejected(1.5)]; })()`,
      expected: [true, true],
      label: "1 미만이거나 정수가 아닌 용량은 RangeError로 거부합니다.",
    },
  ],
  "fe-page-range": [
    {
      id: "middle",
      expression: `pageItems(5, 10)`,
      expected: [1, "…", 4, 5, 6, "…", 10],
      label: "현재 페이지 양쪽의 생략 구간을 줄임표로 접습니다.",
    },
    {
      id: "single-gap",
      expression: `pageItems(4, 10)`,
      expected: [1, 2, 3, 4, 5, "…", 10],
      label: "한 페이지만 생략되면 줄임표 대신 번호를 보여 줍니다.",
    },
    {
      id: "clamp",
      expression: `pageItems(99, 7, 2)`,
      expected: [1, "…", 5, 6, 7],
      label: "범위를 넘은 현재 페이지는 마지막 페이지로 보정합니다.",
    },
    {
      id: "small",
      expression: `[pageItems(1, 0), pageItems(1, 1), pageItems(2, 3)]`,
      expected: [[], [1], [1, 2, 3]],
      label: "페이지가 적으면 중복 없이 있는 번호만 보여 줍니다.",
    },
    {
      id: "invalid",
      expression: `(() => { try { pageItems(1, 2.5); return "no error"; } catch (e) { return e instanceof RangeError; } })()`,
      expected: true,
      label: "정수가 아닌 전체 페이지 수는 RangeError로 거부합니다.",
    },
  ],
  "be-rate-limit": [
    {
      id: "limit",
      expression: `(() => { const l = createLimiter({ limit: 2, windowMs: 1000 }); return [l.hit("a", 0), l.hit("a", 100), l.hit("a", 200)]; })()`,
      expected: [
        { allowed: true, remaining: 1, retryAfterMs: 0 },
        { allowed: true, remaining: 0, retryAfterMs: 0 },
        { allowed: false, remaining: 0, retryAfterMs: 800 },
      ],
      label: "한도를 넘은 시도는 구간이 끝날 때까지 남은 시간을 알려 줍니다.",
    },
    {
      id: "next-window",
      expression: `(() => { const l = createLimiter({ limit: 1, windowMs: 1000 }); l.hit("a", 0); l.hit("a", 10); return l.hit("a", 1000); })()`,
      expected: { allowed: true, remaining: 0, retryAfterMs: 0 },
      label: "구간이 끝나면 새 구간으로 다시 허용합니다.",
    },
    {
      id: "rejected-not-counted",
      expression: `(() => { const l = createLimiter({ limit: 2, windowMs: 1000 }); for (let t = 0; t < 4; t++) l.hit("a", t); return l.hit("a", 1000); })()`,
      expected: { allowed: true, remaining: 1, retryAfterMs: 0 },
      label: "거부된 시도는 다음 구간의 횟수에 영향을 주지 않습니다.",
    },
    {
      id: "keys",
      expression: `(() => { const l = createLimiter({ limit: 1, windowMs: 1000 }); l.hit("a", 0); return l.hit("b", 1); })()`,
      expected: { allowed: true, remaining: 0, retryAfterMs: 0 },
      label: "다른 계정의 시도는 따로 셉니다.",
    },
    {
      id: "invalid",
      expression: `(() => { const rejected = (options) => { try { createLimiter(options); return false; } catch (e) { return e instanceof RangeError; } }; return [rejected({ limit: 0, windowMs: 1000 }), rejected({ limit: 1, windowMs: 0.5 })]; })()`,
      expected: [true, true],
      label: "양의 정수가 아닌 설정은 RangeError로 거부합니다.",
    },
  ],
  "game-cooldown": [
    {
      id: "first-use",
      expression: `(() => { const c = createCooldown(1000); return [c.tryUse(500), c.remaining(500)]; })()`,
      expected: [true, 1000],
      label: "게임 시작 직후에도 처음 사용은 허용합니다.",
    },
    {
      id: "spam",
      expression: `(() => { const c = createCooldown(1000); c.tryUse(0); return [c.tryUse(400), c.remaining(400)]; })()`,
      expected: [false, 600],
      label: "대기 중 입력은 대기시간을 늘리지 않습니다.",
    },
    {
      id: "boundary",
      expression: `(() => { const c = createCooldown(1000); c.tryUse(0); return [c.remaining(1000), c.tryUse(1000)]; })()`,
      expected: [0, true],
      label: "대기시간이 끝나는 시각에 바로 다시 쓸 수 있습니다.",
    },
    {
      id: "not-negative",
      expression: `(() => { const c = createCooldown(1000); c.tryUse(0); return c.remaining(2500); })()`,
      expected: 0,
      label: "남은 시간은 음수가 되지 않습니다.",
    },
    {
      id: "invalid",
      expression: `(() => { const rejected = (value) => { try { createCooldown(value); return false; } catch (e) { return e instanceof RangeError; } }; return [rejected(-1), rejected(Infinity), rejected("1000")]; })()`,
      expected: [true, true, true],
      label: "0 이상의 유한한 숫자가 아닌 대기시간은 거부합니다.",
    },
  ],
  "db-safe-insert": [
    {
      id: "placeholders",
      expression: `buildInsert("users", ["name", "email"], [["민지", "mj@example.com"], ["O'Brien", "ob@example.com"]])`,
      expected: {
        text: "INSERT INTO users (name, email) VALUES ($1, $2), ($3, $4)",
        values: ["민지", "mj@example.com", "O'Brien", "ob@example.com"],
      },
      label: "작은따옴표가 있는 값도 SQL 문자열 밖의 values로 전달합니다.",
    },
    {
      id: "numbers",
      expression: `buildInsert("orders", ["user_id", "amount"], [[7, 1200]])`,
      expected: { text: "INSERT INTO orders (user_id, amount) VALUES ($1, $2)", values: [7, 1200] },
      label: "숫자 값은 형식을 바꾸지 않고 전달합니다.",
    },
    {
      id: "identifiers",
      expression: `(() => { const rejected = (table, columns) => { try { buildInsert(table, columns, [columns.map(() => "x")]); return false; } catch { return true; } }; return [rejected("users; DROP TABLE users", ["name"]), rejected("users", ["name", "password"]), rejected("toString", ["name"])]; })()`,
      expected: [true, true, true],
      label: "허용 목록에 없는 테이블과 열 이름은 거부합니다.",
    },
    {
      id: "rows",
      expression: `(() => { const rejected = (rows) => { try { buildInsert("users", ["name", "email"], rows); return false; } catch { return true; } }; return [rejected([]), rejected([["x"]])]; })()`,
      expected: [true, true],
      label: "행이 없거나 값 개수가 맞지 않으면 쿼리를 만들지 않습니다.",
    },
  ],
  "security-escape-html": [
    {
      id: "tags",
      expression: `escapeHtml("<b>굵게</b> & <i>기울임</i>")`,
      expected: "&lt;b&gt;굵게&lt;/b&gt; &amp; &lt;i&gt;기울임&lt;/i&gt;",
      label: "모든 위치의 특수 문자를 바꿉니다.",
    },
    {
      id: "quotes",
      expression: `escapeHtml("\\" onmouseover=\\"alert('x')")`,
      expected: "&quot; onmouseover=&quot;alert(&#39;x&#39;)",
      label: "속성값을 벗어나는 따옴표도 바꿉니다.",
    },
    {
      id: "once",
      expression: `escapeHtml("Tom & Jerry &lt;")`,
      expected: "Tom &amp; Jerry &amp;lt;",
      label: "입력의 각 문자는 정확히 한 번만 바뀝니다.",
    },
    {
      id: "values",
      expression: `[escapeHtml(null), escapeHtml(undefined), escapeHtml(42), escapeHtml(false)]`,
      expected: ["", "", "42", "false"],
      label: "문자열이 아닌 값도 처리합니다.",
    },
    {
      id: "unicode",
      expression: `escapeHtml("안녕하세요 👋")`,
      expected: "안녕하세요 👋",
      label: "한글과 이모지는 그대로 둡니다.",
    },
  ],
  "sys-lower-bound": [
    {
      id: "duplicates",
      expression: `lowerBound([1, 3, 3, 5], 3)`,
      expected: 1,
      label: "같은 값이 여러 개면 첫 위치를 반환합니다.",
    },
    {
      id: "terminates",
      expression: `lowerBound([1, 3], 3)`,
      expected: 1,
      label: "두 원소만 남아도 반복이 끝납니다.",
    },
    {
      id: "edges",
      expression: `[lowerBound([1, 2, 4], 10), lowerBound([], 7), lowerBound([2, 4, 6], 1)]`,
      expected: [3, 0, 0],
      label: "값이 모두 작거나, 배열이 비었거나, 값이 모두 큰 경우를 처리합니다.",
    },
    {
      id: "large",
      expression: `(() => { const items = Array.from({ length: 1000 }, (_, i) => i * 2); return [lowerBound(items, 999), lowerBound(items, 1000), lowerBound(items, 1999)]; })()`,
      expected: [500, 500, 1000],
      label: "큰 배열에서도 경계를 정확히 찾습니다.",
    },
  ],
};
