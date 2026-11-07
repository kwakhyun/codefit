"use client";
import { useGenerationRevision } from "@/hooks/use-generation-revision";
import { useProjectOverview } from "@/hooks/use-project-overview";
import { startProjectAnalysis } from "@/lib/project-analysis-tasks";
import { useEffect, useId, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { LearningStatus } from "@/lib/project-check/learning-generation";
import { generateLearning } from "@/lib/project-check/generate-learning";
import { RenewProject } from "@/components/project-check/renew-project";
import { AllowanceCost } from "@/components/project-check/allowance-cost";
import { api, errorMessage } from "@/lib/client-api";
import { displayName } from "@/lib/project-check/display";
import type { Check, CheckOverview } from "@/lib/project-check/types";
import type { GeneratedPractice, PracticeMode } from "@/lib/project-check/generated-practice";
import { practiceContent } from "@/lib/project-check/practice-draft";
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
import { CircleAlert } from "lucide-react";
import { RequestStatus } from "@/components/project-check/request-status";
import { ExerciseRunner } from "./exercise-runner";

/** Set before opening a freshly analysed repository so its page continues to practice generation. */
const autoGenerateKey = (scope: string, id: string) =>
  `codefit-practice-autogenerate:${scope}:${id}`;

export function ProjectPracticeApp() {
  const params = useSearchParams();
  const id = params.get("check"),
    mode: PracticeMode = params.get("mode") === "service" ? "service" : "code";
  const projects = useProjectOverview();
  const { data, error } = projects;
  return (
    <>
      {error && !data && (
        <Card role="alert">
          <p>{error}</p>
          <Button onClick={projects.refresh}>다시 불러오기</Button>
        </Card>
      )}
      {!data && !error && <ScreenSkeleton variant="lesson" label="내 프로젝트 연습 불러오는 중" />}
      {data && (
        <PracticeWorkspace
          key={`${data.scope}:${id ?? "new"}`}
          data={data}
          id={id}
          mode={mode}
          onUsage={projects.refresh}
          paging={projects.paging}
          onMore={() => void projects.loadMore()}
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
  paging,
  onMore,
}: {
  data: CheckOverview;
  id: string | null;
  mode: PracticeMode;
  onUsage: () => void;
  paging: boolean;
  onMore: () => void;
}) {
  const analysisCostId = useId();
  const generateCostId = useId();
  const [choice, setChoice] = useState("");
  const [continueToPractice, setContinueToPractice] = useState(true);
  const [check, setCheck] = useState<Check>();
  const [saved, setSaved] = useState<GeneratedPractice | null>();
  const [progress, setProgress] = useState({ completed: 0, canRecover: false });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [reload, setReload] = useState(0);
  const generationRevision = useGenerationRevision();
  const active = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
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
          // A repository analysed on this page continues to practice generation once, as chosen.
          let requested = false;
          try {
            requested = sessionStorage.getItem(autoGenerateKey(data.scope, id)) === "1";
            sessionStorage.removeItem(autoGenerateKey(data.scope, id));
          } catch {}
          if (requested && !practice.result && record.page.repository) void run(true);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(errorMessage(e));
      });
    return () => controller.abort();
    // run reads the current state when the load finishes; it is not a reason to reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, data.scope, endpoint, reload, generationRevision]);
  function select(value: string) {
    const target = new URL(window.location.href);
    if (value) target.searchParams.set("check", value);
    else target.searchParams.delete("check");
    window.history.pushState(null, "", target);
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
        if (continueToPractice)
          try {
            sessionStorage.setItem(autoGenerateKey(data.scope, requestId.current), "1");
          } catch {}
        const record = await startProjectAnalysis(
          { url, description, requestId: requestId.current, source: "repository" },
          data.scope,
          `/project-practice?mode=${mode}&check=${requestId.current}`,
        );
        if (!alive.current) return;
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
  const repositories = data.checks.filter((c) => c.page.source === "repository");
  const cursor = data.nextCursor;
  const analysisCost = continueToPractice ? 2 : 1;
  return (
    <div className="project-practice-workspace">
      <div className="practice-switch">
        <nav className="practice-origin segmented" aria-label="프로젝트 연습 종류">
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
        </nav>
        <div className="practice-switch-links">
          <AppLink href={id ? `/projects?class=${id}` : "/projects"}>내 프로젝트</AppLink>
          <AppLink href={mode === "code" ? "/handoff?source=sample" : "/learn?source=sample"}>
            샘플 체험으로 이동
          </AppLink>
        </div>
      </div>
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
            // Choosing does not navigate by itself (WCAG 3.2.2); "열기" opens the project.
            <form
              className="practice-record-picker"
              onSubmit={(e) => {
                e.preventDefault();
                if (choice) select(choice);
              }}
            >
              <FieldLabel htmlFor="practice-record">분석한 저장소에서 이어가기</FieldLabel>
              <div className="practice-record-row">
                <NativeSelect
                  id="practice-record"
                  value={choice}
                  disabled={!!busy}
                  onChange={(e) => setChoice(e.target.value)}
                >
                  <option value="">프로젝트 선택</option>
                  {repositories.map((c) => (
                    <option value={c.id} key={c.id}>
                      {displayName(c)}
                    </option>
                  ))}
                </NativeSelect>
                <Button type="submit" disabled={!choice || !!busy}>
                  열기
                </Button>
              </div>
            </form>
          )}
          {cursor && (
            <Button disabled={paging || !!busy} onClick={onMore}>
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
              수집한 공개 코드와 설명을 OpenAI에 보내 연습을 만듭니다. 분석할 권한이 있는 공개
              저장소만 입력하고, 비밀키나 사용자 데이터는 넣지 마세요.
            </p>
            <FieldLabel className="practice-continue">
              <Input
                type="checkbox"
                checked={continueToPractice}
                disabled={!!busy}
                onChange={(e) => setContinueToPractice(e.target.checked)}
              />
              분석이 끝나면 코드 이해 훈련과 서비스 동작 실습 생성까지 이어서 진행
            </FieldLabel>
            <AllowanceCost
              id={analysisCostId}
              label="분석 횟수"
              cost={analysisCost}
              remaining={data.usage.analysis.remaining}
              resetsAt={data.usage.analysis.resetsAt}
            />
            <Button
              type="submit"
              className="primary-button"
              aria-describedby={analysisCostId}
              disabled={!!busy || !data.aiReady || data.usage.analysis.remaining < analysisCost}
            >
              {continueToPractice ? "저장소 분석하고 연습 만들기" : "저장소 분석하기"}
            </Button>
            {!data.aiReady && (
              <p role="status" className="ui-notice">
                <CircleAlert size={18} aria-hidden="true" />
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
                코드 버전을 기준으로 저장하며, 두 단계로 준비해 완료한 단계는 저장합니다. 답변
                저장과 이어하기에는 AI 횟수를 사용하지 않습니다.
              </p>
              <p className="muted">수집한 공개 코드와 설명을 OpenAI에 보내 연습을 만듭니다.</p>
              {!progress.canRecover && (
                <AllowanceCost
                  id={generateCostId}
                  label="분석 횟수"
                  cost={1}
                  remaining={data.usage.analysis.remaining}
                  resetsAt={data.usage.analysis.resetsAt}
                />
              )}
              <Button
                className="primary-button"
                aria-describedby={progress.canRecover ? undefined : generateCostId}
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
            </Card>
          ) : (
            <ExerciseRunner
              key={`${data.scope}:${check.id}:${mode}:${practiceContent(saved, mode)}`}
              check={check}
              mode={mode}
              saved={saved}
              scope={data.scope}
              onSaved={(next) =>
                setSaved((current) =>
                  current && current.revision > next.revision ? current : next,
                )
              }
            />
          )}
          {saved && (
            <RenewProject
              check={check}
              scope={data.scope}
              usage={data.usage.analysis}
              aiReady={data.aiReady}
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
