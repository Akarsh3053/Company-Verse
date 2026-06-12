"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import type { GameBundle, Landmark, Region } from "@/types/bundle";
import { getBundle, describeError } from "@/lib/api";
import { useSessionStore } from "@/state/sessionStore";
import { useGameStore } from "@/state/gameStore";
import { eventBus } from "@/game/eventBus";

import IntroCutscene from "@/components/IntroCutscene";
import Hud from "@/components/Hud";
import DialogueBox from "@/components/DialogueBox";
import ChallengeModal from "@/components/ChallengeModal";
import ChatPanel from "@/components/ChatPanel";
import LandmarkCard from "@/components/LandmarkCard";
import CharacterSheet from "@/components/CharacterSheet";
import CompletionScreen from "@/components/CompletionScreen";
import InteractionPrompt from "@/components/InteractionPrompt";
import MobileControls from "@/components/MobileControls";
import Toaster from "@/components/Toaster";
import QuestTracker from "@/components/QuestTracker";

// Phaser must never run on the server.
const PhaserGame = dynamic(() => import("@/game/PhaserGame"), {
  ssr: false,
  loading: () => null,
});

function FullscreenMessage({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="cv-starfield flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <div className="cv-panel w-full max-w-md p-6">
        <h1 className="cv-heading mb-3 text-base text-accent">{title}</h1>
        <p className="cv-body mb-5 text-lg text-slate-300">{body}</p>
        {children}
      </div>
    </main>
  );
}

function PlayInner() {
  const router = useRouter();
  const params = useSearchParams();
  const key = params.get("key");
  const wantIntro = params.get("intro") === "1";

  const sessionBundle = useSessionStore((s) => s.bundle);
  const initFromBundle = useGameStore((s) => s.initFromBundle);

  const [bundle, setBundle] = useState<GameBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [introDone, setIntroDone] = useState(!wantIntro);
  const initialisedFor = useRef<string | null>(null);

  // Overlay state.
  const [characterOpen, setCharacterOpen] = useState(false);
  const [dialogueNpc, setDialogueNpc] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [chatNpc, setChatNpc] = useState<string | null>(null);
  const [landmark, setLandmark] = useState<{
    landmark: Landmark;
    region: Region | null;
  } | null>(null);
  const [completionDismissed, setCompletionDismissed] = useState(false);

  // ── Resolve the bundle (session cache or fetch by key). ────────────────────
  useEffect(() => {
    if (!key) {
      setError("No game selected.");
      return;
    }
    let cancelled = false;

    if (sessionBundle && sessionBundle.metadata.user_key === key) {
      if (initialisedFor.current !== key) {
        initFromBundle(sessionBundle);
        initialisedFor.current = key;
      }
      setBundle(sessionBundle);
      return;
    }

    (async () => {
      try {
        const fetched = await getBundle(key);
        if (cancelled) return;
        initFromBundle(fetched);
        initialisedFor.current = key;
        setBundle(fetched);
      } catch (err) {
        if (!cancelled) setError(describeError(err));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [key, sessionBundle, initFromBundle]);

  // ── World event subscriptions (open overlays). ─────────────────────────────
  useEffect(() => {
    const offDialogue = eventBus.on("dialogue:open", ({ npcId }) => {
      setChatNpc(null);
      setDialogueNpc(npcId);
    });
    const offChallenge = eventBus.on("challenge:open", ({ challengeId }) =>
      setChallengeId(challengeId),
    );
    const offLandmark = eventBus.on("landmark:open", (payload) =>
      setLandmark(payload),
    );
    return () => {
      offDialogue();
      offChallenge();
      offLandmark();
    };
  }, []);

  // ── Completion detection. ──────────────────────────────────────────────────
  const allComplete = useGameStore((s) =>
    bundle && bundle.quests.length > 0
      ? bundle.quests.every((q) => s.questStatus[q.id] === "complete")
      : false,
  );
  const showCompletion = allComplete && !completionDismissed && introDone;

  // ── Lock Phaser input whenever an overlay is open. ─────────────────────────
  const anyOverlayOpen =
    characterOpen ||
    !!dialogueNpc ||
    !!challengeId ||
    !!chatNpc ||
    !!landmark ||
    showCompletion;

  useEffect(() => {
    eventBus.emit("overlay:changed", { open: anyOverlayOpen });
  }, [anyOverlayOpen]);

  // ── Keyboard shortcuts (Q quests, C hero, Esc close). ──────────────────────
  const closeTop = useCallback(() => {
    if (chatNpc) return setChatNpc(null);
    if (challengeId) return setChallengeId(null);
    if (landmark) return setLandmark(null);
    if (dialogueNpc) return setDialogueNpc(null);
    if (characterOpen) return setCharacterOpen(false);
  }, [chatNpc, challengeId, landmark, dialogueNpc, characterOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing =
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement;
      if (e.key === "Escape") {
        closeTop();
        return;
      }
      if (typing) return;
      if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        setCharacterOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeTop]);

  const exitToTitle = useCallback(() => router.push("/"), [router]);

  // ── Render states. ─────────────────────────────────────────────────────────
  if (error) {
    return (
      <FullscreenMessage title="Couldn't load your game" body={error}>
        <div className="flex flex-col gap-3">
          <button className="cv-btn cv-btn-primary" onClick={() => location.reload()}>
            Retry
          </button>
          <button className="cv-btn" onClick={exitToTitle}>
            Back to title
          </button>
        </div>
      </FullscreenMessage>
    );
  }

  if (!bundle) {
    return (
      <FullscreenMessage
        title="Loading your world…"
        body="Fetching your saved adventure."
      />
    );
  }

  if (!introDone) {
    return <IntroCutscene bundle={bundle} onBegin={() => setIntroDone(true)} />;
  }

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-ink">
      {/* Phaser canvas */}
      <PhaserGame bundle={bundle} />

      {/* React HUD overlays */}
      <Hud
        bundle={bundle}
        onToggleCharacter={() => setCharacterOpen((v) => !v)}
      />
      <InteractionPrompt />
      <QuestTracker bundle={bundle} />
      <Toaster />
      <MobileControls />

      {characterOpen && (
        <CharacterSheet bundle={bundle} onClose={() => setCharacterOpen(false)} />
      )}
      {dialogueNpc && (
        <DialogueBox
          bundle={bundle}
          npcId={dialogueNpc}
          onClose={() => setDialogueNpc(null)}
          onOpenChat={(npcId) => {
            setDialogueNpc(null);
            setChatNpc(npcId);
          }}
        />
      )}
      {challengeId && (
        <ChallengeModal
          bundle={bundle}
          challengeId={challengeId}
          onClose={() => setChallengeId(null)}
        />
      )}
      {chatNpc && (
        <ChatPanel
          bundle={bundle}
          npcId={chatNpc}
          onClose={() => setChatNpc(null)}
        />
      )}
      {landmark && (
        <LandmarkCard
          landmark={landmark.landmark}
          region={landmark.region}
          onClose={() => setLandmark(null)}
        />
      )}
      {showCompletion && (
        <CompletionScreen
          bundle={bundle}
          onClose={() => setCompletionDismissed(true)}
          onExit={exitToTitle}
        />
      )}
    </main>
  );
}

export default function PlayPage() {
  return (
    <Suspense
      fallback={
        <FullscreenMessage title="Loading…" body="Preparing your adventure." />
      }
    >
      <PlayInner />
    </Suspense>
  );
}
