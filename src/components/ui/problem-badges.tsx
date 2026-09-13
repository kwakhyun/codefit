"use client";

import { KIND_LABELS, type DomainId } from "@/lib/catalog";
import type { PublicProblem } from "@/lib/problem";
import {
  BrainCircuit,
  Container,
  Cpu,
  Database,
  Gamepad2,
  Network,
  PanelTop,
  Server,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
const icons = {
  frontend: PanelTop,
  backend: Server,
  game: Gamepad2,
  network: Network,
  database: Database,
  infra: Container,
  mobile: Smartphone,
  data: BrainCircuit,
  security: ShieldCheck,
  systems: Cpu,
};
export function DomainIcon({ domain, size = 17 }: { domain: DomainId; size?: number }) {
  const Icon = icons[domain];
  return <Icon size={size} aria-hidden="true" />;
}
export function DifficultyBadge({ level }: { level: PublicProblem["difficulty"] }) {
  return (
    <span className={`badge level-${level}`}>
      <span className="level-bars" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      {level}
    </span>
  );
}
export function KindBadge({ kind }: { kind: PublicProblem["kind"] }) {
  return <span className={`kind-label kind-${kind}`}>{KIND_LABELS[kind]}</span>;
}
