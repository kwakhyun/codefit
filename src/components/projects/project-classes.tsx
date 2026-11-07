"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  FolderOpen,
  Pencil,
  Trash2,
  RotateCcw,
  LoaderCircle,
  WifiOff,
} from "lucide-react";
import { ApiError, api, dateLabel, errorMessage } from "@/lib/client-api";
import { useConfirmation } from "@/components/ui/use-confirmation";
import { useProjectOverview } from "@/hooks/use-project-overview";
import { displayName, projectDeletion } from "@/lib/project-check/display";
import type { CheckListItem, CheckOverview } from "@/lib/project-check/types";
import type { ClassMetadata, ProjectClassDetail } from "@/lib/project-check/project-class";
import {
  AppLink,
  Button,
  Card,
  FieldLabel,
  Input,
  Textarea,
  Badge,
  Progress,
} from "@/components/ui/primitives";
import { Modal } from "@/components/ui/modal";
import { ScreenSkeleton } from "@/components/ui/skeleton";
import { RenewProject } from "@/components/project-check/renew-project";
import { useProjectSearch } from "@/hooks/use-project-search";
import { forgetProjects } from "@/lib/project-cleanup";
import { ProjectVersions } from "./project-versions";
import { ProjectThumbnail } from "./project-thumbnail";
import { ThemedImage } from "@/components/theme/themed-image";
import { ProjectReview } from "./project-review";
import {
  analysisSnapshot,
  analysisServerSnapshot,
  refreshAnalysis,
  subscribeAnalysis,
} from "@/lib/project-analysis-tasks";
import { CancelAnalysis } from "@/components/project-check/cancel-analysis";
const nameOf = (item: CheckListItem) => displayName(item);
export function ProjectClasses() {
  const id = useSearchParams().get("class");
  const projects = useProjectOverview();
  const { data: overview, error } = projects;
  return (
    <>
      {error && !overview && (
        <Card role="alert">
          <p>{error}</p>
          <Button onClick={projects.refresh}>다시 불러오기</Button>
        </Card>
      )}
      {!overview && !error && <ScreenSkeleton variant="lesson" label="내 프로젝트 불러오는 중" />}
      {overview &&
        (id ? (
          <ClassDetail
            key={`${overview.scope}:${id}`}
            id={id}
            scope={overview.scope}
            overview={overview}
            onChanged={projects.refresh}
          />
        ) : (
          <ClassList
            key={overview.scope}
            overview={overview}
            busy={projects.paging}
            more={() => void projects.loadMore()}
            onChanged={projects.refresh}
          />
        ))}
      {overview && projects.pageError && <p role="alert">{projects.pageError}</p>}
    </>
  );
}
function ClassList({
  overview,
  busy,
  more,
  onChanged,
}: {
  overview: CheckOverview;
  busy: boolean;
  more: () => void;
  onChanged: () => void;
}) {
  const tasks = useSyncExternalStore(subscribeAnalysis, analysisSnapshot, analysisServerSnapshot);
  const { confirm, confirmation } = useConfirmation();
  const [removing, setRemoving] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  async function remove(item: CheckListItem) {
    if (removing) return;
    setDeleteError("");
    const { message, options } = projectDeletion(nameOf(item));
    if (!(await confirm(message, options))) return;
    setRemoving(true);
    try {
      const { ids } = await api<{ ids?: string[] }>(`/api/projects/${item.id}`, {
        method: "DELETE",
        scope: overview.scope,
      });
      forgetProjects(overview.scope, ids ?? [item.id]);
      onChanged();
    } catch (e) {
      setDeleteError(errorMessage(e));
    } finally {
      setRemoving(false);
    }
  }
  const searchKey = `codefit-project-search:${overview.scope}`;
  const searchInput = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(() => {
    try {
      return sessionStorage.getItem(searchKey) ?? "";
    } catch {
      return "";
    }
  });
  function changeQuery(value: string) {
    setQuery(value);
    try {
      sessionStorage.setItem(searchKey, value);
    } catch {
      /* Search remains usable without browser storage. */
    }
  }
  const search = useProjectSearch(query, overview);
  const searching = !!query.trim();
  const items = searching ? (search.page?.checks ?? []) : overview.checks;
  const cursor = searching ? search.page?.nextCursor : overview.nextCursor;
  const visible = items;
  const active = tasks.filter(
    (task) =>
      task.scope === overview.scope &&
      ["pending", "disconnected"].includes(task.status) &&
      !overview.checks.some((item) => item.id === task.id) &&
      (!searching || task.label.toLowerCase().includes(query.trim().toLowerCase())),
  );
  const pending = searching ? search.busy : busy;
  // Search and a second "new analysis" button add nothing before the first project exists.
  const empty = !overview.checks.length && !active.length && !searching;
  return (
    <>
      {!empty && (
        <div className="class-toolbar">
          <div>
            <FieldLabel htmlFor="class-search">내 프로젝트 찾기</FieldLabel>
            <Input
              ref={searchInput}
              id="class-search"
              type="search"
              maxLength={200}
              value={query}
              onChange={(e) => changeQuery(e.target.value)}
              placeholder="프로젝트 이름, 학습 목표 또는 주소"
            />
          </div>
          <AppLink className="primary-button" href="/project-check?new=1#project-register">
            새 프로젝트 분석 <ArrowRight size={18} />
          </AppLink>
        </div>
      )}
      {searching && (
        <div className="class-search-status">
          <p role="status" aria-live="polite">
            {search.busy
              ? "프로젝트 검색 중…"
              : search.error
                ? "검색을 완료하지 못했습니다. 다시 시도해 주세요."
                : `검색 결과 ${items.length}개${cursor ? " 이상" : ""}`}
          </p>
          <Button
            onClick={() => {
              changeQuery("");
              searchInput.current?.focus();
            }}
          >
            검색 초기화
          </Button>
        </div>
      )}
      {!overview.signedIn && (
        <p className="muted">
          이 브라우저의 방문자 기록입니다. 쿠키를 지우면 접근할 수 없으니 필요한 기록은 환경
          설정에서 백업해 주세요.
        </p>
      )}
      {searching && search.busy && !search.page && (
        <ScreenSkeleton variant="list" label="전체 프로젝트 검색 중" />
      )}
      {searching && search.error && (
        <Card role="alert">
          <p>{search.error}</p>
          <Button onClick={search.retry}>검색 다시 시도</Button>
        </Card>
      )}
      {searching && !search.busy && !search.error && !items.length && !active.length && (
        <p role="status">검색 결과가 없습니다. 다른 이름이나 주소로 검색해 보세요.</p>
      )}
      {!items.length && !active.length && !searching ? (
        <Card className="class-empty">
          <FolderOpen size={36} />
          <h2>내 프로젝트가 나만의 수업이 됩니다</h2>
          <p>
            프로젝트를 한 번 분석하면 자동으로 저장됩니다. 질문에 답하고, 실제 코드로 연습하고,
            언제든 이어서 학습하세요.
          </p>
          <AppLink href="/project-check?new=1#project-register" className="primary-button">
            첫 프로젝트 연결하기
          </AppLink>
        </Card>
      ) : (
        <div className="class-grid">
          {active.map((task) =>
            task.status === "pending" ? (
              <Card className="class-list-card class-loading-card" key={task.id}>
                <span className="class-card-icon">
                  <LoaderCircle className="analysis-spinner" size={24} aria-hidden="true" />
                </span>
                <div role="status">
                  <Badge>분석 중</Badge>
                  <h2>{task.label}</h2>
                  <p>
                    프로젝트를 읽고 질문과 학습을 준비하고 있습니다. 완료되면 이곳에 표시됩니다.
                  </p>
                </div>
                <div className="class-loading-lines" aria-hidden="true">
                  <span />
                  <span />
                </div>
                <CancelAnalysis task={task} />
              </Card>
            ) : (
              // Polling stopped: no spinner, and the one action is to check the status again.
              <Card className="class-list-card class-loading-card" key={task.id}>
                <span className="class-card-icon">
                  <WifiOff size={24} aria-hidden="true" />
                </span>
                <div>
                  <Badge>연결 끊김</Badge>
                  <h2>{task.label}</h2>
                  <p>
                    응답을 받지 못해 진행 상태를 확인하지 못했습니다. 서버에서는 분석이 계속될 수
                    있으며, 다시 확인해도 AI를 다시 호출하지 않습니다.
                  </p>
                </div>
                <Button onClick={() => refreshAnalysis(task)}>분석 상태 다시 확인</Button>
              </Card>
            ),
          )}
          {visible.map((item) => (
            <article className="class-list-card" key={item.id}>
              <AppLink className="class-card-link" href={`/projects?class=${item.id}`}>
                <ProjectThumbnail id={item.id} url={item.page.url} scope={overview.scope} />
                <div>
                  <Badge>
                    {item.page.source === "repository" ? "저장소 프로젝트" : "웹사이트 프로젝트"}
                  </Badge>
                  <h2>{nameOf(item)}</h2>
                  <p>{item.classMetadata?.goal || "저장한 질문과 학습을 한곳에서 이어가세요."}</p>
                  <small>
                    {new URL(item.page.url).hostname} · {dateLabel(item.createdAt)}
                  </small>
                </div>
                <span className="class-open">
                  프로젝트 열기 <ArrowRight size={18} aria-hidden="true" />
                </span>
              </AppLink>
              <Button
                className="class-delete-button"
                aria-label={`${nameOf(item)} 프로젝트 삭제`}
                disabled={removing}
                onClick={() => void remove(item)}
              >
                <Trash2 size={17} aria-hidden="true" /> 프로젝트 삭제
              </Button>
            </article>
          ))}
        </div>
      )}
      {confirmation}
      {deleteError && <p role="alert">{deleteError}</p>}
      {cursor && (
        <Button disabled={pending} onClick={searching ? search.more : more}>
          {pending ? "불러오는 중…" : searching ? "검색 결과 더 보기" : "이전 프로젝트 더 보기"}
        </Button>
      )}
    </>
  );
}
function ClassDetail({
  id,
  scope,
  overview,
  onChanged,
}: {
  id: string;
  scope: string;
  overview: CheckOverview;
  onChanged: () => void;
}) {
  const router = useRouter();
  // Review mode is part of the address so Back, reload and shared links keep it.
  const review = useSearchParams().get("view") === "review";
  const { confirm, confirmation } = useConfirmation();
  const [detail, setDetail] = useState<ProjectClassDetail>(),
    [error, setError] = useState(""),
    [reload, setReload] = useState(0),
    [modal, setModal] = useState<"edit" | null>(null),
    [name, setName] = useState(""),
    [goal, setGoal] = useState(""),
    [editRevision, setEditRevision] = useState(0),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (busy) return;
    const abort = new AbortController();
    api<ProjectClassDetail>(`/api/projects/${id}`, { scope, signal: abort.signal })
      .then((value) => {
        if (!abort.signal.aborted) {
          setDetail(value);
          if (!modal) setError("");
        }
      })
      .catch((e) => {
        if (!abort.signal.aborted) {
          if (e instanceof ApiError && (e.status === 404 || e.status === 403)) setDetail(undefined);
          setError(errorMessage(e));
        }
      });
    return () => abort.abort();
  }, [id, scope, reload, overview, busy, modal]);
  async function save() {
    if (!detail || busy) return;
    setBusy(true);
    setError("");
    try {
      const classMetadata = await api<ClassMetadata>(`/api/projects/${id}`, {
        method: "PATCH",
        scope,
        body: { name, goal, revision: editRevision },
      });
      setDetail({ ...detail, check: { ...detail.check, classMetadata } });
      setModal(null);
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (busy || !detail) return;
    setError("");
    const { message, options } = projectDeletion(displayName(detail.check));
    if (!(await confirm(message, options))) return;
    setBusy(true);
    try {
      const { ids } = await api<{ ids?: string[] }>(`/api/projects/${id}`, {
        method: "DELETE",
        scope,
      });
      forgetProjects(scope, ids ?? [id]);
      onChanged();
      router.replace("/projects");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  if (!detail)
    return (
      <>
        <AppLink href="/projects">← 내 프로젝트 목록</AppLink>
        {error ? (
          <Card role="alert">
            <p>{error}</p>
            <Button onClick={() => setReload((n) => n + 1)}>다시 불러오기</Button>
          </Card>
        ) : (
          <ScreenSkeleton variant="lesson" label="프로젝트 학습 불러오는 중" />
        )}
      </>
    );
  const { check, practice, workshop } = detail;
  const title = displayName(check);
  const codeDone = practice?.progress.code.filter((p) => p.completed).length ?? 0,
    serviceDone = practice?.progress.service.filter((p) => p.completed).length ?? 0,
    aiDone = workshop?.responses.filter(Boolean).length ?? 0;
  const tracks = [
    {
      image: "/images/experience/project.webp",
      title: "프로젝트 점검",
      description: check.review
        ? "평가를 받았습니다. 내 설명과 피드백을 다시 확인하세요."
        : "설계 질문에 답하고 평가를 받으면 완료됩니다.",
      href: `/project-check?check=${id}`,
      // Completion is a saved evaluation, not the number of answered questions.
      done: check.review ? 1 : 0,
      total: 1,
      ready: true,
    },
    ...(check.page.repository
      ? [
          {
            image: "/images/experience/code.webp",
            title: "코드 이해 훈련",
            description: practice
              ? "실제 코드의 조건과 결과를 따라갑니다."
              : "이 프로젝트 코드로 맞춤 실습을 준비합니다.",
            href: `/project-practice?check=${id}&mode=code`,
            done: codeDone,
            total: practice?.exercises.code.length ?? 0,
            ready: !!practice,
          },
          {
            image: "/images/experience/principles.webp",
            title: "서비스 동작 실습",
            description: "사용자 행동이 데이터와 서비스에 미치는 영향을 확인합니다.",
            href: `/project-practice?check=${id}&mode=service`,
            done: serviceDone,
            total: practice?.exercises.service.length ?? 0,
            ready: !!practice,
          },
          {
            image: "/images/personas/persona-ai.webp",
            title: "내 프로젝트 AI 워크숍",
            description:
              workshop && !workshop.plan.topics.length
                ? "이 코드에서는 추가로 제안할 AI 워크숍 주제를 찾지 못했습니다."
                : "이미 쓰는 AI와 새롭게 적용할 방법을 배웁니다.",
            href: `/learn/ai/project?check=${id}`,
            done: aiDone,
            total: workshop?.plan.topics.length ?? 0,
            ready: !!workshop,
          },
        ]
      : []),
  ];
  const nextTrack = tracks.find((track) => track.ready && track.total > track.done);
  const readyTracks = tracks.filter((track) => track.ready && track.total > 0);
  const completedTracks = readyTracks.filter((track) => track.done >= track.total).length;
  return (
    <>
      <AppLink href="/projects">← 내 프로젝트 목록</AppLink>
      <Card className="class-hero">
        <span className="eyebrow">내 프로젝트</span>
        <h2>{title}</h2>
        <p>{check.classMetadata?.goal || check.analysis.summary}</p>
        <small>
          분석 기준 {check.page.repository?.commit.slice(0, 7) || dateLabel(check.createdAt)} ·{" "}
          {new URL(check.page.url).hostname}
        </small>
        <div className="class-next-step">
          <div>
            <strong>
              {nextTrack ? `다음 학습: ${nextTrack.title}` : "저장된 학습을 다시 살펴보세요"}
            </strong>
            <p>
              준비된 학습 {readyTracks.length}개 중 {completedTracks}개 완료
            </p>
          </div>
          {nextTrack && (
            <AppLink href={nextTrack.href} className="primary-button">
              {nextTrack.done > 0 ? "다음 학습 이어가기" : "다음 학습 시작하기"}
              <ArrowRight size={18} aria-hidden="true" />
            </AppLink>
          )}
        </div>
        <div className="class-actions">
          <Button
            onClick={() => {
              setName(title.slice(0, 100));
              setGoal(check.classMetadata?.goal || "");
              setEditRevision(check.classMetadata?.revision ?? 0);
              setModal("edit");
              setError("");
            }}
          >
            <Pencil size={17} />
            정보 수정
          </Button>
          <Button
            onClick={() =>
              router.push(review ? `/projects?class=${id}` : `/projects?class=${id}&view=review`)
            }
            aria-pressed={review}
          >
            <RotateCcw size={17} aria-hidden="true" />
            {review ? "학습 목록으로" : "복습하기"}
          </Button>
          <Button disabled={busy} onClick={() => void remove()}>
            <Trash2 size={17} aria-hidden="true" />
            삭제
          </Button>
        </div>
      </Card>
      {review ? (
        <ProjectReview detail={detail} scope={scope} />
      ) : (
        <section aria-label="프로젝트 학습 과정" className="class-tracks">
          {tracks.map((track) => (
            <Card key={track.title}>
              <div className="class-track-preview" aria-hidden="true">
                <ThemedImage src={track.image} alt="" width={800} height={420} />
              </div>
              <h3>{track.title}</h3>
              <p>{track.description}</p>
              {track.ready && track.total > 0 && (
                <>
                  <Progress
                    value={track.done}
                    max={track.total}
                    aria-label={`${track.title} 진행률`}
                  />
                  <span>
                    {track.total === 1
                      ? track.done
                        ? "평가 완료"
                        : "평가 전"
                      : `${track.done}/${track.total} 완료`}
                  </span>
                </>
              )}
              <AppLink href={track.href} className="primary-button">
                {track.ready
                  ? track.total === 0
                    ? "학습 결과 확인"
                    : track.done >= track.total
                      ? "학습 다시 보기"
                      : track.done > 0
                        ? "이어서 학습"
                        : "학습 시작하기"
                  : "학습 준비하기"}
                <ArrowRight size={18} />
              </AppLink>
            </Card>
          ))}
        </section>
      )}
      {!!check.revisions?.length && (
        <p className="class-revisions">
          보완 답변 기록:{" "}
          {check.revisions.map((revision) => (
            <AppLink key={revision.id} href={`/project-check?check=${revision.id}`}>
              {revision.revisionNumber}차 보완 답변 →{" "}
            </AppLink>
          ))}
        </p>
      )}
      {check.page.repository && <ProjectVersions key={`${scope}:${id}`} id={id} scope={scope} />}
      {!check.page.repository && (
        <p>
          서비스 화면 분석에는 코드 실습이 포함되지 않습니다. 소스 저장소를 새로 연결하면 코드
          실습과 AI 워크숍도 만들 수 있어요.
        </p>
      )}
      <RenewProject
        check={check}
        scope={scope}
        usage={overview.usage.analysis}
        aiReady={overview.aiReady}
        destination="/projects"
        queryKey="class"
      />
      {confirmation}
      {error && !modal && <p role="alert">{error}</p>}
      <Modal
        open={!!modal}
        onClose={() => !busy && setModal(null)}
        busy={busy}
        title="프로젝트 정보 수정"
      >
        {modal === "edit" && (
          <form
            className="class-edit"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <FieldLabel htmlFor="class-name">프로젝트 이름</FieldLabel>
            <Input
              id="class-name"
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
            />
            <FieldLabel htmlFor="class-goal">학습 목표와 메모</FieldLabel>
            <Textarea
              id="class-goal"
              rows={5}
              maxLength={2000}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              disabled={busy}
            />
            <p className="muted">분석한 코드와 기존 답변은 바뀌지 않습니다.</p>
            {error && <p role="alert">{error}</p>}
            <Button type="submit" className="primary-button" disabled={busy || !name.trim()}>
              {busy ? "저장 중…" : "변경사항 저장"}
            </Button>
            {error && (
              <Button
                onClick={() => {
                  setModal(null);
                  setReload((v) => v + 1);
                }}
              >
                최신 정보 다시 불러오기
              </Button>
            )}
          </form>
        )}
      </Modal>
    </>
  );
}
