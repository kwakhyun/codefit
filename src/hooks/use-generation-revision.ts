"use client";
import { useSyncExternalStore } from "react";
import {
  subscribeGeneration,
  generationRevision,
  generationServerRevision,
} from "@/lib/generation-activity";
export function useGenerationRevision() {
  return useSyncExternalStore(subscribeGeneration, generationRevision, generationServerRevision);
}
