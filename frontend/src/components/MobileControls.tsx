"use client";

import { useCallback } from "react";
import { virtualInput, virtualAction } from "@/game/virtualInput";

/**
 * On-screen d-pad + action button for touch devices. Writes to the shared
 * virtualInput singleton the Phaser Player reads each frame. Hidden on pointer-
 * capable (desktop) layouts via the `sm:hidden` wrapper.
 */
export default function MobileControls() {
  const press = useCallback((x: number, y: number) => virtualInput.set(x, y), []);
  const release = useCallback(() => virtualInput.reset(), []);

  const dirButton = (
    label: string,
    x: number,
    y: number,
    extra: string,
  ) => (
    <button
      className={`cv-panel-raised flex h-12 w-12 items-center justify-center text-xl text-slate-100 ${extra}`}
      onPointerDown={(e) => {
        e.preventDefault();
        press(x, y);
      }}
      onPointerUp={(e) => {
        e.preventDefault();
        release();
      }}
      onPointerLeave={release}
      onPointerCancel={release}
      aria-label={label}
    >
      {label}
    </button>
  );

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex items-end justify-between p-4 sm:hidden">
      {/* D-pad */}
      <div className="pointer-events-auto grid grid-cols-3 grid-rows-3 gap-1">
        <span />
        {dirButton("▲", 0, -1, "")}
        <span />
        {dirButton("◀", -1, 0, "")}
        <span />
        {dirButton("▶", 1, 0, "")}
        <span />
        {dirButton("▼", 0, 1, "")}
        <span />
      </div>

      {/* Action */}
      <button
        className="cv-btn cv-btn-primary pointer-events-auto h-16 w-16 rounded-full text-[0.6rem]"
        onPointerDown={(e) => {
          e.preventDefault();
          virtualAction.trigger();
        }}
        aria-label="Interact"
      >
        E
      </button>
    </div>
  );
}
