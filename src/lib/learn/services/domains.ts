import type { Mission } from "../catalog";
import type { ServiceDomain } from "./types";
export const SERVICE_DOMAINS = [
  {
    id: "commerce",
    label: "쇼핑·주문",
    brand: "ordinary",
    tagline: "매일의 물건, 오래 쓰는 취향",
    description: "쿠폰, 배송비, 재고와 결제 조건",
    image: "/images/services/lifestyle.webp",
  },
  {
    id: "booking",
    label: "예약·시설",
    brand: "roomly",
    tagline: "우리에게 필요한 공간",
    description: "예약 시간, 정원과 취소 정책",
    image: "/images/services/studio.webp",
  },
  {
    id: "work",
    label: "업무·협업",
    brand: "align",
    tagline: "일의 흐름을 한곳에서",
    description: "문서 권한, 결재와 프로젝트 관리",
    image: "/images/services/studio.webp",
  },
  {
    id: "content",
    label: "콘텐츠·구독",
    brand: "edition",
    tagline: "읽고 싶은 이야기가 쌓이는 곳",
    description: "발행, 멤버십과 뉴스레터 운영",
    image: "/images/services/lifestyle.webp",
  },
  {
    id: "support",
    label: "고객지원",
    brand: "relay",
    tagline: "고객과의 대화를 이어가세요",
    description: "문의, 환불과 고객 정보 보호",
    image: "/images/services/studio.webp",
  },
] as const;
export function domainFor(mission: Mission): ServiceDomain {
  if (mission.service) return mission.service.domain;
  if (mission.app === "price") return "commerce";
  if (mission.app === "booking") return "booking";
  if (["memo", "request", "search"].includes(mission.app)) return "content";
  return "work";
}
export function domainInfo(mission: Mission) {
  return SERVICE_DOMAINS.find((d) => d.id === domainFor(mission))!;
}
