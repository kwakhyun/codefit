"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { LearningStatus } from "@/lib/project-check/learning-generation";
import { generateLearning } from "@/lib/project-check/generate-learning";
import { RenewProject } from "@/components/project-check/renew-project";
import { api, errorMessage } from "@/lib/client-api";
import type { Check, CheckOverview } from "@/lib/project-check/types";
import type { GeneratedPractice, PracticeMode } from "@/lib/project-check/generated-practice";
import {
  AppLink,
  Button,
  Card,
  FieldLabel,
  Input,
  NativeSelect,
  Textarea,
} from "@/components/ui/primitives";
import { ScreenSkeleton } from "@/components/ui/skeleton";
import { RequestStatus } from "@/components/project-check/request-status";
import { ExerciseRunner } from "./exercise-runner";

export function ProjectPracticeApp() {
  const params = useSearchParams();
  const id = params.get("check"),
    mode: PracticeMode = params.get("mode") === "service" ? "service" : "code";
  const [data, setData] = useState<CheckOverview>();
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    api<CheckOverview>("/api/project-check", { scope: null, signal: controller.signal })
      .then((value) => {
        if (!controller.signal.aborted) {
          setData(value);
          setError("");
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(errorMessage(e));
      });
    return () => controller.abort();
  }, [revision]);
  useEffect(() => {
    const refresh = () => {
      setRevision((n) => n + 1);
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("codefit:backup-imported", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("codefit:backup-imported", refresh);
    };
  }, []);
  return (
    <>
      {error && (
        <Card role="alert">
          <p>{error}</p>
          <Button onClick={() => setRevision((n) => n + 1)}>다시 불러오기</Button>
        </Card>
      )}
      {!data && !error && <ScreenSkeleton variant="lesson" label="내 프로젝트 연습 불러오는 중" />}
      {data && (
        <PracticeWorkspace
          key={`${data.scope}:${id ?? "new"}`}
          data={data}
          id={id}
          mode={mode}
          onUsage={() => setRevision((n) => n + 1)}
        />
      )}
    </>
  );
}
function PracticeWorkspace({
  data,
  id,
  mode,
  onUsage,
}: {
  data: CheckOverview;
  id: string | null;
  mode: PracticeMode;
  onUsage: () => void;
}) {
  const [check, setCheck] = useState<Check>();
  const [saved, setSaved] = useState<GeneratedPractice | null>();
  const [progress, setProgress] = useState({ completed: 0, canRecover: false });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [reload, setReload] = useState(0);
  const [checks, setChecks] = useState(data.checks);
  const [cursor, setCursor] = useState(data.nextCursor);
  const [paging, setPaging] = useState(false);
  const active = useRef(false);
  const requestId = useRef<string | null>(null);
  const endpoint = `/api/project-check/${id}/practice`;
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    Promise.all([
      api<Check>(`/api/project-check/${id}`, { scope: data.scope, signal: controller.signal }),
      api<LearningStatus<GeneratedPractice>>(`${endpoint}?stepwise=true`, {
        scope: data.scope,
        signal: controller.signal,
      }),
    ])
      .then(([record, practice]) => {
        if (!controller.signal.aborted) {
          setCheck(record);
          setSaved(practice.result);
          setProgress(practice);
          setError("");
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(errorMessage(e));
      });
    return () => controller.abort();
  }, [id, data.scope, endpoint, reload]);
  function select(value: string) {
    const target = new URL(window.location.href);
    if (value) target.searchParams.set("check", value);
    else target.searchParams.delete("check");
    window.history.pushState(null, "", target);
  }
  async function loadMore() {
    if (!cursor || paging) return;
    setPaging(true);
    try {
      const next = await api<CheckOverview>(
        `/api/project-check?cursor=${encodeURIComponent(cursor)}`,
        { scope: data.scope },
      );
      setChecks((current) => [
        ...current,
        ...next.checks.filter((c) => !current.some((p) => p.id === c.id)),
      ]);
      setCursor(next.nextCursor);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPaging(false);
    }
  }
  async function run(generate: boolean) {
    if (active.current) return;
    active.current = true;
    setBusy(
      generate
        ? "실제 코드에 맞는 두 가지 연습을 만들고 있습니다"
        : "저장소에서 학습할 코드를 읽고 있습니다",
    );
    setError("");
    try {
      if (generate) {
        setSaved(await generateLearning<GeneratedPractice>(endpoint, data.scope, setBusy));
      } else {
        requestId.current ??= crypto.randomUUID();
        const record = await api<Check>("/api/project-check", {
          method: "POST",
          scope: data.scope,
          body: { url, description, requestId: requestId.current, source: "repository" },
        });
        select(record.id);
      }
    } catch (e) {
      setError(errorMessage(e));
      if (generate) {
        try {
          const status = await api<LearningStatus<GeneratedPractice>>(`${endpoint}?stepwise=true`, {
            scope: data.scope,
          });
          setProgress(status);
          if (status.result) setSaved(status.result);
        } catch {
          /* Keep the original error; the manual reload remains available. */
        }
      }
    } finally {
      active.current = false;
      setBusy("");
      onUsage();
    }
  }
  const repositories = checks.filter((c) => c.page.source === "repository");
  return (
    <div className="project-practice-workspace">
      <nav className="practice-origin" aria-label="프로젝트 연습 종류">
        <AppLink href={id ? `/projects?class=${id}` : "/projects"}>내 프로젝트</AppLink>
        <AppLink
          aria-current={mode === "code" ? "page" : undefined}
          href={`/project-practice?mode=code${id ? `&check=${id}` : ""}`}
        >
          코드 이해 훈련
        </AppLink>
        <AppLink
          aria-current={mode === "service" ? "page" : undefined}
          href={`/project-practice?mode=service${id ? `&check=${id}` : ""}`}
        >
          서비스 동작 실습
        </AppLink>
        <AppLink href={mode === "code" ? "/handoff?source=sample" : "/learn?source=sample"}>
          샘플 체험으로 이동
        </AppLink>
      </nav>
      {error && (
        <Card role="alert">
          <p>{error}</p>
          {id && (
            <Button disabled={!!busy} onClick={() => setReload((n) => n + 1)}>
              저장된 기록 다시 불러오기
            </Button>
          )}
        </Card>
      )}
      {busy && <RequestStatus label={busy} />}
      {!id ? (
        <Card className="practice-connect">
          <h2>어떤 프로젝트로 연습할까요?</h2>
          {repositories.length > 0 && (
            <>
              <FieldLabel htmlFor="practice-record">분석한 저장소에서 이어가기</FieldLabel>
              <NativeSelect
                id="practice-record"
                value=""
                disabled={!!busy}
                onChange={(e) => select(e.target.value)}
              >
                <option value="">프로젝트 선택</option>
                {repositories.map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.analysis.title}
                  </option>
                ))}
              </NativeSelect>
            </>
          )}
          {cursor && (
            <Button disabled={paging || !!busy} onClick={loadMore}>
              {paging ? "불러오는 중…" : "이전 프로젝트 더 보기"}
            </Button>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(false);
            }}
          >
            <FieldLabel htmlFor="practice-repo">공개 소스 저장소 주소</FieldLabel>
            <Input
              id="practice-repo"
              type="url"
              required
              placeholder="https://github.com/owner/repository"
              value={url}
              disabled={!!busy}
              onChange={(e) => {
                setUrl(e.target.value);
                requestId.current = null;
              }}
            />
            <FieldLabel htmlFor="practice-description">
              중점적으로 이해하고 싶은 기능 <span className="muted">선택</span>
            </FieldLabel>
            <Textarea
              id="practice-description"
              rows={3}
              maxLength={2000}
              value={description}
              disabled={!!busy}
              onChange={(e) => {
                setDescription(e.target.value);
                requestId.current = null;
              }}
              placeholder="예: 사용자가 탈퇴하면 접근 권한이 어떻게 바뀌는지 알고 싶어요."
            />
            <p className="muted">
              수집한 공개 코드와 설명을 OpenAI에 보내 연습을 만듭니다. 분석할 권한이 있는 프로젝트만
              입력해 주세요.
            </p>
            <p className="muted">
              비공개 저장소는 지원하지 않습니다. 비밀키나 사용자 데이터를 입력하지 마세요. 저장소
              분석 1회, 다음 단계의 연습 생성 1회를 사용합니다. 현재 분석{" "}
              {data.usage.analysis.remaining}회 남음.
            </p>
            <Button
              type="submit"
              className="primary-button"
              disabled={!!busy || !data.aiReady || data.usage.analysis.remaining < 2}
            >
              저장소 분석하기
            </Button>
            {data.usage.analysis.remaining < 2 && (
              <p role="status">
                새 저장소 분석과 연습 생성에는 총 2회가 필요합니다. 이미 분석한 저장소를 선택하거나
                한도 초기화 후 다시 이용해 주세요.
              </p>
            )}
            {!data.aiReady && (
              <p role="status">
                지금은 새 AI 분석을 준비 중입니다. 저장된 실습이나 샘플 체험을 이용해 주세요.
              </p>
            )}
          </form>
        </Card>
      ) : !check || saved === undefined ? (
        !error && <ScreenSkeleton variant="lesson" label="코드와 실습 불러오는 중" />
      ) : !check.page.repository ? (
        <Card>
          <h2>공개 저장소를 선택해 주세요</h2>
          <p>
            서비스 주소만 분석한 기록에는 코드가 없습니다. 공개 소스 저장소를 연결하면 맞춤 연습을
            만들 수 있습니다.
          </p>
          <Button onClick={() => select("")}>저장소 연결하기</Button>
        </Card>
      ) : (
        <>
          <div className="practice-project">
            <div>
              <strong>{check.page.repository.name}</strong>
              <p className="muted">
                코드 기준 {check.page.repository.commit.slice(0, 7)} ·{" "}
                {check.page.repository.files.length}개 파일 일부 분석
              </p>
            </div>
            <Button disabled={!!busy} onClick={() => select("")}>
              프로젝트 변경
            </Button>
          </div>
          {!saved ? (
            <Card className="practice-connect">
              <h2>내 코드로 두 가지 연습 만들기</h2>
              {progress.completed > 0 && (
                <p role="status">
                  {progress.completed}/2단계 저장됨
                  {progress.canRecover
                    ? " · AI 호출 없이 결과를 복구할 수 있어요."
                    : " · 남은 단계부터 이어갑니다."}
                </p>
              )}
              <p>
                코드 흐름을 읽는 훈련 3개와 서비스 동작을 비교하는 실습 3개를 함께 만듭니다. 분석한
                코드 버전을 기준으로 저장하며, 이후 저장소 변경 사항은 새 분석에서 반영합니다.
              </p>
              <p>
                생성 시 분석 1회 사용 · 현재 {data.usage.analysis.remaining}회 남음. 답변 저장과
                이어하기에는 AI 횟수를 사용하지 않습니다.
              </p>
              <p>
                두 단계로 준비하며 완료한 단계는 저장합니다. 연결이 끊겨도 다시 누르면 남은 단계부터
                진행합니다.
              </p>
              <p className="muted">
                수집한 공개 코드와 설명을 OpenAI에 보내 연습을 만듭니다. 분석할 권한이 있는
                프로젝트만 입력해 주세요.
              </p>
              <Button
                className="primary-button"
                disabled={
                  !!busy ||
                  (!progress.canRecover && (!data.aiReady || data.usage.analysis.remaining < 1))
                }
                onClick={() => run(true)}
              >
                {progress.canRecover
                  ? "저장된 결과 복구"
                  : error || progress.completed
                    ? "저장된 단계부터 이어서 생성"
                    : "맞춤 연습 6개 만들기"}
              </Button>
              {data.usage.analysis.remaining < 1 && !progress.canRecover && (
                <p role="status">
                  분석 횟수를 모두 사용했습니다.{" "}
                  {data.usage.analysis.resetsAt
                    ? `${new Date(data.usage.analysis.resetsAt).toLocaleString("ko-KR")} 이후 다시 이용할 수 있습니다.`
                    : "한도가 초기화된 뒤 다시 이용해 주세요."}
                </p>
              )}
            </Card>
          ) : (
            <ExerciseRunner
              key={mode}
              check={check}
              mode={mode}
              saved={saved}
              scope={data.scope}
              onSaved={setSaved}
            />
          )}
          {saved && (
            <RenewProject
              check={check}
              scope={data.scope}
              destination={`/project-practice?mode=${mode}`}
              disabled={!!busy}
            />
          )}
          <AppLink href={`/project-check?check=${id}`}>프로젝트 점검과 분석 범위 보기 →</AppLink>
        </>
      )}
    </div>
  );
}
