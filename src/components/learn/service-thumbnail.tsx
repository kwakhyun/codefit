import Image from "next/image";
import type { Mission } from "@/lib/learn/catalog";
import { domainInfo } from "@/lib/learn/services/domains";
export function ServiceThumbnail({ mission }: { mission: Mission }) {
  const domain = domainInfo(mission);
  return (
    <span className="service-card-art" data-service-domain={domain.id} aria-hidden="true">
      {domain.id === "commerce" || domain.id === "booking" ? (
        <>
          <Image
            src={domain.image}
            alt=""
            width={1200}
            height={800}
            sizes="(max-width: 600px) 100vw, 400px"
          />
          <strong>{domain.brand}.</strong>
        </>
      ) : (
        <span className="service-card-mini">
          <b>{domain.brand}.</b>
          <span className="service-mini-row">
            <span>{mission.service?.entity || "내 문서와 작업"}</span>
            <em>검토 대기</em>
          </span>
          <span className="service-mini-row">
            <span>
              {domain.id === "work"
                ? "가을 업데이트"
                : domain.id === "content"
                  ? "금요일의 편지 #42"
                  : "배송 일정 문의"}
            </span>
            <em>진행 중</em>
          </span>
          <small>
            {domain.id === "work"
              ? "프로젝트 / 요청 검토 / 변경 이력"
              : domain.id === "content"
                ? "콘텐츠 / 구독자 / 예약 발행"
                : "받은 문의 / 고객 정보 / 처리 이력"}
          </small>
        </span>
      )}
    </span>
  );
}
