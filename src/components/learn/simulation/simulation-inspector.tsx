import type { Mission } from "@/lib/learn/catalog";
import type { Simulation } from "@/lib/learn/simulation";
export function SimulationInspector({
  mission,
  state: s,
}: {
  mission: Mission;
  state: Simulation;
}) {
  return (
    <details className="sim-inspector">
      <summary>서비스 내부 상태 보기</summary>
      {mission.service && (
        <p>
          선택한 데이터: <b>{mission.service.samples[s.service.selected].label}</b>
          <br />
          처리 기록: <b>{s.service.history.length}건</b>
          <br />
          최근 결과: <b>{s.service.result?.detail || "아직 처리하지 않음"}</b>
        </p>
      )}
      {(mission.app === "memo" || mission.app === "request") && (
        <p>
          서버에 저장된 데이터: <b>{s.stored ? "1건" : "0건"}</b>
          <br />
          현재 브라우저에 저장된 데이터: <b>{s.browserMemo ? "1건" : "0건"}</b>
        </p>
      )}
      {mission.app === "access" && (
        <p>
          글 소유자: <b>지민</b> / 현재 사용자: <b>{s.actor}</b>
        </p>
      )}
      {mission.app === "price" && (
        <p>
          입력 수량: <b>{s.quantity}</b> / 계산 결과: <b>{s.amount ?? "입력 오류"}</b>
        </p>
      )}
      {mission.app === "filter" && (
        <p>
          원본 데이터: <b>{s.todos.length}개</b> / 표시한 데이터:{" "}
          <b>{(s.filtered ? s.todos.filter((t) => t.done) : s.todos).length}개</b>
        </p>
      )}
      {mission.app === "search" && (
        <p>
          응답 대기: <b>{s.pending.join(", ") || "없음"}</b>
          <br />
          검색어: {s.query || "없음"} / 표시된 결과: {s.result || "없음"}
        </p>
      )}
      {mission.app === "booking" && (
        <p>
          접수된 요청: <b>{s.bookings.join(" / ") || "없음"}</b>
        </p>
      )}
    </details>
  );
}
