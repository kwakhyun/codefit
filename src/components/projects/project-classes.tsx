"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen, ArrowRight, FolderOpen, Pencil, Trash2, RotateCcw } from "lucide-react";
import { ApiError, api, dateLabel, errorMessage } from "@/lib/client-api";
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
import { reviewStorageKey } from "@/hooks/use-project-review";
import { ProjectVersions } from "./project-versions";
import { ProjectReview } from "./project-review";
function nameOf(item: CheckListItem) {
  return item.classMetadata?.name || item.analysis.title;
}
export function ProjectClasses() {
  const id = useSearchParams().get("class");
  const [overview, setOverview] = useState<CheckOverview>();
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const pageCount = useRef(1);
  const moreRequest = useRef<AbortController | null>(null);
  const [loading, setLoading] = useState(true);
  const currentScope = useRef<string | undefined>(undefined);
  useEffect(() => {
    moreRequest.current?.abort();
    const abort = new AbortController();
    async function load() {
      const first = await api<CheckOverview>("/api/project-check", {
        scope: null,
        signal: abort.signal,
      });
      const count =
        currentScope.current && currentScope.current !== first.scope ? 1 : pageCount.current;
      const checks = [...first.checks];
      let cursor = first.nextCursor;
      for (let page = 1; page < count && cursor; page++) {
        const next = await api<CheckOverview>(
          `/api/project-check?cursor=${encodeURIComponent(cursor)}`,
          { scope: first.scope, signal: abort.signal },
        );
        checks.push(
          ...next.checks.filter((item) => !checks.some((existing) => existing.id === item.id)),
        );
        cursor = next.nextCursor;
      }
      return { ...first, checks, nextCursor: cursor };
    }
    load()
      .then((value) => {
        if (!abort.signal.aborted) {
          if (currentScope.current && currentScope.current !== value.scope) pageCount.current = 1;
          currentScope.current = value.scope;
          setOverview(value);
          setError("");
        }
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(errorMessage(e));
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => {
      abort.abort();
      moreRequest.current?.abort();
    };
  }, [revision]);
  useEffect(() => {
    const refresh = () => {
      setLoading(true);
      setRevision((v) => v + 1);
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("codefit:backup-imported", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("codefit:backup-imported", refresh);
    };
  }, []);
  async function more() {
    if (!overview?.nextCursor || loading) return;
    const controller = new AbortController();
    moreRequest.current = controller;
    setLoading(true);
    try {
      const page = await api<CheckOverview>(
        `/api/project-check?cursor=${encodeURIComponent(overview.nextCursor)}`,
        { scope: overview.scope, signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      if (page.scope !== overview.scope) {
        setRevision((v) => v + 1);
        return;
      }
      pageCount.current += 1;
      setOverview((current) =>
        current && current.scope === page.scope
          ? {
              ...page,
              checks: [
                ...current.checks,
                ...page.checks.filter(
                  (item) => !current.checks.some((previous) => previous.id === item.id),
                ),
              ],
            }
          : current,
      );
      setError("");
    } catch (e) {
      if (!controller.signal.aborted) setError(errorMessage(e));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }
  return (
    <>
      {error && (
        <Card role="alert">
          <p>{error}</p>
          <Button onClick={() => setRevision((v) => v + 1)}>다시 불러오기</Button>
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
            onChanged={() => setRevision((v) => v + 1)}
          />
        ) : (
          <ClassList key={overview.scope} overview={overview} busy={loading} more={more} />
        ))}
    </>
  );
}
function ClassList({
  overview,
  busy,
  more,
}: {
  overview: CheckOverview;
  busy: boolean;
  more: () => void;
}) {
  const searchKey = `codefit-project-search:${overview.scope}`;
  const [query, setQuery] = useState(() => {
    try {
      return sessionStorage.getItem(searchKey) ?? "";
    } catch {
      return "";
    }
  });
  const items = overview.checks;
  const cursor = overview.nextCursor;
  const visible = items.filter((item) =>
    `${nameOf(item)} ${item.classMetadata?.goal || ""} ${item.page.url}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="class-toolbar">
        <div>
          <FieldLabel htmlFor="class-search">내 프로젝트 찾기</FieldLabel>
          <Input
            id="class-search"
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              try {
                sessionStorage.setItem(searchKey, e.target.value);
              } catch {
                /* Search still works without browser storage. */
              }
            }}
            placeholder="클래스 이름, 학습 목표 또는 주소"
          />
        </div>
        <AppLink className="primary-button" href="/project-check">
          새 프로젝트 분석 <ArrowRight size={18} />
        </AppLink>
      </div>
      {!overview.signedIn && (
        <p className="muted">
          이 브라우저의 방문자 기록입니다. 쿠키를 지우면 접근할 수 없으니 필요한 기록은 환경
          설정에서 백업해 주세요.
        </p>
      )}
      {!items.length ? (
        <Card className="class-empty">
          <FolderOpen size={36} />
          <h2>내 프로젝트가 나만의 수업이 됩니다</h2>
          <p>
            프로젝트를 한 번 분석하면 자동으로 저장됩니다. 질문에 답하고, 실제 코드로 연습하고,
            언제든 이어서 학습하세요.
          </p>
          <AppLink href="/project-check" className="primary-button">
            첫 프로젝트 연결하기
          </AppLink>
        </Card>
      ) : (
        <div className="class-grid">
          {visible.map((item) => (
            <AppLink className="class-list-card" href={`/projects?class=${item.id}`} key={item.id}>
              <span className="class-card-icon">
                <BookOpen size={24} />
              </span>
              <div>
                <Badge>
                  {item.page.source === "repository" ? "코드 기반 클래스" : "서비스 점검 클래스"}
                </Badge>
                <h2>{nameOf(item)}</h2>
                <p>{item.classMetadata?.goal || "저장한 질문과 학습을 한곳에서 이어가세요."}</p>
                <small>
                  {new URL(item.page.url).hostname} · {dateLabel(item.createdAt)}
                </small>
              </div>
              <span className="class-open">
                클래스 열기 <ArrowRight size={18} />
              </span>
            </AppLink>
          ))}
        </div>
      )}
      {!!items.length && !visible.length && (
        <p role="status">
          불러온 프로젝트 중 검색 결과가 없습니다.
          {cursor ? " 이전 프로젝트를 더 불러와 찾아보세요." : " 다른 검색어를 입력해 보세요."}
        </p>
      )}
      {cursor && (
        <Button disabled={busy} onClick={more}>
          {busy ? "불러오는 중…" : "이전 프로젝트 더 보기"}
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
  const [detail, setDetail] = useState<ProjectClassDetail>(),
    [error, setError] = useState(""),
    [reload, setReload] = useState(0),
    [modal, setModal] = useState<"edit" | "delete" | null>(null),
    [name, setName] = useState(""),
    [goal, setGoal] = useState(""),
    [editRevision, setEditRevision] = useState(0),
    [busy, setBusy] = useState(false),
    [review, setReview] = useState(false);
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
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/projects/${id}`, { method: "DELETE", scope });
      try {
        localStorage.removeItem(reviewStorageKey(scope, id));
      } catch {}
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
  const title = check.classMetadata?.name || check.analysis.title;
  const codeDone = practice?.progress.code.filter((p) => p.completed).length ?? 0,
    serviceDone = practice?.progress.service.filter((p) => p.completed).length ?? 0,
    aiDone = workshop?.responses.filter(Boolean).length ?? 0;
  const tracks = [
    {
      title: "프로젝트 점검",
      description: check.review
        ? "내 설명과 피드백을 다시 확인하세요."
        : "설계 질문에 답하며 내가 아는 부분을 확인하세요.",
      href: `/project-check?check=${id}`,
      done: check.review?.answers.filter((a) => a.trim()).length ?? 0,
      total: 5,
      ready: true,
    },
    ...(check.page.repository
      ? [
          {
            title: "코드 이해 훈련",
            description: practice
              ? "실제 코드의 조건과 결과를 따라갑니다."
              : "이 프로젝트 코드로 맞춤 실습을 준비합니다.",
            href: `/project-practice?check=${id}&mode=code`,
            done: codeDone,
            total: 3,
            ready: !!practice,
          },
          {
            title: "서비스 동작 실습",
            description: "사용자 행동이 데이터와 서비스에 미치는 영향을 확인합니다.",
            href: `/project-practice?check=${id}&mode=service`,
            done: serviceDone,
            total: 3,
            ready: !!practice,
          },
          {
            title: "AI 활용 학습",
            description:
              workshop && !workshop.plan.topics.length
                ? "이 코드에서는 추가로 제안할 AI 학습 주제를 찾지 못했습니다."
                : "이미 쓰는 AI와 새롭게 적용할 방법을 배웁니다.",
            href: `/learn/ai/project?check=${id}`,
            done: aiDone,
            total: workshop?.plan.topics.length ?? 0,
            ready: !!workshop,
          },
        ]
      : []),
  ];
  return (
    <>
      <AppLink href="/projects">← 내 프로젝트 목록</AppLink>
      <Card className="class-hero">
        <span className="eyebrow">나의 프로젝트 학습 클래스</span>
        <h2>{title}</h2>
        <p>{check.classMetadata?.goal || check.analysis.summary}</p>
        <small>
          분석 기준 {check.page.repository?.commit.slice(0, 7) || dateLabel(check.createdAt)} ·{" "}
          {new URL(check.page.url).hostname}
        </small>
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
          <Button onClick={() => setReview((v) => !v)} aria-pressed={review}>
            <RotateCcw size={17} />
            {review ? "학습 목록으로" : "복습하기"}
          </Button>
          <Button
            onClick={() => {
              setModal("delete");
              setError("");
            }}
          >
            <Trash2 size={17} />
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
                    {track.done}/{track.total} 완료
                  </span>
                </>
              )}
              <AppLink href={track.href} className="primary-button">
                {track.ready
                  ? track.total > 0 && track.done === track.total
                    ? "학습 다시 보기"
                    : "이어서 학습"
                  : "학습 준비하기"}
                <ArrowRight size={18} />
              </AppLink>
            </Card>
          ))}
        </section>
      )}
      {check.page.repository && <ProjectVersions key={`${scope}:${id}`} id={id} scope={scope} />}
      {!check.page.repository && (
        <p>
          서비스 화면 분석에는 코드 실습이 포함되지 않습니다. 소스 저장소를 새로 연결하면 코드와 AI
          학습도 만들 수 있어요.
        </p>
      )}
      {check.page.repository && (
        <RenewProject check={check} scope={scope} destination="/projects" queryKey="class" />
      )}
      {error && !modal && <p role="alert">{error}</p>}
      <Modal
        open={!!modal}
        onClose={() => !busy && setModal(null)}
        busy={busy}
        title={modal === "delete" ? "프로젝트 클래스를 삭제할까요?" : "클래스 정보 수정"}
      >
        {modal === "edit" ? (
          <form
            className="class-edit"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <FieldLabel htmlFor="class-name">클래스 이름</FieldLabel>
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
        ) : (
          <div className="class-edit">
            <p>
              <strong>{title}</strong>의 점검, 답변, 실습, AI 학습과 진행 기록이 함께 삭제됩니다. 이
              작업은 되돌릴 수 없습니다.
            </p>
            <p>원본 저장소와 서비스는 삭제되지 않습니다.</p>
            {error && <p role="alert">{error}</p>}
            <div className="class-actions">
              <Button disabled={busy} onClick={() => setModal(null)}>
                취소
              </Button>
              <Button disabled={busy} onClick={remove}>
                {busy ? "삭제 중…" : "클래스 영구 삭제"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
