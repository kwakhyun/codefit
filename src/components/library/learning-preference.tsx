"use client";
import Link from "next/link";
import { useLearningPreference } from "@/hooks/use-learning-preference";
import { preferredDestinations, type LearningPreference } from "@/lib/learning-preference";
export function LearningPreferencePicker() {
  const { preference, setPreference } = useLearningPreference();
  const next = preferredDestinations(preference)[0];
  return (
    <section
      className="learning-preference"
      id="learning-preference"
      aria-label="나에게 맞는 시작점"
    >
      <div className="preference-fields">
        <label>
          개발 경험
          <select
            value={preference.experience}
            onChange={(e) =>
              setPreference({
                ...preference,
                experience: e.target.value as LearningPreference["experience"],
              })
            }
          >
            <option value="beginner">비개발자 / 코드가 아직 낯설어요</option>
            <option value="developer">개발자 / 코드를 읽고 수정해요</option>
          </select>
        </label>
        <label>
          지금 하고 싶은 일
          <select
            value={preference.purpose}
            onChange={(e) =>
              setPreference({
                ...preference,
                purpose: e.target.value as LearningPreference["purpose"],
              })
            }
          >
            <option value="learn">원리와 코드를 배우고 싶어요</option>
            <option value="project">만든 서비스를 점검하고 싶어요</option>
          </select>
        </label>
      </div>
      <p className="muted">
        이 브라우저에 선택을 기억합니다. 언제든 바꿀 수 있고 모든 메뉴를 이용할 수 있습니다.
      </p>
      <div className="preference-next" aria-live="polite">
        <div>
          <span className="eyebrow">선택에 맞는 시작점</span>
          <h2>{next.label}</h2>
          <p>{next.description}</p>
        </div>
        <Link className="primary-button" href={next.href}>
          {next.label} 시작 →
        </Link>
      </div>
    </section>
  );
}
