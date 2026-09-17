"use client";
import { ACTION_LABELS, type Action, type Mission } from "@/lib/learn/catalog";
import { simulate } from "@/lib/learn/simulation";
export function SimulationView({
  mission,
  actions,
  fix = "",
  onAction,
}: {
  mission: Mission;
  actions: Action[];
  fix?: string;
  onAction: (a: Action) => void;
}) {
  const s = simulate(mission, actions, fix);
  return (
    <section className="simulator" aria-label="교육용 앱">
      <div className="simulator-bar">
        <span>
          <i /> 교육용 모의 앱
        </span>
        <span>{s.online ? "연결됨" : "오프라인"}</span>
      </div>
      <div className="simulator-screen">
        {(mission.app === "memo" || mission.app === "request") && (
          <>
            <h3>나의 메모</h3>
            <div className="sim-note">{s.memo || "저장된 메모가 없습니다."}</div>
            <div className="sim-flow">
              <span>화면</span>
              <b>→</b>
              <span>요청 {s.online ? "가능" : "끊김"}</span>
              <b>→</b>
              <span>모의 서버</span>
            </div>
            <p>
              서버 저장: <strong>{s.stored ? "메모 1개" : "0개"}</strong>
            </p>
          </>
        )}
        {mission.app === "access" && (
          <>
            <h3>회원 전용 게시판</h3>
            <p>
              현재 사용자 <strong>{s.actor}</strong>
            </p>
            <div className="sim-note">
              지민의 비공개 글 🔒<small>목록 버튼을 숨겨도 직접 요청은 가능합니다.</small>
            </div>
          </>
        )}
        {mission.app === "price" && (
          <>
            <h3>작은 문구점</h3>
            <p>노트 10,000원 / 3개부터 10% 할인</p>
            <div className="sim-number">
              {s.amount === null ? "수량 오류" : `${s.amount.toLocaleString("ko-KR")}원`}
            </div>
            <p>수량: {s.quantity}</p>
          </>
        )}
        {mission.app === "filter" && (
          <>
            <h3>출시 준비</h3>
            <ul className="sim-todos">
              {(s.filtered ? s.todos.filter((t) => t.done) : s.todos).map((t) => (
                <li key={t.title}>
                  {t.done ? "✓" : "□"} {t.title}
                </li>
              ))}
            </ul>
            <p>
              원본 {s.todos.length}개 / {s.filtered ? "완료만 표시" : "전체 표시"}
            </p>
          </>
        )}
        {mission.app === "search" && (
          <>
            <h3>반려동물 검색</h3>
            <div className="sim-note">
              검색어: {s.query || "입력 전"}
              <br />
              표시 결과: {s.result || "없음"}
            </div>
            <p>대기 중: {s.pending.join(", ") || "없음"}</p>
          </>
        )}
        {mission.app === "booking" && (
          <>
            <h3>작은 스튜디오 예약</h3>
            <div className="sim-number">{s.bookings.length}건 접수</div>
            <p>{s.bookings.join(" / ") || "아직 예약이 없습니다."}</p>
          </>
        )}
        <p className="sim-message" role="status">
          {s.message}
        </p>
      </div>
      <div className="sim-actions">
        {mission.actions.map((a) => (
          <button
            className="secondary-button"
            key={a}
            disabled={actions.length >= 80}
            onClick={() => onAction(a)}
          >
            {mission.app === "filter" && a === "refresh" ? "전체 다시 보기" : ACTION_LABELS[a]}
          </button>
        ))}
      </div>
      <p className="learn-fineprint">
        실제 연결이나 계정에 영향을 주지 않습니다. 미리 설계한 앱의 동작을 재현합니다.
      </p>
    </section>
  );
}
