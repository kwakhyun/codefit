"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { X, PanelTop, Server, Gamepad2, Network, Database, Container, Smartphone, BrainCircuit, ShieldCheck, Cpu } from "lucide-react";
import { type DomainId, KIND_LABELS } from "@/lib/catalog";
import type { PublicProblem } from "@/lib/problem";
const icons = { frontend: PanelTop, backend: Server, game: Gamepad2, network: Network, database: Database, infra: Container, mobile: Smartphone, data: BrainCircuit, security: ShieldCheck, systems: Cpu };
export function DomainIcon({ domain, size = 17 }: { domain: DomainId; size?: number }) { const Icon = icons[domain]; return <Icon size={size} aria-hidden="true" />; }
export function DifficultyBadge({ level }: { level: string }) { return <span className={`badge level-${level}`}><span className="level-bars" aria-hidden="true"><i /><i /><i /></span>{level}</span>; }
export function KindBadge({ kind }: { kind: PublicProblem["kind"] }) { return <span className={`kind-label kind-${kind}`}>{KIND_LABELS[kind]}</span>; }
export function Modal({ open, onClose, title, children, className = "", busy = false }: { open: boolean; onClose: () => void; title: string; children: ReactNode; className?: string; busy?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (open && dialog && !dialog.open) dialog.showModal();
    else if (!open && dialog?.open) dialog.close();
  }, [open]);
  return <dialog ref={ref} className={`modal ${className}`} aria-label={title} onCancel={e => { e.preventDefault(); if (!busy) onClose(); }} onClick={e => { if (e.target === ref.current && !busy) onClose(); }}>
    <div className="modal-heading"><span className="mono">{title}</span><button className="icon-button" aria-label="닫기" onClick={onClose} disabled={busy}><X size={19} /></button></div>{children}
  </dialog>;
}
