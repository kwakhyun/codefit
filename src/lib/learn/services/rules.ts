import { REJECTION_MESSAGES } from "./messages";
import type { ServiceCase, ServiceResult } from "./types";
/** Deliberately faulty rules are executable, never generated JavaScript or expected-answer lookup. */
export function evaluateService(c: ServiceCase, index: number, fix: string): ServiceResult {
  const [a, b, d] = c.samples[index].values;
  const repaired = fix === "rule";
  let allowed = true;
  let amount: number | undefined;
  switch (c.id) {
    case "shop-coupon":
      allowed = (repaired ? a : a + b) >= 30000;
      amount = a + b - 5000;
      break;
    case "shop-shipping":
      amount = a - b + ((repaired ? a - b : a) >= 50000 ? 0 : 3000);
      break;
    case "shop-stock":
      allowed = b <= (repaired ? 5 - a : 5);
      break;
    case "shop-points":
      allowed = Number.isInteger(b) && b >= 0 && b <= (repaired ? Math.min(a, 20000) : 20000);
      amount = 20000 - b;
      break;
    case "booking-capacity":
      allowed = (repaired ? a + b : b) <= 8;
      break;
    case "booking-overlap":
      allowed = repaired ? !(a < 16 && b > 14) : a !== 14;
      break;
    case "booking-cancel":
      amount = (repaired ? a >= 24 : a > 24) ? 0 : 30000;
      break;
    case "booking-guests":
      allowed = a <= 6;
      amount = 60000 + (repaired ? Math.max(0, a - 2) : Number(a > 2)) * 10000;
      break;
    case "work-permission":
      allowed = !!a && (!repaired || !!b);
      break;
    case "work-budget":
      allowed = a + d + (repaired ? b : 0) <= 1000000;
      break;
    case "work-revision":
      allowed = !repaired || a === 4;
      break;
    case "work-dependency":
      allowed = repaired ? !!a && !!b : !!a || !!b;
      break;
    case "content-expiry":
      allowed = !repaired || a > 0;
      break;
    case "content-unsubscribe":
      allowed = repaired ? !!a && !!b : !!a;
      break;
    case "content-schedule":
      amount = repaired ? a - 9 : a;
      break;
    case "content-segment":
      allowed = repaired ? !!a && b <= 30 : !!a || b <= 30;
      break;
    case "support-refund":
      allowed = b <= (repaired ? 50000 - a : 50000);
      break;
    case "support-attachment":
      allowed = !!a && (!repaired || b <= 5);
      break;
    case "support-export":
      allowed = !!b && (!repaired || !!a);
      break;
    case "support-close":
      allowed = repaired ? !!b : !!a;
      break;
    default:
      throw new Error(`Unregistered service rule: ${c.id}`);
  }
  if (fix === "block") allowed = false;
  const result = { allowed, ...(allowed && amount !== undefined ? { amount } : {}) };
  return { ...result, detail: describeResult(c, result) };
}
export function describeResult(c: ServiceCase, result: { allowed: boolean; amount?: number }) {
  if (!result.allowed)
    return REJECTION_MESSAGES[c.id] || "처리할 수 없습니다. 이용 조건을 확인해 주세요.";
  if (c.id === "content-schedule" && result.amount !== undefined) {
    const previousDay = result.amount < 0;
    return `저장 시각: UTC 9월 ${previousDay ? 19 : 20}일 ${String((result.amount + 24) % 24).padStart(2, "0")}:00`;
  }
  if (result.amount !== undefined)
    return `${c.id === "booking-cancel" ? "취소 수수료" : "최종 금액"}: ${result.amount.toLocaleString("ko-KR")}원`;
  return `${c.operation} 완료`;
}

export function matchesServicePolicy(
  actual: Pick<ServiceResult, "allowed" | "amount">,
  expected: Pick<ServiceResult, "allowed" | "amount">,
) {
  return actual.allowed === expected.allowed && actual.amount === expected.amount;
}
