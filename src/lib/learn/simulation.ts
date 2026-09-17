import type { ServiceState } from "./services/types";
import { evaluateService, describeResult } from "./services/rules";
import { actionLabel, type Action, type Mission } from "./catalog";
export type Simulation = {
  service: ServiceState;
  online: boolean;
  memo: string;
  stored: string;
  browserMemo: string;
  actor: string;
  quantity: number;
  amount: number | null;
  todos: { title: string; done: boolean }[];
  filtered: boolean;
  query: string;
  result: string;
  pending: string[];
  bookings: string[];
  message: string;
  trace: string[];
};
export function initialSimulation(): Simulation {
  return {
    service: { selected: 0, result: null, history: [] },
    online: true,
    memo: "다음 주에 출시하기",
    stored: "",
    browserMemo: "",
    actor: "지민",
    quantity: 1,
    amount: 10000,
    todos: [
      { title: "서비스 만들기", done: true },
      { title: "다른 사용자로 검사하기", done: false },
      { title: "실패 상황 확인하기", done: false },
    ],
    filtered: false,
    query: "",
    result: "",
    pending: [],
    bookings: [],
    message: "직접 조작해 결과를 확인하세요.",
    trace: [],
  };
}
export function applyAction(m: Mission, s: Simulation, a: Action, fix = ""): Simulation {
  const n: Simulation = {
    ...s,
    pending: [...s.pending],
    bookings: [...s.bookings],
    todos: s.todos.map((x) => ({ ...x })),
    trace: [...s.trace],
  };
  if (m.service) {
    const selected = ["case-standard", "case-edge", "case-other"].indexOf(a);
    if (selected >= 0) {
      n.service = { ...s.service, selected, result: null };
      n.message = `${m.service.samples[selected].label} 선택`;
    } else if (a === "case-submit") {
      const result = evaluateService(m.service, s.service.selected, fix);
      n.service = {
        ...s.service,
        result,
        history: [...s.service.history, { sample: s.service.selected, result }],
      };
      n.message = result.detail;
    }
  } else if (a === "offline" || a === "online") {
    n.online = a === "online";
    n.message = n.online ? "모의 연결이 복구됐습니다." : "모의 네트워크가 끊겼습니다.";
  } else if (m.app === "memo" || m.app === "request") {
    if (a === "save") {
      if (fix === "server") {
        if (n.online) {
          n.stored = n.memo;
          n.message = "서버 응답 확인: 저장 완료";
        } else n.message = "저장 실패: 연결을 복구하고 다시 시도하세요.";
      } else {
        if (fix === "browser") n.browserMemo = n.memo;
        n.message = "저장 완료";
      }
    }
    if (a === "refresh") {
      n.memo = fix === "server" ? n.stored : n.browserMemo;
      n.message = n.memo
        ? "새로고침 후 작성한 내용이 남았습니다."
        : "새로고침 후 작성한 내용이 사라졌습니다.";
    }
    if (a === "other-device") {
      n.memo = n.stored;
      n.message = n.memo
        ? "다른 기기에서도 저장한 데이터를 읽었습니다."
        : "다른 기기에는 저장한 데이터가 없습니다.";
    }
  } else if (m.app === "access") {
    if (a === "switch-user") {
      n.actor = s.actor === "지민" ? "민수" : "지민";
      n.message = `${n.actor}로 로그인했습니다.`;
    }
    if (a === "open-private")
      n.message =
        fix === "owner" && n.actor !== "지민"
          ? "서버가 접근을 거절했습니다. 이 글의 주인이 아닙니다."
          : "지민의 비공개 글: 출시 전 아이디어 메모";
  } else if (m.app === "price") {
    n.quantity = a === "invalid-quantity" ? -1 : 3;
    n.amount =
      fix === "validated" && n.quantity < 1
        ? null
        : n.quantity *
          10000 *
          ((fix === "validated" || fix === "discount") && n.quantity >= 3 ? 0.9 : 1);
    n.message =
      n.amount === null
        ? "수량 오류: 1 이상의 정수를 입력하세요."
        : `계산 결과: ${n.amount.toLocaleString("ko-KR")}원`;
  } else if (m.app === "filter") {
    if (a === "filter") {
      n.filtered = true;
      if (fix === "mark") n.todos = n.todos.map((t) => ({ ...t, done: true }));
      else if (fix !== "derived") n.todos = n.todos.filter((t) => t.done);
    }
    if (a === "refresh") n.filtered = false;
    n.message = `표시 ${(n.filtered ? n.todos.filter((t) => t.done) : n.todos).length}개 / 원본 ${n.todos.length}개`;
  } else if (m.app === "search") {
    if (a === "search-old" || a === "search-new") {
      n.query = a === "search-old" ? "고양이" : "강아지";
      if (!n.pending.includes(n.query)) n.pending.push(n.query);
      n.message = `${n.query} 요청을 보냈습니다.`;
    } else {
      const q = a === "respond-old" ? "고양이" : "강아지";
      if (!n.pending.includes(q)) n.message = "먼저 해당 검색 요청을 보내세요.";
      else {
        n.pending = n.pending.filter((p) => p !== q);
        if (fix !== "latest" || n.query === q) {
          n.result = q;
          n.message = `${q} 결과를 표시했습니다.`;
        } else n.message = `이전 ${q} 응답을 반영하지 않았습니다.`;
      }
    }
  } else if (m.app === "booking") {
    const key = a === "new-booking" ? "예약 B" : "예약 A";
    if (!n.online) n.message = "연결 실패: 예약이 접수되지 않았습니다.";
    else if (fix === "block" && n.bookings.length) n.message = "추가 예약을 모두 거절했습니다.";
    else if (fix === "idempotent" && n.bookings.includes(key))
      n.message = `${key}의 기존 결과를 반환했습니다.`;
    else {
      n.bookings.push(key);
      n.message = `${key} 접수 완료`;
    }
  }
  n.trace.push(`${actionLabel(m, a)} → ${n.message}`);
  return n;
}
export function simulate(m: Mission, actions: Action[], fix = "") {
  return actions.reduce((s, a) => applyAction(m, s, a, fix), initialSimulation());
}
export function reproduced(m: Mission, actions: Action[]) {
  if (m.service) {
    let selected = "case-standard";
    for (const action of actions) {
      if (["case-standard", "case-edge", "case-other"].includes(action)) selected = action;
      if (action === "case-submit" && selected === "case-edge") return true;
    }
    return false;
  }
  let index = 0;
  for (const action of actions) if (action === m.reproduce[index]) index++;
  return index === m.reproduce.length;
}
export type CheckResult = { id: string; label: string; passed: boolean; evidence: string };
export function verification(m: Mission, fix: string): CheckResult[] {
  if (m.service) {
    const c = m.service;
    return c.samples.map((sample, index) => {
      const actual = evaluateService(c, index, fix);
      return {
        id: `sample-${index}`,
        label: sample.label,
        passed:
          actual.allowed === sample.expected.allowed && actual.amount === sample.expected.amount,
        evidence: `실제: ${actual.detail} / 기대: ${describeResult(c, sample.expected)}`,
      };
    });
  }
  const run = (actions: Action[]) => simulate(m, actions, fix);
  const item = (id: string, label: string, s: Simulation, passed: boolean): CheckResult => ({
    id,
    label,
    passed,
    evidence: s.message,
  });
  if (m.app === "memo") {
    const a = run(["save", "refresh"]),
      b = run(["save", "other-device"]);
    return [
      item("refresh", "새로고침해도 남는다", a, !!a.memo),
      item("device", "다른 기기에서도 읽는다", b, !!b.memo),
    ];
  }
  if (m.app === "request") {
    const a = run(["offline", "save"]),
      b = run(["offline", "save", "online", "save"]);
    return [
      item(
        "failure",
        "실패를 성공으로 표시하지 않는다",
        a,
        a.message.includes("실패") && !a.stored,
      ),
      item("retry", "연결 복구 뒤 다시 저장할 수 있다", b, !!b.stored),
    ];
  }
  if (m.app === "access") {
    const a = run(["open-private"]),
      b = run(["switch-user", "open-private"]);
    return [
      item("owner", "글 주인은 읽을 수 있다", a, a.message.includes("아이디어")),
      item("stranger", "다른 사용자의 직접 요청은 거절한다", b, b.message.includes("거절")),
    ];
  }
  if (m.app === "price") {
    const a = run(["quantity"]),
      b = run(["invalid-quantity"]);
    return [
      item("discount", "3개부터 할인한다", a, a.amount === 27000),
      item("invalid", "음수 수량을 거절한다", b, b.amount === null),
    ];
  }
  if (m.app === "filter") {
    const a = run(["filter"]),
      b = run(["filter", "refresh"]);
    return [
      item("filtered", "완료 항목 하나만 보인다", a, a.todos.filter((t) => t.done).length === 1),
      item(
        "preserved",
        "전체로 돌아오면 세 항목이 남는다",
        b,
        b.todos.length === 3 && b.todos.filter((t) => !t.done).length === 2,
      ),
    ];
  }
  if (m.app === "search") {
    const a = run(["search-old", "search-new", "respond-new", "respond-old"]),
      b = run(["search-old", "respond-old"]);
    return [
      item("latest", "늦은 이전 응답이 최신 결과를 덮지 않는다", a, a.query === a.result),
      item("single", "단일 요청도 정상 표시한다", b, b.result === "고양이"),
    ];
  }
  const a = run(["book", "repeat-book"]),
    b = run(["book", "new-booking"]),
    c = run(["offline", "book", "online", "repeat-book"]);
  return [
    item("duplicate", "동일 요청은 한 번만 저장한다", a, a.bookings.length === 1),
    item("new", "새 요청은 새로 저장한다", b, b.bookings.length === 2),
    item("retry", "연결 실패 후 재시도할 수 있다", c, c.bookings.length === 1),
  ];
}
