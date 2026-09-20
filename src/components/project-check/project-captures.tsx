"use client";
import { useEffect, useState } from "react";
import type { Check } from "@/lib/project-check/types";
function Capture({
  id,
  index,
  scope,
  title,
}: {
  id: string;
  index: number;
  scope: string;
  title: string;
}) {
  const [image, setImage] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let url = "";
    fetch(`/api/project-check/${id}/capture?index=${index}`, {
      headers: { "x-codefit-workspace": scope },
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw Error();
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        url = URL.createObjectURL(blob);
        setImage(url);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [id, index, scope]);
  if (failed) return <p>화면 이미지를 불러오지 못했습니다. 새로고침해 주세요.</p>;
  // Authenticated blob URLs cannot use the public Next.js image optimizer.
  return image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={image}
      alt={`${title} — 분석 당시 로그인 없이 수집한 화면`}
      width={1280}
      height={900}
      style={{ width: "100%", height: "auto", borderRadius: 12 }}
    />
  ) : (
    <p role="status">화면 불러오는 중…</p>
  );
}
export function ProjectCaptures({ check, scope }: { check: Check; scope: string }) {
  const [open, setOpen] = useState(false);
  if (!check.page.captures?.length) return null;
  return (
    <details onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>질문 생성에 사용한 공개 화면 {check.page.captures.length}곳 보기</summary>
      <p className="project-help">
        상단 화면 이미지를 AI에 함께 전달했습니다. 스크롤하며 읽은 본문은 이미지에 모두 보이지 않을
        수 있습니다. 클릭, 로그인과 실제 기능 실행을 검증한 결과는 아닙니다.
      </p>
      {check.page.captures.map((page, index) => (
        <figure key={index} style={{ margin: "20px 0" }}>
          <figcaption>
            <a href={page.url} target="_blank" rel="noreferrer">
              {page.title || page.url}
            </a>
          </figcaption>
          {open && page.hasScreenshot && (
            <Capture id={check.id} index={index} scope={scope} title={page.title} />
          )}
          {!page.hasScreenshot && <p>이 페이지는 본문만 참고했습니다.</p>}
        </figure>
      ))}
    </details>
  );
}
