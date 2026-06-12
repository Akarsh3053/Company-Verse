"use client";

import { useEffect, useMemo, useState } from "react";
import { eventBus } from "@/game/eventBus";
import type { GameBundle } from "@/types/bundle";

interface MinimapProps {
  bundle: GameBundle;
}

const W = 190;
const H = 150;
const PAD = 16;

/** Region/landmark minimap with a live player marker. Click a region to focus. */
export default function Minimap({ bundle }: MinimapProps) {
  const [player, setPlayer] = useState({
    x: bundle.player.spawn.x,
    y: bundle.player.spawn.y,
  });

  useEffect(() => {
    return eventBus.on("player:moved", (pos) => setPlayer(pos));
  }, []);

  const bounds = useMemo(() => {
    const xs = [bundle.world.spawn.x, ...bundle.world.regions.map((r) => r.position.x)];
    const ys = [bundle.world.spawn.y, ...bundle.world.regions.map((r) => r.position.y)];
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return { minX, maxX, minY, maxY };
  }, [bundle]);

  const project = (x: number, y: number) => {
    const { minX, maxX, minY, maxY } = bounds;
    const sx =
      maxX === minX ? W / 2 : PAD + ((x - minX) / (maxX - minX)) * (W - 2 * PAD);
    const sy =
      maxY === minY ? H / 2 : PAD + ((y - minY) / (maxY - minY)) * (H - 2 * PAD);
    return { sx, sy };
  };

  const nexus = project(bundle.world.spawn.x, bundle.world.spawn.y);
  const p = project(player.x, player.y);

  return (
    <div className="pointer-events-auto fixed bottom-3 left-3 z-30 hidden sm:block">
      <div className="cv-panel-raised p-1">
        <svg width={W} height={H} className="block">
          <rect x={0} y={0} width={W} height={H} fill="#0b1020" />

          {/* Connections */}
          {bundle.world.connections.map((c) => {
            const a = bundle.world.regions.find((r) => r.id === c.source);
            const b = bundle.world.regions.find((r) => r.id === c.target);
            if (!a || !b) return null;
            const pa = project(a.position.x, a.position.y);
            const pb = project(b.position.x, b.position.y);
            return (
              <line
                key={c.id}
                x1={pa.sx}
                y1={pa.sy}
                x2={pb.sx}
                y2={pb.sy}
                stroke={c.type === "bridge" ? "#8b5a2b" : "#5b6b8c"}
                strokeWidth={1.5}
              />
            );
          })}

          {/* Nexus */}
          <rect
            x={nexus.sx - 3}
            y={nexus.sy - 3}
            width={6}
            height={6}
            fill="#facc15"
          />

          {/* Regions */}
          {bundle.world.regions.map((region) => {
            const { sx, sy } = project(region.position.x, region.position.y);
            return (
              <g
                key={region.id}
                className="cursor-pointer"
                onClick={() =>
                  eventBus.emit("camera:focusRegion", { regionId: region.id })
                }
              >
                <circle cx={sx} cy={sy} r={7} fill={region.color} stroke="#0b1020" strokeWidth={1.5} />
                <title>{region.name}</title>
              </g>
            );
          })}

          {/* Player */}
          <circle cx={p.sx} cy={p.sy} r={3.5} fill="#ffffff" stroke="#0b1020" strokeWidth={1} />
        </svg>
      </div>
    </div>
  );
}
