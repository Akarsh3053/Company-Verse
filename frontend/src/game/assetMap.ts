// ─────────────────────────────────────────────────────────────────────────────
// Asset → data binding (frontend.md §12.6). Single source of truth mapping every
// backend enum value to an asset/texture key. Procedural textures are generated
// at runtime in BootScene (no external downloads) under these exact keys.
//
// Always fall back to defaults for unknown enum values so a new backend value
// never breaks rendering.
// ─────────────────────────────────────────────────────────────────────────────

// ── Biomes → tileset keys + palettes ────────────────────────────────────────
export interface BiomePalette {
  /** Base ground tint. */
  ground: number;
  /** Secondary ground / accent (paths, dirt, variation). */
  groundAlt: number;
  /** Water colour (rivers/coast). */
  water: number;
  /** Decorative prop colour (trees, rocks, stalls). */
  prop: number;
  /** Emoji glyph fallback for minimap / labels. */
  icon: string;
}

export const BIOME_TILESET: Record<string, string> = {
  citadel: "tiles_citadel",
  valley: "tiles_valley",
  bazaar: "tiles_bazaar",
  mountains: "tiles_mountains",
  highlands: "tiles_highlands",
  glades: "tiles_glades",
  harbor: "tiles_harbor",
  sanctuary: "tiles_sanctuary",
  frontier: "tiles_frontier",
};

export const DEFAULT_TILESET = "tiles_frontier";

/** Per-biome palettes used to generate tile textures procedurally. */
export const BIOME_PALETTE: Record<string, BiomePalette> = {
  citadel: { ground: 0x6b7280, groundAlt: 0x4b5563, water: 0x2563eb, prop: 0x9ca3af, icon: "🏰" },
  valley: { ground: 0x4ade80, groundAlt: 0x22c55e, water: 0x0ea5e9, prop: 0x166534, icon: "🔭" },
  bazaar: { ground: 0xd6a06a, groundAlt: 0xb87f4a, water: 0x38bdf8, prop: 0xdb2777, icon: "🎨" },
  mountains: { ground: 0x9ca3af, groundAlt: 0x6b7280, water: 0x60a5fa, prop: 0xe5e7eb, icon: "⛰️" },
  highlands: { ground: 0x86efac, groundAlt: 0x4ade80, water: 0x38bdf8, prop: 0x15803d, icon: "🗺️" },
  glades: { ground: 0x86d39a, groundAlt: 0x5fb87a, water: 0x22d3ee, prop: 0x9333ea, icon: "🌸" },
  harbor: { ground: 0xe4c590, groundAlt: 0xcaa86a, water: 0x0ea5e9, prop: 0xf59e0b, icon: "⚓" },
  sanctuary: { ground: 0x99f6e4, groundAlt: 0x5eead4, water: 0x14b8a6, prop: 0x0d9488, icon: "🛡️" },
  frontier: { ground: 0x9caf88, groundAlt: 0x7c8a5f, water: 0x4a90d9, prop: 0x5b6b3a, icon: "🌐" },
};

export const DEFAULT_BIOME = "frontier";

export function biomePalette(biome: string): BiomePalette {
  return BIOME_PALETTE[biome] ?? BIOME_PALETTE[DEFAULT_BIOME];
}

export function biomeTileset(biome: string): string {
  return BIOME_TILESET[biome] ?? DEFAULT_TILESET;
}

// ── Landmarks → sprite keys ──────────────────────────────────────────────────
export const LANDMARK_SPRITE: Record<string, string> = {
  spire: "lm_spire",
  bastion: "lm_bastion",
  observatory: "lm_observatory",
  plaza: "lm_plaza",
  keep: "lm_keep",
  tower: "lm_tower",
  gateway: "lm_gateway",
  worksite: "lm_worksite",
};

export const DEFAULT_LANDMARK = "lm_tower";

export function landmarkSprite(type: string): string {
  return LANDMARK_SPRITE[type] ?? DEFAULT_LANDMARK;
}

export const ALL_LANDMARK_TYPES = Object.keys(LANDMARK_SPRITE);

// ── NPCs → character sprite keys ─────────────────────────────────────────────
export const NPC_SPRITE: Record<string, string> = {
  guild_master: "char_guild_master",
  guide: "char_guide",
  guardian: "char_guardian",
  sage: "char_sage",
  oracle: "char_oracle",
  sentinel: "char_sentinel",
  artificer: "char_artificer",
  architect: "char_architect",
  ranger: "char_ranger",
};

export const DEFAULT_NPC = "char_guide";
export const PLAYER_SPRITE = "char_player";

export function npcSprite(spriteType: string): string {
  return NPC_SPRITE[spriteType] ?? DEFAULT_NPC;
}

export const ALL_NPC_SPRITE_TYPES = Object.keys(NPC_SPRITE);

/** Accent colour per NPC role — used to recolour the shared base body. */
export const NPC_ACCENT: Record<string, number> = {
  guild_master: 0xfacc15,
  guide: 0x38bdf8,
  guardian: 0x9ca3af,
  sage: 0xc084fc,
  oracle: 0xf472b6,
  sentinel: 0xef4444,
  artificer: 0xf59e0b,
  architect: 0x22d3ee,
  ranger: 0x4ade80,
};

export function npcAccent(spriteType: string): number {
  return NPC_ACCENT[spriteType] ?? 0x38bdf8;
}

// ── Shared tile metrics ──────────────────────────────────────────────────────
export const TILE_SIZE = 32;
export const REGION_TILE_RADIUS = 9; // region patch radius in tiles (~288px)
