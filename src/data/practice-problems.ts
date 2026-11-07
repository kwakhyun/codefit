import type { Problem } from "../lib/problem";

type Seed = Omit<Problem, "createdAt" | "source">;

/** Built-in coding problems that give every domain at least three practice problems. */
export const practiceSeeds: Seed[] = [
  {
    id: "fe-page-range",
    domain: "frontend",
    language: "typescript",
    difficulty: "하",
    kind: "implementation",
    title: "페이지 번호 버튼 목록 만들기",
    summary:
      "현재 페이지 주변과 처음·끝 페이지를 보여 주고 나머지는 줄임표로 접는 페이지 목록을 계산하세요.",
    scenario:
      '게시판 목록 아래에 페이지 버튼을 그립니다. 전체 페이지가 많아도 버튼이 한 줄에 들어가도록, 화면에 그릴 항목 배열을 계산하는 순수 함수 pageItems(current, total, siblings = 1)를 TypeScript로 작성하세요. 배열의 숫자는 페이지 번호이고 문자열 "…"는 줄임표입니다. 화면 컴포넌트는 이미 이 배열을 그대로 그립니다.',
    requirements: [
      "current와 total은 정수, total과 siblings는 0 이상의 정수여야 하며 아니면 RangeError를 발생시키세요. total이 0이면 빈 배열을 반환하세요.",
      "current는 1과 total 사이로 보정하고, 첫 페이지와 마지막 페이지, current 앞뒤 siblings개 페이지를 중복 없이 오름차순으로 포함하세요.",
      '생략되는 페이지가 2개 이상인 구간만 "…"로 표시하고, 1개만 생략되면 그 페이지 번호를 그대로 표시하세요.',
    ],
    starterCode: `type PageItem = number | "…";

function pageItems(current: number, total: number, siblings = 1): PageItem[] {
  const items: PageItem[] = [];
  for (let page = current - siblings; page <= current + siblings; page++) {
    items.push(page);
  }
  return [1, "…", ...items, "…", total];
}
`,
    hints: [
      "먼저 반드시 보여 줄 페이지 번호(처음, 끝, 현재 주변)를 모은 뒤 정렬해 보세요.",
      "정렬한 번호를 차례로 보며 이전 번호와의 차이로 생략된 페이지 수를 계산할 수 있습니다.",
      '차이가 2이면 생략된 페이지가 하나이므로 그 번호를 넣고, 3 이상이면 "…"를 넣으세요. Set을 쓰면 중복을 쉽게 막을 수 있습니다.',
    ],
    solution: `type PageItem = number | "…";

function pageItems(current: number, total: number, siblings = 1): PageItem[] {
  if (!Number.isInteger(current) || !Number.isInteger(total) || total < 0) {
    throw new RangeError("invalid page");
  }
  if (!Number.isInteger(siblings) || siblings < 0) throw new RangeError("invalid siblings");
  if (total === 0) return [];
  const page = Math.min(Math.max(current, 1), total);
  const shown = new Set([1, total]);
  for (let p = page - siblings; p <= page + siblings; p++) {
    if (p >= 1 && p <= total) shown.add(p);
  }
  const items: PageItem[] = [];
  let previous = 0;
  for (const p of [...shown].sort((a, b) => a - b)) {
    const gap = p - previous - 1;
    if (gap === 1) items.push(previous + 1);
    else if (gap > 1) items.push("…");
    items.push(p);
    previous = p;
  }
  return items;
}
`,
    explanation:
      "표시할 번호를 먼저 정하고 번호 사이의 간격으로 줄임표를 결정하면 경계 조건이 한곳에 모입니다. 생략된 페이지가 하나뿐일 때 줄임표 대신 번호를 보여 주면 버튼 수는 같으면서 바로 이동할 수 있는 페이지가 늘어납니다. Set은 처음·끝 페이지와 현재 주변이 겹칠 때의 중복을 막습니다.",
    examples: [
      {
        input: "pageItems(5, 10)",
        output: '[1, "…", 4, 5, 6, "…", 10]',
        note: "현재 페이지 양쪽의 생략 구간을 줄임표로 접습니다.",
      },
      {
        input: "pageItems(4, 10)",
        output: '[1, 2, 3, 4, 5, "…", 10]',
        note: "2페이지 하나만 생략되므로 줄임표 대신 번호를 보여 줍니다.",
      },
    ],
    tags: ["TypeScript", "페이지네이션", "경계 조건"],
    minutes: 20,
  },
  {
    id: "be-rate-limit",
    domain: "backend",
    language: "javascript",
    difficulty: "중",
    kind: "implementation",
    title: "로그인 시도 횟수 제한하기",
    summary:
      "같은 계정에 짧은 시간 동안 반복되는 로그인 시도를 제한하는 고정 구간 제한기를 만드세요.",
    scenario:
      "로그인 API가 비밀번호 대입 공격을 받고 있습니다. 서버 메모리에서 동작하는 제한기 createLimiter({ limit, windowMs })를 JavaScript로 작성하세요. 반환 객체의 hit(key, now)는 시도를 기록하고 { allowed, remaining, retryAfterMs }를 반환합니다. now는 밀리초 시각이며 테스트할 수 있도록 호출하는 쪽이 전달하고, 같은 키에서는 이전 호출 이상입니다. 키마다 구간의 첫 시도 시각부터 windowMs 동안을 하나의 구간으로 봅니다. 여러 서버가 공유하는 저장소는 이 문제의 범위가 아닙니다.",
    requirements: [
      "limit과 windowMs가 양의 정수가 아니면 RangeError를 발생시키세요.",
      "키마다 구간 안의 시도를 limit번까지 허용하고, 초과한 시도는 allowed: false, remaining: 0과 구간이 끝날 때까지 남은 시간 retryAfterMs를 반환하세요.",
      "허용된 시도는 남은 횟수 remaining과 retryAfterMs: 0을 반환하고, 거부된 시도는 횟수를 늘리지 마세요.",
      "구간이 끝난 뒤의 시도는 새 구간으로 시작하고, 한 키의 기록이 다른 키에 영향을 주지 않게 하세요.",
    ],
    starterCode: `function createLimiter({ limit, windowMs }) {
  const attempts = {};
  return {
    hit(key, now) {
      attempts[key] = (attempts[key] || 0) + 1;
      return { allowed: attempts[key] <= limit, remaining: limit - attempts[key], retryAfterMs: 0 };
    },
  };
}
`,
    hints: [
      "키마다 구간 시작 시각과 시도 횟수를 함께 저장해야 구간이 끝났는지 판단할 수 있습니다.",
      "now가 구간 시작 시각 + windowMs 이상이면 새 구간으로 기록을 초기화하세요.",
      "횟수가 이미 limit이면 늘리지 말고 거부하세요. Map을 쓰면 '__proto__' 같은 키도 일반 키처럼 다룰 수 있습니다.",
    ],
    solution: `function createLimiter({ limit, windowMs }) {
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError("limit");
  if (!Number.isInteger(windowMs) || windowMs < 1) throw new RangeError("windowMs");
  const windows = new Map();
  return {
    hit(key, now) {
      let entry = windows.get(key);
      if (!entry || now >= entry.start + windowMs) {
        entry = { start: now, count: 0 };
        windows.set(key, entry);
      }
      if (entry.count >= limit) {
        return { allowed: false, remaining: 0, retryAfterMs: entry.start + windowMs - now };
      }
      entry.count += 1;
      return { allowed: true, remaining: limit - entry.count, retryAfterMs: 0 };
    },
  };
}
`,
    explanation:
      "고정 구간 방식은 키마다 시작 시각과 횟수만 저장하므로 단순하고 빠릅니다. 거부된 시도를 세지 않으면 공격이 계속돼도 다음 구간이 정상적으로 열립니다. 구간 경계 앞뒤로 짧은 시간에 최대 두 배까지 시도할 수 있는 한계가 있어 더 엄격한 제한에는 슬라이딩 윈도나 토큰 버킷을 씁니다. 실제 서비스에서는 만료된 키를 정리하고 여러 서버가 공유하는 저장소를 사용합니다.",
    examples: [
      {
        input: 'limit=2, windowMs=1000에서 0, 100, 200ms에 hit("a", now)',
        output: "허용(remaining 1), 허용(remaining 0), 거부(retryAfterMs 800)",
        note: "세 번째 시도는 구간이 끝날 때까지 남은 시간을 알려 줍니다.",
      },
    ],
    tags: ["JavaScript", "속도 제한", "인증"],
    minutes: 25,
  },
  {
    id: "game-cooldown",
    domain: "game",
    language: "javascript",
    difficulty: "하",
    kind: "debugging",
    title: "끝나지 않는 스킬 재사용 대기시간 고치기",
    summary:
      "대기시간이 음수로 표시되고 대기 중에 누른 입력이 대기시간을 늘리는 스킬 쿨다운 로직을 수정하세요.",
    scenario:
      "브라우저 게임의 스킬 버튼은 createCooldown(durationMs)가 만든 객체를 사용합니다. tryUse(now)는 스킬을 쓸 수 있으면 사용 시각을 기록하고 true를, 아니면 false를 반환합니다. remaining(now)는 다시 쓸 수 있을 때까지 남은 밀리초입니다. now는 게임 루프가 전달하는 0 이상의 밀리초 시각이며 항상 이전 호출 이상입니다. 현재 코드는 게임 시작 직후 스킬을 쓰지 못하고, 대기시간이 끝나면 남은 시간이 음수로 표시되며, 대기 중에 누른 입력이 대기시간을 늘립니다.",
    requirements: [
      "durationMs가 0 이상의 유한한 숫자가 아니면 RangeError를 발생시키세요.",
      "한 번도 사용하지 않았거나 대기시간이 끝났으면 tryUse가 true를 반환하고 그 시각부터 새 대기시간을 시작하세요.",
      "대기 중의 tryUse는 false를 반환하고 기존 대기시간을 바꾸지 마세요.",
      "remaining은 0 미만이 되지 않게 하고, 대기시간이 정확히 끝난 시각에는 0을 반환하세요.",
    ],
    starterCode: `function createCooldown(durationMs) {
  let lastUsed = 0;
  return {
    tryUse(now) {
      const ready = now - lastUsed > durationMs;
      lastUsed = now;
      return ready;
    },
    remaining(now) {
      return lastUsed + durationMs - now;
    },
  };
}
`,
    hints: [
      "마지막 사용 시각 대신 '다시 쓸 수 있는 시각'을 저장하면 비교가 단순해집니다.",
      "사용에 실패한 입력에서는 저장한 시각을 바꾸면 안 됩니다. 처음에는 언제든 쓸 수 있도록 초깃값을 정하세요.",
      "readyAt을 -Infinity로 시작하고 now >= readyAt일 때만 갱신하세요. 남은 시간은 Math.max(0, readyAt - now)입니다.",
    ],
    solution: `function createCooldown(durationMs) {
  if (typeof durationMs !== "number" || !Number.isFinite(durationMs) || durationMs < 0) {
    throw new RangeError("durationMs");
  }
  let readyAt = -Infinity;
  return {
    tryUse(now) {
      if (now < readyAt) return false;
      readyAt = now + durationMs;
      return true;
    },
    remaining(now) {
      return Math.max(0, readyAt - now);
    },
  };
}
`,
    explanation:
      "다시 사용할 수 있는 시각 하나로 상태를 표현하면 초기 상태, 경계 시각, 대기 중 입력을 같은 비교로 처리할 수 있습니다. 실패한 입력에서 상태를 바꾸지 않아야 버튼을 연타해도 대기시간이 늘어나지 않습니다. 남은 시간은 화면 표시용이므로 0 아래로 내려가지 않게 제한합니다.",
    examples: [
      {
        input: "durationMs=1000, 0ms에 사용 후 400ms에 다시 누름",
        output: "tryUse(400) = false, remaining(400) = 600",
        note: "대기 중 입력은 대기시간을 늘리지 않습니다.",
      },
    ],
    tags: ["JavaScript", "게임 루프", "타이머"],
    minutes: 15,
  },
  {
    id: "game-inventory",
    domain: "game",
    language: "lua",
    difficulty: "중",
    kind: "implementation",
    title: "최대 묶음 수가 있는 인벤토리에 아이템 넣기",
    summary:
      "같은 아이템은 기존 칸부터 채우고, 묶음 한도를 넘으면 빈칸을 사용하는 인벤토리 함수를 작성하세요.",
    scenario:
      'Lua로 작성한 RPG에서 인벤토리는 고정 길이의 배열이며 각 칸은 nil 또는 { id = "potion", count = 3 }입니다. add_item(slots, size, id, count, max_stack)을 작성하세요. size는 칸 수, max_stack은 한 칸에 담을 수 있는 최대 개수입니다. 함수는 넣지 못한 개수를 반환합니다. 다른 시스템도 같은 slots를 참조하므로 잘못된 인자로 호출하면 slots를 바꾸기 전에 오류를 발생시켜야 합니다.',
    requirements: [
      "count와 max_stack이 1 이상의 유한한 정수가 아니면 slots를 바꾸지 않고 error를 발생시키세요.",
      "같은 id가 있는 칸을 앞에서부터 max_stack까지 채운 뒤, 남은 개수는 앞쪽 빈칸부터 max_stack 단위로 나누어 넣으세요.",
      "공간이 부족하면 넣을 수 있는 만큼만 넣고 넣지 못한 개수를 반환하세요. 모두 넣으면 0을 반환하세요.",
    ],
    starterCode: `function add_item(slots, size, id, count, max_stack)
  for i = 1, size do
    if slots[i] == nil then
      slots[i] = { id = id, count = count }
      return 0
    end
  end
  return count
end
`,
    hints: [
      "두 단계로 나누어 생각해 보세요. 기존 묶음을 채우는 단계와 빈칸에 새 묶음을 만드는 단계입니다.",
      "남은 개수 변수를 두고 각 칸에 넣을 수 있는 양은 math.min(max_stack - 현재 개수, 남은 개수)로 계산하세요.",
      "Lua 배열의 빈칸은 nil입니다. # 연산자에 의존하지 말고 size까지 순회하세요. 정수 검사는 value == math.floor(value)로 할 수 있습니다.",
    ],
    solution: `local function is_positive_integer(value)
  return type(value) == "number" and value >= 1 and value < math.huge
    and value == math.floor(value)
end

function add_item(slots, size, id, count, max_stack)
  if not is_positive_integer(count) or not is_positive_integer(max_stack) then
    error("count and max_stack must be positive integers")
  end
  local left = count
  for i = 1, size do
    if left == 0 then break end
    local slot = slots[i]
    if slot ~= nil and slot.id == id and slot.count < max_stack then
      local added = math.min(max_stack - slot.count, left)
      slot.count = slot.count + added
      left = left - added
    end
  end
  for i = 1, size do
    if left == 0 then break end
    if slots[i] == nil then
      local added = math.min(max_stack, left)
      slots[i] = { id = id, count = added }
      left = left - added
    end
  end
  return left
end
`,
    explanation:
      "기존 묶음을 먼저 채우면 같은 아이템이 불필요하게 여러 칸으로 흩어지지 않습니다. 중간에 nil이 있는 배열에서 # 연산자의 결과는 보장되지 않으므로 고정된 size로 순회합니다. 인자를 검사한 뒤에만 slots를 수정해 잘못된 호출이 인벤토리를 일부만 바꾸는 일을 막습니다.",
    examples: [
      {
        input: 'slots = { { id = "potion", count = 8 } }; add_item(slots, 3, "potion", 7, 10)',
        output: "반환값 0, slots = { {potion, 10}, {potion, 5} }",
        note: "기존 칸을 10개까지 채우고 남은 5개는 빈칸에 넣습니다.",
      },
    ],
    tags: ["Lua", "인벤토리", "배열"],
    minutes: 25,
  },
  {
    id: "net-backoff",
    domain: "network",
    language: "go",
    difficulty: "상",
    kind: "implementation",
    title: "지수 백오프로 요청 재시도하기",
    summary:
      "일시적인 실패에만 대기 시간을 늘려 가며 재시도하고, 취소 신호를 존중하는 함수를 작성하세요.",
    scenario:
      "Go 서비스가 외부 결제 API를 호출합니다. 일시적인 네트워크 오류가 나면 바로 실패하지 않고 다시 시도해야 하지만, 같은 간격으로 계속 호출하면 상대 서버에 부담을 줍니다. Retry(ctx, attempts, base, max, op)를 작성하세요. op는 error를 반환하며, 다시 시도할 수 있는 오류는 errors.Is(err, ErrTemporary)로 구분합니다. base와 max는 양수입니다.",
    requirements: [
      "attempts가 1 미만이면 op를 호출하지 않고 오류를 반환하세요.",
      "op가 nil을 반환하면 즉시 성공으로 끝내고, ErrTemporary가 아닌 오류는 다시 시도하지 말고 그대로 반환하세요.",
      "재시도 전 대기 시간은 base부터 두 배씩 늘리되 max를 넘지 않게 하고, 마지막 시도 뒤에는 기다리지 마세요.",
      "대기 중 ctx가 취소되면 즉시 ctx.Err()를 반환하고, 모든 시도가 실패하면 마지막 오류를 반환하세요.",
    ],
    starterCode: `package retry

import (
	"context"
	"errors"
	"time"
)

var ErrTemporary = errors.New("temporary failure")

func Retry(ctx context.Context, attempts int, base, max time.Duration, op func() error) error {
	var err error
	for i := 0; i < attempts; i++ {
		err = op()
		if err == nil {
			return nil
		}
		time.Sleep(base)
	}
	return err
}
`,
    hints: [
      "다시 보내도 결과가 같은 오류(잘못된 요청 등)는 기다리지 말고 바로 반환해야 합니다. 먼저 오류의 종류를 구분하세요.",
      "time.Sleep은 취소 신호를 받지 못합니다. time.NewTimer와 select로 ctx.Done()과 타이머를 함께 기다리세요.",
      "다음 대기 시간은 delay*2와 max 중 작은 값입니다. 곱하기 전에 max/2와 비교하면 오버플로도 피할 수 있습니다.",
    ],
    solution: `package retry

import (
	"context"
	"errors"
	"time"
)

var ErrTemporary = errors.New("temporary failure")

func Retry(ctx context.Context, attempts int, base, max time.Duration, op func() error) error {
	if attempts < 1 {
		return errors.New("attempts must be at least 1")
	}
	delay := base
	if delay > max {
		delay = max
	}
	var err error
	for i := 0; i < attempts; i++ {
		if err = op(); err == nil || !errors.Is(err, ErrTemporary) {
			return err
		}
		if i == attempts-1 {
			break
		}
		timer := time.NewTimer(delay)
		select {
		case <-ctx.Done():
			timer.Stop()
			return ctx.Err()
		case <-timer.C:
		}
		if delay < max/2 {
			delay *= 2
		} else {
			delay = max
		}
	}
	return err
}
`,
    explanation:
      "실패할 때마다 간격을 늘리면 장애가 난 서버에 요청이 몰리는 것을 줄일 수 있습니다. 영구적인 오류를 다시 시도하지 않아야 응답이 빨라지고 불필요한 호출도 사라집니다. select로 타이머와 ctx.Done()을 함께 기다리면 요청이 취소된 즉시 함수가 끝납니다. 실제 서비스에서는 여러 클라이언트가 같은 시각에 재시도하지 않도록 무작위 지터를 더하는 경우가 많습니다.",
    examples: [
      {
        input: "attempts=6, base=100ms, max=1s, op가 일시적 오류 5번 후 성공",
        output: "100ms, 200ms, 400ms, 800ms, 1s를 기다린 뒤 nil 반환",
        note: "대기 시간은 max에서 더 늘어나지 않습니다.",
      },
      {
        input: "op가 처음에 ErrTemporary가 아닌 오류 반환",
        output: "기다리지 않고 그 오류를 반환, op 호출 1번",
        note: "영구적인 오류는 다시 시도하지 않습니다.",
      },
    ],
    tags: ["Go", "재시도", "context", "백오프"],
    minutes: 35,
  },
  {
    id: "net-checksum",
    domain: "network",
    language: "c",
    difficulty: "상",
    kind: "debugging",
    title: "홀수 길이 패킷에서 틀리는 체크섬 고치기",
    summary:
      "16비트 1의 보수 체크섬이 홀수 길이와 자리 올림에서 잘못 계산됩니다. RFC 1071 방식으로 고치세요.",
    scenario:
      "C로 작성한 네트워크 장비 펌웨어가 IPv4 헤더와 UDP 데이터그램의 체크섬을 계산합니다. checksum(data, len)은 데이터를 big-endian 16비트 단위로 더한 뒤 1의 보수를 반환해야 합니다. 그런데 길이가 홀수인 패킷과 합계가 큰 패킷에서 상대 장비와 다른 값이 나옵니다. data는 len바이트를 읽을 수 있으며 len은 0 이상 65,535 이하입니다.",
    requirements: [
      "두 바이트씩 big-endian 16비트 값으로 읽어 32비트 이상의 누산기에 더하세요.",
      "길이가 홀수이면 마지막 바이트를 상위 바이트로 하고 하위 바이트를 0으로 채워 더하세요.",
      "누산기의 상위 16비트 자리 올림을 더 이상 없을 때까지 하위 16비트에 더한 뒤, 1의 보수를 uint16_t로 반환하세요.",
    ],
    starterCode: `#include <stddef.h>
#include <stdint.h>

uint16_t checksum(const uint8_t *data, size_t len) {
    uint16_t sum = 0;
    for (size_t i = 0; i + 1 < len; i += 2) {
        sum += (uint16_t)(data[i] << 8 | data[i + 1]);
    }
    return ~sum;
}
`,
    hints: [
      "uint16_t 누산기는 더하는 순간 자리 올림을 잃어버립니다. 더 큰 타입에 모은 뒤 나중에 접어야 합니다.",
      "반복문이 끝났을 때 i가 len보다 작다면 짝이 없는 마지막 바이트가 남은 것입니다.",
      "while (sum >> 16) sum = (sum & 0xFFFF) + (sum >> 16); 로 자리 올림을 접고, 반환할 때 ~sum을 uint16_t로 변환하세요.",
    ],
    solution: `#include <stddef.h>
#include <stdint.h>

uint16_t checksum(const uint8_t *data, size_t len) {
    uint32_t sum = 0;
    size_t i = 0;
    for (; i + 1 < len; i += 2) {
        sum += (uint32_t)data[i] << 8 | data[i + 1];
    }
    if (i < len) {
        sum += (uint32_t)data[i] << 8;
    }
    while (sum >> 16) {
        sum = (sum & 0xFFFF) + (sum >> 16);
    }
    return (uint16_t)~sum;
}
`,
    explanation:
      "인터넷 체크섬은 1의 보수 덧셈이라 16비트를 넘는 자리 올림을 버리지 않고 다시 더해야 합니다. 32비트 누산기에 모은 뒤 접으면 중간에 올림을 잃지 않습니다. 홀수 길이의 마지막 바이트는 0으로 채운 16비트 값의 상위 바이트로 계산합니다. len이 65,535 이하라면 32비트 누산기가 넘치지 않으며, 더 큰 버퍼는 반복 중에 접거나 64비트 누산기를 사용합니다.",
    examples: [
      {
        input: "data = 00 01 f2 03 f4 f5 f6 f7, len = 8",
        output: "0x220d",
        note: "합계 0x2ddf0의 올림 2를 더한 0xddf2의 1의 보수입니다.",
      },
      {
        input: "data = 01, len = 1",
        output: "0xfeff",
        note: "마지막 바이트는 0x0100으로 더합니다.",
      },
    ],
    tags: ["C", "체크섬", "비트 연산"],
    minutes: 35,
  },
  {
    id: "db-latest-per-customer",
    domain: "database",
    language: "sql",
    difficulty: "중",
    kind: "refactoring",
    title: "고객별 최근 주문을 윈도 함수로 조회하기",
    summary:
      "같은 시각의 주문이 있으면 한 고객이 여러 번 나오는 상관 서브쿼리를 윈도 함수로 바꾸세요.",
    scenario:
      "PostgreSQL의 orders(id, customer_id, created_at, amount) 테이블에서 고객마다 가장 최근 주문 한 건을 보여 주는 화면이 있습니다. 아래 쿼리는 created_at이 같은 주문이 있으면 같은 고객이 여러 번 나오고, 주문이 많아질수록 느려집니다. id는 고유한 정수입니다. 화면이 사용하는 결과 열(customer_id, order_id, created_at, amount)은 유지해야 합니다.",
    requirements: [
      "ROW_NUMBER() 윈도 함수로 고객별 순위를 매겨 고객마다 정확히 한 행만 반환하세요.",
      "created_at이 가장 늦은 주문을 고르고, 같은 시각이면 id가 큰 주문을 고르세요.",
      "결과 열 이름과 순서는 customer_id, order_id, created_at, amount로 유지하고 customer_id 오름차순으로 정렬하세요.",
    ],
    starterCode: `SELECT o.customer_id, o.id AS order_id, o.created_at, o.amount
FROM orders o
WHERE o.created_at = (
  SELECT MAX(created_at) FROM orders WHERE customer_id = o.customer_id
);
`,
    hints: [
      "상관 서브쿼리는 MAX(created_at)과 같은 모든 행을 돌려줍니다. 같은 시각일 때 하나를 고를 기준이 필요합니다.",
      "PARTITION BY customer_id로 고객별 구간을 나누고 ORDER BY로 최신 순서를 정하세요.",
      "윈도 함수 결과는 같은 SELECT의 WHERE에서 쓸 수 없습니다. 서브쿼리나 CTE로 감싼 뒤 순위가 1인 행만 고르세요.",
    ],
    solution: `SELECT customer_id, order_id, created_at, amount
FROM (
  SELECT o.customer_id,
         o.id AS order_id,
         o.created_at,
         o.amount,
         ROW_NUMBER() OVER (
           PARTITION BY o.customer_id
           ORDER BY o.created_at DESC, o.id DESC
         ) AS recent_rank
  FROM orders o
) ranked
WHERE recent_rank = 1
ORDER BY customer_id;
`,
    explanation:
      "ROW_NUMBER는 같은 값이 있어도 구간마다 1부터 끊김 없는 번호를 매기므로 고객별로 정확히 한 행을 남길 수 있습니다. 정렬 기준에 고유한 id를 덧붙여 결과를 결정적으로 만듭니다. 테이블을 한 번 훑어 순위를 매기므로 고객마다 서브쿼리를 반복하는 방식보다 대체로 효율적이며, (customer_id, created_at DESC, id DESC) 인덱스가 있으면 더 빨라집니다. PostgreSQL의 DISTINCT ON으로도 같은 결과를 만들 수 있습니다.",
    examples: [
      {
        input: "고객 1: 주문 10(09:00), 주문 11(09:00) / 고객 2: 주문 12(08:00)",
        output: "(1, 11, 09:00, …), (2, 12, 08:00, …)",
        note: "같은 시각이면 id가 큰 주문 한 건만 남깁니다.",
      },
    ],
    tags: ["PostgreSQL", "윈도 함수", "리팩터링"],
    minutes: 20,
  },
  {
    id: "db-safe-insert",
    domain: "database",
    language: "javascript",
    difficulty: "중",
    kind: "refactoring",
    title: "문자열로 이어 붙인 SQL을 매개변수 쿼리로 바꾸기",
    summary:
      "값을 문자열에 직접 넣어 SQL 삽입 공격에 취약한 INSERT 생성 함수를 placeholder 방식으로 리팩터링하세요.",
    scenario:
      "Node.js 서비스가 여러 행을 한 번에 저장하려고 buildInsert(table, columns, rows)로 SQL을 만듭니다. 지금은 값을 따옴표로 감싸 문자열에 이어 붙여서, 이름에 작은따옴표가 들어가면 쿼리가 깨지고 공격자가 SQL을 주입할 수 있습니다. PostgreSQL 드라이버에 넘길 { text, values }를 반환하도록 바꾸세요. text는 INSERT INTO users (name, email) VALUES ($1, $2), ($3, $4) 형식입니다. 테이블과 열 이름은 placeholder로 넘길 수 없으므로 허용 목록 ALLOWED로 검사합니다.",
    requirements: [
      "값은 SQL 문자열에 넣지 말고 $1부터 행 순서대로 이어지는 placeholder를 만들어 values 배열에 같은 순서로 담으세요.",
      "table이 ALLOWED에 없거나 열 이름 중 하나라도 그 테이블의 허용 목록에 없으면 Error를 발생시키세요.",
      "rows가 비어 있거나 어떤 행의 값 개수가 columns 개수와 다르면 Error를 발생시키세요.",
    ],
    starterCode: `const ALLOWED = { users: ["name", "email", "age"], orders: ["user_id", "amount"] };

function buildInsert(table, columns, rows) {
  const values = rows
    .map((row) => "(" + row.map((value) => "'" + value + "'").join(", ") + ")")
    .join(", ");
  return {
    text: "INSERT INTO " + table + " (" + columns.join(", ") + ") VALUES " + values,
    values: [],
  };
}
`,
    hints: [
      "값을 SQL 문자열에 넣는 대신 위치 표시($1, $2 …)만 넣고 실제 값은 별도 배열로 넘기면 드라이버가 값으로만 전달합니다.",
      "placeholder 번호는 행이 바뀌어도 이어져야 합니다. values 배열의 길이를 번호로 쓰면 편리합니다.",
      "테이블과 열 이름은 placeholder로 바꿀 수 없으니 허용 목록과 정확히 비교하세요. Object.hasOwn으로 프로토타입 속성을 걸러 내세요.",
    ],
    solution: `const ALLOWED = { users: ["name", "email", "age"], orders: ["user_id", "amount"] };

function buildInsert(table, columns, rows) {
  const allowed = Object.hasOwn(ALLOWED, table) ? ALLOWED[table] : null;
  if (!allowed || columns.length === 0 || !columns.every((column) => allowed.includes(column))) {
    throw new Error("허용되지 않은 테이블 또는 열입니다.");
  }
  if (rows.length === 0 || rows.some((row) => row.length !== columns.length)) {
    throw new Error("행의 값 개수가 열 개수와 다릅니다.");
  }
  const values = [];
  const groups = rows.map((row) => {
    const marks = row.map((value) => {
      values.push(value);
      return "$" + values.length;
    });
    return "(" + marks.join(", ") + ")";
  });
  return {
    text: "INSERT INTO " + table + " (" + columns.join(", ") + ") VALUES " + groups.join(", "),
    values,
  };
}
`,
    explanation:
      "매개변수 쿼리는 SQL 구조와 값을 나누어 전달하므로 값에 따옴표나 SQL 구문이 들어 있어도 실행되지 않습니다. 반면 테이블과 열 같은 식별자는 매개변수로 바꿀 수 없어 허용 목록으로 검증해야 합니다. 행마다 번호를 이어 붙이면 한 번의 왕복으로 여러 행을 저장할 수 있습니다. 드라이버마다 placeholder 형식(? 또는 $1)이 다르므로 사용하는 라이브러리의 규칙을 따르세요.",
    examples: [
      {
        input: `buildInsert("users", ["name", "email"], [["O'Brien", "ob@example.com"]])`,
        output: `{ text: "INSERT INTO users (name, email) VALUES ($1, $2)", values: ["O'Brien", "ob@example.com"] }`,
        note: "작은따옴표가 있는 값도 SQL 문자열 밖의 values로 전달합니다.",
      },
    ],
    tags: ["JavaScript", "SQL 삽입", "매개변수 쿼리"],
    minutes: 25,
  },
  {
    id: "infra-ci-workflow",
    domain: "infra",
    language: "yaml",
    difficulty: "하",
    kind: "refactoring",
    title: "느리고 권한이 넓은 CI 워크플로 정리하기",
    summary:
      "매번 의존성을 새로 받고 쓰기 권한까지 가진 GitHub Actions 워크플로를 빠르고 안전하게 정리하세요.",
    scenario:
      "Node.js 22 프로젝트의 GitHub Actions 워크플로가 push와 pull_request마다 실행됩니다. package-lock.json이 있으며 린트와 테스트는 npm run lint, npm test로 실행합니다. 지금은 실행할 때마다 npm install로 의존성을 두 번 새로 받고, 같은 브랜치에 연달아 push하면 이전 실행이 끝까지 돌아갑니다. 이 워크플로는 저장소에 아무것도 쓰지 않습니다.",
    requirements: [
      "actions/setup-node의 npm 캐시와 npm ci를 사용해 잠금 파일 기준으로 의존성을 한 번만 설치하세요.",
      "워크플로의 GITHUB_TOKEN 권한을 contents: read로 제한하세요.",
      "같은 브랜치의 이전 실행은 concurrency로 취소하고, 작업에 timeout-minutes를 설정하세요.",
    ],
    starterCode: `name: ci
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm install
      - run: npm run lint
      - run: npm install
      - run: npm test
`,
    hints: [
      "npm install은 잠금 파일을 바꿀 수 있습니다. CI에서는 잠금 파일과 정확히 같은 버전을 설치하는 명령이 필요합니다.",
      "setup-node의 cache 옵션은 npm 캐시 폴더를 저장하고 복원합니다. 설치 단계는 한 번이면 충분합니다.",
      "워크플로 최상위의 permissions, concurrency(group, cancel-in-progress)와 작업의 timeout-minutes를 확인해 보세요.",
    ],
    solution: `name: ci
on: [push, pull_request]
permissions:
  contents: read
concurrency:
  group: \${{ github.workflow }}-\${{ github.ref }}
  cancel-in-progress: true
jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm test
`,
    explanation:
      "npm ci는 잠금 파일과 정확히 같은 버전을 설치하고 node_modules를 새로 만들어 실행 결과를 재현할 수 있게 합니다. setup-node의 npm 캐시는 내려받은 패키지를 재사용해 설치 시간을 줄입니다. 기본 토큰 권한을 읽기로 제한하면 의존성이 손상돼도 저장소를 바꿀 수 없습니다. concurrency와 시간 제한은 이미 의미가 없어진 실행과 멈춘 작업이 실행 시간을 낭비하는 것을 막습니다.",
    examples: [
      {
        input: "같은 브랜치에 두 번 연속 push",
        output: "첫 실행은 취소되고 마지막 실행만 끝까지 진행",
        note: "두 번째 실행은 캐시한 npm 패키지를 사용합니다.",
      },
    ],
    tags: ["GitHub Actions", "CI", "YAML", "권한"],
    minutes: 15,
  },
  {
    id: "infra-deploy-script",
    domain: "infra",
    language: "shell",
    difficulty: "중",
    kind: "debugging",
    title: "실패해도 계속 진행되는 배포 스크립트 고치기",
    summary:
      "빌드가 실패해도 배포를 이어 가고, 인자가 비면 엉뚱한 폴더를 지우는 Bash 스크립트를 안전하게 수정하세요.",
    scenario:
      "서버의 deploy.sh는 첫 번째 인자로 릴리스 이름을 받아 /srv/app/releases/<이름>에 빌드 결과를 복사하고 /srv/app/current 링크를 바꿉니다. 지난주 빌드가 실패했는데도 링크가 바뀌어 서비스가 중단됐고, 인자 없이 실행하면 releases 폴더 전체가 지워질 뻔했습니다. Bash 5와 GNU coreutils 환경이며 빌드는 npm run build, 결과물은 dist 폴더입니다.",
    requirements: [
      "명령이 실패하거나 정의되지 않은 변수를 쓰면 즉시 멈추도록 set -euo pipefail을 적용하세요.",
      "릴리스 이름이 없거나, 영문자나 숫자로 시작하지 않거나, 영문자·숫자·점·하이픈·밑줄 외의 문자가 있으면 사용법을 표준 오류로 출력하고 종료 코드 1로 끝내세요.",
      "경로 변수는 모두 큰따옴표로 감싸고, 빌드가 성공한 뒤에만 기존 폴더를 지우고 복사하며, current 링크는 임시 링크를 만든 뒤 한 번에 교체하세요.",
    ],
    starterCode: `#!/bin/bash
RELEASE=$1
TARGET=/srv/app/releases/$RELEASE

rm -rf $TARGET/
npm run build
mkdir -p $TARGET
cp -r dist/* $TARGET
ln -sfn $TARGET /srv/app/current
echo "deployed $RELEASE"
`,
    hints: [
      "Bash는 기본적으로 실패한 명령 뒤에도 다음 줄을 실행합니다. 스크립트 맨 위에서 실패 시 멈추는 옵션을 켜 보세요.",
      '변수가 비어 있으면 rm -rf $TARGET/는 releases 폴더 자체를 가리킵니다. 사용하기 전에 형식을 검사하고 "$변수"처럼 따옴표로 감싸세요.',
      "새 링크를 임시 이름으로 만든 뒤 mv -T로 바꾸면 링크 교체가 한 번에 일어납니다. 빌드는 기존 폴더를 지우기 전에 실행하세요.",
    ],
    solution: `#!/usr/bin/env bash
set -euo pipefail

release="\${1:-}"
if [[ ! "$release" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]]; then
  echo "usage: deploy.sh <release-name>" >&2
  exit 1
fi

root="/srv/app"
target="$root/releases/$release"

npm run build
rm -rf -- "$target"
mkdir -p -- "$target"
cp -R dist/. "$target/"
ln -sfn -- "$target" "$root/current.next"
mv -T -- "$root/current.next" "$root/current"
echo "deployed $release"
`,
    explanation:
      "set -e는 실패한 명령에서, set -u는 정의되지 않은 변수에서, pipefail은 파이프 중간의 실패에서 스크립트를 멈춥니다. 릴리스 이름을 허용 문자로 검사하고 첫 글자를 영문자나 숫자로 제한하면 빈 값이나 .. 같은 입력으로 다른 폴더를 지우는 일을 막습니다. 빌드가 성공한 뒤에 복사하고, 링크를 임시 이름으로 만든 다음 mv -T로 교체하면 배포 중에도 current가 깨진 상태로 남지 않습니다. set -e는 조건문 안의 실패처럼 멈추지 않는 경우가 있으므로 중요한 명령의 결과는 직접 확인하는 습관도 필요합니다.",
    examples: [
      {
        input: "./deploy.sh (인자 없음)",
        output: "표준 오류에 사용법 출력, 종료 코드 1, 삭제되는 파일 없음",
        note: "빈 릴리스 이름으로 releases 폴더를 지우지 않습니다.",
      },
      {
        input: "./deploy.sh v42 실행 중 npm run build 실패",
        output: "스크립트 중단, 기존 current 링크 유지",
        note: "실패한 빌드는 배포되지 않습니다.",
      },
    ],
    tags: ["Bash", "배포", "셸 스크립트"],
    minutes: 25,
  },
  {
    id: "mobile-offline-queue",
    domain: "mobile",
    language: "dart",
    difficulty: "중",
    kind: "debugging",
    title: "오프라인에서 보낸 요청이 사라지는 전송 대기열 고치기",
    summary:
      "연결이 끊긴 동안 쌓인 요청이 실패하면 사라지고 순서도 뒤섞입니다. 재시도 규칙을 지키도록 수정하세요.",
    scenario:
      "Flutter 메모 앱은 오프라인에서 작성한 변경을 PendingQueue에 넣었다가 연결되면 flush(send)로 서버에 보냅니다. send는 Future<bool>을 반환하며 true는 저장 성공, false는 일시적 실패입니다. 현재 코드는 대기열을 먼저 비운 뒤 모든 요청을 동시에 보내서, 실패한 요청은 사라지고 늦게 도착한 이전 변경이 서버의 최신 메모를 덮습니다. 플랫폼 API 없이 순수 Dart로 작성하세요.",
    requirements: [
      "flush는 대기열 앞에서부터 한 번에 하나씩 순서대로 보내고, 성공한 요청만 대기열에서 제거하세요.",
      "요청이 실패하면 그 요청의 attempts를 1 늘리고, 뒤의 요청은 보내지 않은 채 flush를 끝내세요.",
      "attempts가 maxAttempts에 도달한 요청은 대기열에서 빼서 failed 목록으로 옮기고 다음 요청을 계속 보내세요.",
      "flush가 진행 중일 때 다시 호출되면 중복 전송하지 말고 바로 반환하세요.",
    ],
    starterCode: `class PendingRequest {
  PendingRequest(this.id, this.body);
  final String id;
  final String body;
  int attempts = 0;
}

class PendingQueue {
  PendingQueue({this.maxAttempts = 3});
  final int maxAttempts;
  final List<PendingRequest> items = [];
  final List<PendingRequest> failed = [];

  void add(PendingRequest request) => items.add(request);

  Future<void> flush(Future<bool> Function(PendingRequest) send) async {
    final batch = List.of(items);
    items.clear();
    await Future.wait(batch.map(send));
  }
}
`,
    hints: [
      "Future.wait은 요청을 동시에 보내 도착 순서를 보장하지 않습니다. 앞의 요청이 끝난 뒤 다음 요청을 보내야 합니다.",
      "대기열을 먼저 비우면 실패한 요청을 되돌릴 방법이 없습니다. 성공을 확인한 뒤에 제거하세요.",
      "while 반복과 await로 하나씩 보내고, 진행 중 플래그를 try/finally로 관리하면 중복 실행과 예외를 함께 처리할 수 있습니다.",
    ],
    solution: `class PendingRequest {
  PendingRequest(this.id, this.body);
  final String id;
  final String body;
  int attempts = 0;
}

class PendingQueue {
  PendingQueue({this.maxAttempts = 3});
  final int maxAttempts;
  final List<PendingRequest> items = [];
  final List<PendingRequest> failed = [];
  bool _flushing = false;

  void add(PendingRequest request) => items.add(request);

  Future<void> flush(Future<bool> Function(PendingRequest) send) async {
    if (_flushing) return;
    _flushing = true;
    try {
      while (items.isNotEmpty) {
        final request = items.first;
        if (await send(request)) {
          items.removeAt(0);
          continue;
        }
        request.attempts += 1;
        if (request.attempts < maxAttempts) return;
        items.removeAt(0);
        failed.add(request);
      }
    } finally {
      _flushing = false;
    }
  }
}
`,
    explanation:
      "같은 메모의 변경은 순서가 의미를 가지므로 앞의 요청이 저장되기 전에는 뒤의 요청을 보내지 않습니다. 성공을 확인한 뒤에만 제거하면 연결이 다시 끊겨도 요청이 사라지지 않습니다. 계속 실패하는 요청은 별도 목록으로 옮겨 나머지 요청이 영원히 막히지 않게 하고, 사용자에게 다시 보내기를 안내할 수 있습니다. 실제 앱에서는 대기열을 기기 저장소에 보관해야 앱을 다시 시작해도 유지됩니다.",
    examples: [
      {
        input: "대기열 [A, B], maxAttempts = 3, A 전송 실패",
        output: "A.attempts = 1, 대기열 [A, B] 유지, B는 보내지 않음",
        note: "다음 flush에서 A부터 다시 보냅니다.",
      },
    ],
    tags: ["Dart", "Flutter", "오프라인", "재시도"],
    minutes: 30,
  },
  {
    id: "mobile-signup-validation",
    domain: "mobile",
    language: "swift",
    difficulty: "하",
    kind: "refactoring",
    title: "중첩된 회원가입 검증을 오류 타입으로 정리하기",
    summary:
      "첫 오류 문구만 반환하는 중첩 검증 함수를 모든 오류를 열거형 배열로 반환하는 순수 함수로 리팩터링하세요.",
    scenario:
      "iOS 앱의 회원가입 화면이 validate(email:password:)를 호출해 첫 번째 오류 문자열만 표시합니다. 비밀번호 규칙이 늘면서 if 문이 깊어졌고, 이제 화면에서 모든 문제를 한 번에 보여 주려 합니다. UIKit이나 SwiftUI 없이 동작하는 SignupError 열거형과 validate 함수를 작성하세요. 화면 문구는 화면 쪽에서 SignupError마다 정합니다.",
    requirements: [
      "SignupError 열거형에 emptyEmail, invalidEmail, shortPassword, missingNumber 경우를 정의하고 Equatable을 따르게 하세요.",
      "validate는 발견한 모든 오류를 [SignupError]로 반환하고, 문제가 없으면 빈 배열을 반환하세요. 이메일 오류가 비밀번호 오류보다 앞에 오게 하세요.",
      "앞뒤 공백을 제거한 이메일이 비면 emptyEmail, @가 정확히 하나가 아니거나 @ 앞뒤가 비면 invalidEmail, 비밀번호가 8자 미만이면 shortPassword, 0~9 숫자가 없으면 missingNumber를 넣으세요.",
    ],
    starterCode: `func validate(email: String, password: String) -> String? {
    if email.isEmpty {
        return "이메일을 입력하세요."
    } else {
        if !email.contains("@") {
            return "이메일 형식이 아닙니다."
        } else {
            if password.count < 8 {
                return "비밀번호는 8자 이상이어야 합니다."
            }
        }
    }
    return nil
}
`,
    hints: [
      "첫 오류에서 return하면 나머지 문제를 알 수 없습니다. 오류를 배열에 모아 마지막에 반환해 보세요.",
      "문자열 대신 열거형 값을 반환하면 화면 문구와 검증 규칙이 분리되고 테스트에서 ==로 비교할 수 있습니다.",
      'split(separator: "@", omittingEmptySubsequences: false)로 나누면 @의 개수와 앞뒤가 비었는지 함께 확인할 수 있습니다.',
    ],
    solution: `import Foundation

enum SignupError: Equatable {
    case emptyEmail
    case invalidEmail
    case shortPassword
    case missingNumber
}

func validate(email: String, password: String) -> [SignupError] {
    var errors: [SignupError] = []
    let trimmed = email.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmed.isEmpty {
        errors.append(.emptyEmail)
    } else {
        let parts = trimmed.split(separator: "@", omittingEmptySubsequences: false)
        if parts.count != 2 || parts[0].isEmpty || parts[1].isEmpty {
            errors.append(.invalidEmail)
        }
    }
    if password.count < 8 {
        errors.append(.shortPassword)
    }
    if !password.contains(where: { $0.isASCII && $0.isNumber }) {
        errors.append(.missingNumber)
    }
    return errors
}
`,
    explanation:
      "검증 결과를 열거형 배열로 반환하면 규칙과 화면 문구가 분리되어 문구 변경이나 다국어 처리가 쉬워지고, 모든 문제를 한 번에 보여 줄 수 있습니다. 중첩 조건을 독립된 검사로 펼치면 새 규칙을 추가해도 다른 규칙에 영향을 주지 않습니다. 이메일 형식은 최소한만 검사했으며, 실제로 받을 수 있는 주소인지는 인증 메일로 확인하는 것이 일반적입니다.",
    examples: [
      {
        input: 'validate(email: "  ", password: "abc")',
        output: "[.emptyEmail, .shortPassword, .missingNumber]",
        note: "첫 오류에서 멈추지 않고 모든 오류를 순서대로 반환합니다.",
      },
    ],
    tags: ["Swift", "입력 검증", "열거형"],
    minutes: 15,
  },
  {
    id: "data-rolling-mean",
    domain: "data",
    language: "python",
    difficulty: "하",
    kind: "implementation",
    title: "결측값을 건너뛰는 이동 평균 계산하기",
    summary:
      "센서 값에 None이 섞인 시계열에서 창 크기만큼의 이동 평균을 계산하는 함수를 작성하세요.",
    scenario:
      "공장 센서가 1분마다 온도를 기록하지만 통신 오류로 일부 값이 None입니다. 외부 라이브러리 없이 rolling_mean(values, window, min_count=1)을 작성하세요. 결과의 i번째 값은 i번째를 포함한 직전 window개 값 중 None이 아닌 값들의 평균입니다. 유효한 값이 min_count개보다 적으면 None을 넣습니다. 결과 길이는 입력과 같고, 값은 None이 아니면 유한한 실수입니다.",
    requirements: [
      "window와 min_count는 1 이상의 정수이고 min_count는 window 이하여야 합니다. 아니면 ValueError를 발생시키고 bool은 허용하지 마세요.",
      "각 위치에서 그 위치까지의 최근 window개 값 중 None을 제외하고 평균을 계산하세요. 시작 부분에서 창이 덜 찼으면 있는 값만 사용합니다.",
      "유효한 값이 min_count개 미만이면 None을 넣고, 입력 목록을 수정하지 말고, 매 위치에서 창 전체를 다시 더하지 않는 O(n) 방식으로 계산하세요.",
    ],
    starterCode: `def rolling_mean(values, window, min_count=1):
    result = []
    for i in range(len(values)):
        chunk = values[i - window + 1:i + 1]
        result.append(sum(chunk) / len(chunk))
    return result
`,
    hints: [
      "values[i - window + 1:i + 1]에서 시작 위치가 음수가 되면 목록의 뒤쪽을 가리킵니다. 시작 부분의 창을 다시 확인해 보세요.",
      "창에 들어오는 값은 더하고 창에서 빠지는 값은 빼면 매번 전체를 다시 더하지 않아도 됩니다. None은 합계와 개수에서 모두 제외하세요.",
      "i >= window일 때 values[i - window]가 창에서 빠집니다. 유효한 개수가 min_count 미만이면 None을 넣으세요.",
    ],
    solution: `def rolling_mean(values, window, min_count=1):
    for name, value in (("window", window), ("min_count", min_count)):
        if type(value) is not int or value < 1:
            raise ValueError(f"invalid {name}")
    if min_count > window:
        raise ValueError("min_count must not exceed window")
    result = []
    total = 0.0
    count = 0
    for i, value in enumerate(values):
        if value is not None:
            total += value
            count += 1
        if i >= window:
            old = values[i - window]
            if old is not None:
                total -= old
                count -= 1
        result.append(total / count if count >= min_count else None)
    return result
`,
    explanation:
      "합계와 유효한 값의 개수를 함께 유지하면 각 위치를 한 번씩만 처리해 O(n)으로 계산할 수 있습니다. 결측값을 0으로 바꾸면 평균이 낮아지므로 합계와 개수에서 모두 빼야 합니다. min_count는 값이 너무 적은 구간의 평균이 크게 흔들리는 것을 막습니다. 아주 긴 시계열에서는 덧셈과 뺄셈의 부동소수점 오차가 쌓일 수 있어 주기적으로 합계를 다시 계산하기도 합니다.",
    examples: [
      {
        input: "rolling_mean([1, None, 3, 5], 2)",
        output: "[1.0, 1.0, 3.0, 4.0]",
        note: "두 번째 위치는 유효한 값 1 하나의 평균입니다.",
      },
      {
        input: "rolling_mean([1, None, 3, 5], 2, min_count=2)",
        output: "[None, None, None, 4.0]",
        note: "유효한 값이 2개 이상인 창만 평균을 계산합니다.",
      },
    ],
    tags: ["Python", "시계열", "결측값"],
    minutes: 20,
  },
  {
    id: "data-daily-active",
    domain: "data",
    language: "sql",
    difficulty: "중",
    kind: "debugging",
    title: "부풀려진 일별 활성 사용자 수 바로잡기",
    summary:
      "같은 사용자를 여러 번 세고 UTC 날짜로 묶어 한국 기준 지표와 어긋나는 집계 쿼리를 수정하세요.",
    scenario:
      "PostgreSQL의 events(id, user_id, event_type, occurred_at) 테이블에 앱 이벤트가 쌓입니다. occurred_at은 timestamptz이고 event_type은 NULL이 아닙니다. 대시보드는 한국 시간 기준 날짜별 활성 사용자 수를 보여 줘야 하는데, 아래 쿼리는 이벤트 수를 세고 날짜도 세션 시간대(UTC)로 나눕니다. 활성 사용자는 그날 event_type이 'heartbeat'가 아닌 이벤트를 하나 이상 남긴 사용자입니다. 2026년 10월 한 달의 결과가 필요합니다.",
    requirements: [
      "occurred_at을 Asia/Seoul 시간대로 바꾼 날짜로 묶으세요.",
      "날짜마다 서로 다른 user_id의 수를 세고 heartbeat 이벤트는 제외하세요.",
      "한국 시간 2026-10-01 00:00 이상 2026-11-01 00:00 미만의 이벤트만 포함하되, 범위 조건은 occurred_at 열에 함수를 씌우지 않고 비교해 인덱스를 쓸 수 있게 하세요. 결과는 날짜 오름차순입니다.",
    ],
    starterCode: `SELECT DATE(occurred_at) AS day, COUNT(*) AS active_users
FROM events
WHERE DATE(occurred_at) BETWEEN '2026-10-01' AND '2026-10-31'
GROUP BY DATE(occurred_at)
ORDER BY day;
`,
    hints: [
      "COUNT(*)는 행 수를 셉니다. 한 사용자가 이벤트를 여러 번 남겨도 한 명으로 세려면 무엇이 필요할까요?",
      "timestamptz를 날짜로 바꿀 때 기준 시간대가 결과를 바꿉니다. AT TIME ZONE 'Asia/Seoul'을 먼저 적용하세요.",
      "WHERE에서 열에 함수를 씌우면 인덱스를 쓰기 어렵습니다. 한국 시간 경계를 timestamptz 상수로 만들어 >=, < 범위로 비교하세요.",
    ],
    solution: `SELECT (occurred_at AT TIME ZONE 'Asia/Seoul')::date AS day,
       COUNT(DISTINCT user_id) AS active_users
FROM events
WHERE occurred_at >= TIMESTAMPTZ '2026-10-01 00:00:00+09'
  AND occurred_at < TIMESTAMPTZ '2026-11-01 00:00:00+09'
  AND event_type <> 'heartbeat'
GROUP BY 1
ORDER BY 1;
`,
    explanation:
      "활성 사용자는 사람 수이므로 COUNT(DISTINCT user_id)로 중복을 없앱니다. 저장된 시각은 절대 시점이므로 보고 기준 시간대로 바꾼 뒤 날짜를 잘라야 한국 자정 전후의 이벤트가 올바른 날에 들어갑니다. 범위 조건을 열 자체에 적용하면 occurred_at 인덱스를 사용할 수 있고, 끝 경계를 '미만'으로 두면 마지막 날 23:59:59 이후의 시각도 빠뜨리지 않습니다.",
    examples: [
      {
        input:
          "사용자 7: 한국 시간 10월 1일 23:30에 이벤트 3개, 10월 2일 00:10에 이벤트 1개, heartbeat 다수",
        output: "2026-10-01: 1, 2026-10-02: 1",
        note: "UTC로 묶으면 두 시각이 모두 10월 1일로 들어갑니다.",
      },
    ],
    tags: ["PostgreSQL", "지표", "시간대"],
    minutes: 20,
  },
  {
    id: "security-escape-html",
    domain: "security",
    language: "javascript",
    difficulty: "하",
    kind: "implementation",
    title: "댓글을 안전하게 출력하는 HTML 이스케이프",
    summary:
      "사용자 댓글을 innerHTML로 넣는 화면에서 스크립트가 실행되지 않도록 특수 문자를 바꾸는 함수를 작성하세요.",
    scenario:
      "오래된 게시판 화면이 서버에서 받은 댓글을 문자열로 이어 붙여 innerHTML에 넣습니다. 당장 화면 구조를 바꾸기 어려워, 출력 직전에 텍스트를 HTML 문자 참조로 바꾸는 escapeHtml(value)를 JavaScript로 작성하려 합니다. 결과는 요소 내용과 큰따옴표로 감싼 속성값 양쪽에 쓰입니다.",
    requirements: [
      "&, <, >, \", '를 각각 &amp;, &lt;, &gt;, &quot;, &#39;로 바꾸고, 입력의 각 문자는 정확히 한 번만 바꾸세요. 예를 들어 <는 &amp;lt;가 아니라 &lt;가 되어야 합니다.",
      "null과 undefined는 빈 문자열로, 숫자와 불리언은 문자열로 바꾼 뒤 처리하세요.",
      "그 밖의 문자는 그대로 두고 한글과 이모지도 손상하지 마세요.",
    ],
    starterCode: `function escapeHtml(value) {
  return value.replace("<", "&lt;").replace(">", "&gt;");
}
`,
    hints: [
      "String.prototype.replace에 문자열을 넘기면 처음 하나만 바뀝니다.",
      "여러 문자를 차례로 replace하면 앞에서 만든 &lt;의 &가 다시 바뀔 수 있습니다. 한 번의 정규식으로 모든 특수 문자를 찾아 보세요.",
      "/[&<>\"']/g와 문자별 대응표를 함께 쓰고, null과 undefined는 먼저 빈 문자열로 바꾸세요.",
    ],
    solution: `const ENTITIES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

function escapeHtml(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return text.replace(/[&<>"']/g, (character) => ENTITIES[character]);
}
`,
    explanation:
      "정규식 하나로 모든 특수 문자를 찾아 대응표로 바꾸면 각 문자가 정확히 한 번만 처리됩니다. 따옴표까지 바꾸면 큰따옴표 속성값 안에서도 값이 속성 밖으로 벗어나지 못합니다. 이스케이프 방법은 출력 위치에 따라 달라서 URL, 스크립트, 스타일 안에서는 이 함수로 충분하지 않습니다. 가능하면 textContent나 프레임워크의 기본 출력처럼 HTML로 해석하지 않는 방법을 우선 사용하세요.",
    examples: [
      {
        input: 'escapeHtml("<b>굵게</b> & 기울임")',
        output: '"&lt;b&gt;굵게&lt;/b&gt; &amp; 기울임"',
        note: "모든 위치의 특수 문자를 한 번씩만 바꿉니다.",
      },
    ],
    tags: ["JavaScript", "XSS", "출력 인코딩"],
    minutes: 15,
  },
  {
    id: "security-token-check",
    domain: "security",
    language: "python",
    difficulty: "중",
    kind: "debugging",
    title: "API 토큰 비교에 숨은 취약점 고치기",
    summary:
      "평문 토큰을 저장하고 ==로 비교하는 인증 함수를 해시 저장과 상수 시간 비교로 수정하세요.",
    scenario:
      "내부 API는 요청 헤더의 토큰을 확인합니다. 지금은 토큰 원문을 설정 파일에 저장하고 ==로 비교해서, 응답 시간 차이로 토큰을 추측할 여지가 있고 설정 파일이 유출되면 토큰도 그대로 노출됩니다. 저장소에는 토큰의 SHA-256 16진수 해시만 남기기로 했습니다. Python 표준 라이브러리만 사용해 hash_token(token)과 verify_token(provided, stored_hash)를 작성하세요. 토큰은 32바이트 이상의 무작위 값이라 별도 솔트는 사용하지 않으며, stored_hash는 hash_token으로 만든 값입니다.",
    requirements: [
      "hash_token은 UTF-8로 인코딩한 토큰의 SHA-256 해시를 소문자 16진수 문자열로 반환하세요.",
      "verify_token은 provided가 str이 아니거나 비어 있거나 1024자를 넘으면 해시를 계산하지 않고 False를 반환하세요.",
      "해시끼리 비교할 때 hmac.compare_digest를 사용하고, 결과는 항상 bool로 반환하세요.",
    ],
    starterCode: `API_TOKEN = "s3cr3t-token-from-config"

def verify_token(provided):
    if provided == API_TOKEN:
        return True
    return provided
`,
    hints: [
      "== 비교는 처음 다른 글자에서 멈출 수 있어 응답 시간에 정보가 남을 수 있습니다.",
      "원문 대신 해시를 저장하면 저장소가 유출돼도 토큰을 바로 쓸 수 없습니다. 비교도 해시끼리 하세요.",
      "hashlib.sha256(...).hexdigest()와 hmac.compare_digest를 사용하고, 입력이 str인지 먼저 확인하세요.",
    ],
    solution: `import hashlib
import hmac


def hash_token(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def verify_token(provided, stored_hash):
    if not isinstance(provided, str) or not provided or len(provided) > 1024:
        return False
    return hmac.compare_digest(hash_token(provided), stored_hash)
`,
    explanation:
      "hmac.compare_digest는 입력 내용과 관계없이 비교 시간이 일정하도록 만들어져 시간 차이로 값을 추측하는 공격을 어렵게 합니다. 토큰 원문 대신 해시를 저장하면 설정이나 데이터베이스가 유출돼도 피해를 줄일 수 있습니다. 충분히 긴 무작위 토큰은 빠른 해시로도 무차별 대입이 현실적이지 않지만, 사람이 정하는 비밀번호에는 솔트와 bcrypt나 scrypt 같은 느린 해시가 필요합니다. 반환값을 bool로 고정하면 호출하는 쪽이 문자열을 참으로 해석하는 실수도 막을 수 있습니다.",
    examples: [
      {
        input: 'verify_token("s3cr3t-token", hash_token("s3cr3t-token"))',
        output: "True",
        note: "같은 토큰의 해시끼리 상수 시간으로 비교합니다.",
      },
      {
        input: "verify_token(None, stored_hash)",
        output: "False",
        note: "문자열이 아닌 입력은 해시를 계산하지 않고 거부합니다.",
      },
    ],
    tags: ["Python", "인증", "타이밍 공격"],
    minutes: 20,
  },
  {
    id: "sys-lower-bound",
    domain: "systems",
    language: "typescript",
    difficulty: "하",
    kind: "debugging",
    title: "끝나지 않는 이진 탐색 고치기",
    summary:
      "정렬된 배열에서 값이 들어갈 첫 위치를 찾는 함수가 일부 입력에서 멈추거나 잘못된 위치를 반환합니다.",
    scenario:
      "검색 서버가 정렬된 점수 배열에서 기준 점수 이상인 첫 위치를 찾아 순위를 계산합니다. lowerBound(items, target)는 items[i] >= target인 가장 작은 i를 반환해야 하며, 그런 값이 없으면 items.length를 반환합니다. items는 오름차순으로 정렬된 유한한 숫자 배열이고 같은 값이 여러 번 있을 수 있습니다. 현재 코드는 일부 입력에서 반복이 끝나지 않습니다.",
    requirements: [
      "items[i] >= target을 만족하는 가장 작은 인덱스를 반환하고, 같은 값이 여러 개면 그중 첫 위치를 반환하세요.",
      "모든 값이 target보다 작으면 items.length를, 빈 배열이면 0을 반환하세요.",
      "반복마다 탐색 범위가 반드시 줄어들게 해 O(log n) 안에 끝나게 하고 입력 배열을 수정하지 마세요.",
    ],
    starterCode: `function lowerBound(items: number[], target: number): number {
  let low = 0;
  let high = items.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (items[middle] < target) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }
  return low;
}
`,
    hints: [
      "low = middle로 두면 두 원소만 남았을 때 middle이 계속 low와 같아질 수 있습니다.",
      "탐색 범위를 [low, high) 반열린 구간으로 정의하면 '그런 값이 없음'을 items.length로 자연스럽게 표현할 수 있습니다.",
      "items[middle] < target이면 low = middle + 1, 아니면 high = middle로 두고 high는 items.length에서 시작하세요.",
    ],
    solution: `function lowerBound(items: number[], target: number): number {
  let low = 0;
  let high = items.length;
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2);
    if (items[middle] < target) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low;
}
`,
    explanation:
      "반열린 구간 [low, high)에서는 middle이 항상 high보다 작으므로 두 분기 모두 범위를 줄여 반복이 끝납니다. 조건을 만족하는 위치에서 high를 middle로 당기면 같은 값 중 첫 위치를 찾습니다. low + (high - low) / 2 형태는 고정 크기 정수를 쓰는 언어에서 오버플로를 피하는 관례입니다.",
    examples: [
      {
        input: "lowerBound([1, 3, 3, 5], 3)",
        output: "1",
        note: "같은 값이 여러 개면 첫 위치를 반환합니다.",
      },
      {
        input: "lowerBound([1, 2, 4], 10)",
        output: "3",
        note: "모든 값이 작으면 배열 길이를 반환합니다.",
      },
    ],
    tags: ["TypeScript", "이진 탐색", "경계 조건"],
    minutes: 15,
  },
  {
    id: "sys-ring-buffer",
    domain: "systems",
    language: "rust",
    difficulty: "중",
    kind: "implementation",
    title: "고정 크기 링 버퍼 구현하기",
    summary:
      "메모리를 더 할당하지 않고 가장 오래된 값을 덮어쓰는 고정 크기 버퍼를 Rust로 구현하세요.",
    scenario:
      "임베디드 장치의 로그 수집기가 최근 로그만 유지하려 합니다. 표준 라이브러리만 사용해 RingBuffer<T>를 구현하세요. new(capacity)로 만들고, push는 값을 넣되 가득 차면 가장 오래된 값을 덮어쓰고 그 값을 돌려줍니다. pop은 가장 오래된 값을 꺼냅니다. 생성 후에는 저장 공간을 다시 할당하지 않아야 합니다.",
    requirements: [
      "capacity가 0이면 None을, 아니면 Some(RingBuffer)를 반환하세요.",
      "push는 공간이 있으면 None을, 가득 찼으면 덮어쓴 가장 오래된 값을 Some으로 반환하세요.",
      "pop은 가장 오래된 값부터 꺼내고 비어 있으면 None을 반환하며, len과 is_empty가 현재 개수를 정확히 반영하게 하세요.",
      "생성 이후 push와 pop에서 메모리를 새로 할당하지 말고, T에 Clone이나 Default를 요구하지 마세요.",
    ],
    starterCode: `pub struct RingBuffer<T> {
    items: Vec<T>,
    capacity: usize,
}

impl<T> RingBuffer<T> {
    pub fn new(capacity: usize) -> Option<Self> {
        Some(RingBuffer { items: Vec::new(), capacity })
    }

    pub fn push(&mut self, value: T) -> Option<T> {
        self.items.push(value);
        None
    }

    pub fn pop(&mut self) -> Option<T> {
        self.items.pop()
    }

    pub fn len(&self) -> usize {
        self.items.len()
    }
}
`,
    hints: [
      "Vec::push는 공간이 부족하면 다시 할당합니다. 생성할 때 capacity 크기의 칸을 미리 만들어 두세요.",
      "가장 오래된 위치(head)와 현재 개수(len)만 알면 다음에 쓸 위치를 (head + len) % capacity로 계산할 수 있습니다.",
      "칸을 Option<T>로 두면 Default 없이도 빈칸을 표현할 수 있고, Option::replace와 Option::take로 값을 옮길 수 있습니다.",
    ],
    solution: `pub struct RingBuffer<T> {
    slots: Vec<Option<T>>,
    head: usize,
    len: usize,
}

impl<T> RingBuffer<T> {
    pub fn new(capacity: usize) -> Option<Self> {
        if capacity == 0 {
            return None;
        }
        let mut slots = Vec::with_capacity(capacity);
        slots.resize_with(capacity, || None);
        Some(RingBuffer { slots, head: 0, len: 0 })
    }

    pub fn push(&mut self, value: T) -> Option<T> {
        let capacity = self.slots.len();
        let tail = (self.head + self.len) % capacity;
        let replaced = self.slots[tail].replace(value);
        if self.len == capacity {
            self.head = (self.head + 1) % capacity;
        } else {
            self.len += 1;
        }
        replaced
    }

    pub fn pop(&mut self) -> Option<T> {
        if self.len == 0 {
            return None;
        }
        let value = self.slots[self.head].take();
        self.head = (self.head + 1) % self.slots.len();
        self.len -= 1;
        value
    }

    pub fn len(&self) -> usize {
        self.len
    }

    pub fn is_empty(&self) -> bool {
        self.len == 0
    }
}
`,
    explanation:
      "시작 위치와 개수만으로 원형 배열을 관리하면 push와 pop이 모두 O(1)이고 생성 이후 할당이 없습니다. 칸을 Option<T>로 두면 T에 Default나 Clone을 요구하지 않고도 빈칸을 표현하며, replace로 덮어쓴 값을 호출한 쪽에 돌려줄 수 있습니다. 가득 찼을 때 head를 한 칸 옮기면 그다음으로 오래된 값이 꺼낼 차례가 됩니다.",
    examples: [
      {
        input: "capacity = 2; push(1); push(2); push(3); pop()",
        output: "push(3)은 Some(1), pop()은 Some(2)",
        note: "가득 찬 뒤에는 가장 오래된 값을 덮어씁니다.",
      },
    ],
    tags: ["Rust", "자료구조", "링 버퍼"],
    minutes: 30,
  },
];
