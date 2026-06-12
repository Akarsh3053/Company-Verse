"use client";

import { useEffect } from "react";
import { useGameStore } from "@/state/gameStore";
import type { Landmark, Region } from "@/types/bundle";

interface LandmarkCardProps {
  landmark: Landmark;
  region: Region | null;
  onClose: () => void;
}

/**
 * Info card shown when the player inspects a landmark. Viewing it satisfies
 * matching `explore` and `read` objectives (frontend.md §8.5).
 */
export default function LandmarkCard({
  landmark,
  region,
  onClose,
}: LandmarkCardProps) {
  const recordExploreLandmark = useGameStore((s) => s.recordExploreLandmark);
  const recordReadLandmark = useGameStore((s) => s.recordReadLandmark);

  useEffect(() => {
    recordExploreLandmark(landmark.id);
    recordReadLandmark(landmark.id);
  }, [landmark.id, recordExploreLandmark, recordReadLandmark]);

  const status = landmark.metadata?.status;

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="cv-panel w-full max-w-lg p-6">
        <div className="mb-1 flex items-center justify-between">
          <span className="cv-heading text-[0.6rem] text-slate-400">
            {landmark.landmark_type.toUpperCase()} ·{" "}
            {landmark.source_type.toUpperCase()}
          </span>
          <button
            className="cv-body text-lg text-slate-300 hover:text-white"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <h2 className="cv-body mb-2 text-2xl text-accent">{landmark.name}</h2>

        {region && (
          <p className="cv-body mb-3 text-base text-slate-400">
            {region.icon} {region.name} — {region.department}
          </p>
        )}

        <p className="cv-body mb-4 text-lg text-slate-100">
          {landmark.description}
        </p>

        <div className="flex flex-wrap gap-2">
          {status && (
            <span className="cv-body border-2 border-frame px-2 py-0.5 text-base text-slate-200">
              status: {status}
            </span>
          )}
          {landmark.criticality && (
            <span className="cv-body border-2 border-frame px-2 py-0.5 text-base text-slate-200">
              criticality: {landmark.criticality}
            </span>
          )}
          {landmark.tags.map((tag) => (
            <span
              key={tag}
              className="cv-body border-2 border-frame px-2 py-0.5 text-base text-slate-300"
            >
              {tag}
            </span>
          ))}
        </div>

        <p className="cv-body mt-4 text-sm text-success">
          ✓ Landmark explored
        </p>

        <button className="cv-btn cv-btn-primary mt-4 w-full" onClick={onClose}>
          Continue ▶
        </button>
      </div>
    </div>
  );
}
