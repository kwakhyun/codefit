import {
  BookOpen,
  CalendarDays,
  Headset,
  LayoutGrid,
  PanelsTopLeft,
  ShoppingBag,
} from "lucide-react";
import type { ServiceDomain } from "@/lib/learn/services/types";
const icons = {
  all: LayoutGrid,
  commerce: ShoppingBag,
  booking: CalendarDays,
  work: PanelsTopLeft,
  content: BookOpen,
  support: Headset,
};
/** Shared silhouettes keep category buttons and their content cards recognizable. */
export function ServiceDomainIcon({ domain }: { domain: ServiceDomain | "all" }) {
  const Icon = icons[domain];
  return (
    <span className="domain-icon" aria-hidden="true">
      <Icon size={22} strokeWidth={1.7} />
    </span>
  );
}
