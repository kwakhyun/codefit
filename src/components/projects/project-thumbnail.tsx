"use client";
import { useEffect, useState } from "react";
import { ThemedImage } from "@/components/theme/themed-image";
function repositoryImage(url: string) {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (
      parsed.hostname === "github.com" &&
      parts.length >= 2 &&
      parts.slice(0, 2).every((p) => /^[\w.-]+$/.test(p))
    )
      return `https://opengraph.githubassets.com/1/${parts[0]}/${parts[1].replace(/\.git$/, "")}`;
  } catch {}
  return "";
}
export function ProjectThumbnail({ id, url, scope }: { id: string; url: string; scope: string }) {
  const [image, setImage] = useState(() => repositoryImage(url));
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (repositoryImage(url)) return;
    const controller = new AbortController();
    let objectUrl = "";
    fetch(`/api/project-check/${id}/thumbnail`, {
      headers: { "x-codefit-workspace": scope },
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok || response.status === 204) return;
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setImage(objectUrl);
      })
      .catch(() => {});
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, url, scope]);
  return (
    <div className="class-thumbnail" aria-hidden="true">
      {image && !failed ? (
        // Authenticated captures and GitHub's image service cannot use the public image optimizer.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          width={800}
          height={420}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <ThemedImage src="/images/experience/project.webp" alt="" width={800} height={420} />
      )}
    </div>
  );
}
