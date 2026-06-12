// ─────────────────────────────────────────────────────────────────────────────
// Real-asset manifest.
//
// Maps backend enum values → real art files from the packs in public/assets.
// Loaded in BootScene under the SAME texture keys the procedural factory uses,
// so worldBuilder/entities need no key changes and procedural art remains the
// automatic fallback for anything missing (bake() skips keys already loaded).
//
// Packs & licenses (see public/assets/CREDITS.md):
//  • tiles/tilepack            — Cam Tatz "Top Down Asset Pack 1"  (CC0)
//  • charcters/last-guardian   — Philipp Lenssen "700+ sprites"    (CC-BY 3.0)
// ─────────────────────────────────────────────────────────────────────────────

const CAINOS = "/assets/tiles/tilepack";
// Character frames are pre-processed PNGs (Last Guardian GIFs with their opaque
// white background removed via edge flood-fill — see scripts/convert_chars).
const CHARS = "/assets/characters_png";

// ── Terrain: biome → Cainos fill-tile file ───────────────────────────────────
// All Cainos terrains share a 6×6 autotile layout; tile (8) is the solid "A"
// fill, tile (26) the solid "B" fill. DirtSand's clean fill is (1).
export const BIOME_TERRAIN_FILE: Record<string, string> = {
  citadel: `${CAINOS}/Land_DirtGrass (8).png`, // dirt — earthy fortress ground
  valley: `${CAINOS}/Land_DirtGrass (26).png`, // lush grass
  bazaar: `${CAINOS}/Land_DirtSand (1).png`, // market sand
  mountains: `${CAINOS}/Land_SnowIce (8).png`, // snow
  highlands: `${CAINOS}/Land_DirtGrass (26).png`, // grass plateau
  glades: `${CAINOS}/Land_DirtGrass (26).png`, // grove grass
  harbor: `${CAINOS}/Land_DirtSand (1).png`, // coastal sand
  sanctuary: `${CAINOS}/Land_DirtGrass (26).png`, // garden grass
  frontier: `${CAINOS}/Land_Slime (26).png`, // unknown / purple
};

/** Cainos stone-brick tile used for the company HQ nexus plaza floor. */
export const NEXUS_TILE_FILE = `${CAINOS}/House_Stone (1).png`;

// ── Landmark building parts (Cainos) — composited into landmark textures ─────
// Real wall/door materials; roofs & toppers are drawn as vectors over these.
export const LANDMARK_PART_FILES: Record<string, string> = {
  cainos_wall_stone: `${CAINOS}/House_Stone (1).png`, // gray brick body
  cainos_wall_white: `${CAINOS}/House_White (1).png`, // white plaster body
  cainos_door: `${CAINOS}/Door_Wood (1).png`, // framed door
};

// ── Props: shared catalogue + per-biome selection ────────────────────────────
// Key → file. Loaded once; scattered by worldBuilder, scaled down per type.
export const PROP_FILES: Record<string, string> = {
  prop_tree_autumn: `${CAINOS}/Tree (1).png`,
  prop_tree_olive: `${CAINOS}/Tree (2).png`,
  prop_tree_lime: `${CAINOS}/Tree (3).png`,
  prop_rock_gray: `${CAINOS}/Rock_Gray (1).png`,
  prop_rock_brown: `${CAINOS}/Rock_Brown (1).png`,
  prop_bush_tall: `${CAINOS}/Bush_Tall (1).png`,
  prop_bush_med: `${CAINOS}/Bush_Medium (1).png`,
  prop_bush_small: `${CAINOS}/Bush_Small (1).png`,
  prop_flower_white: `${CAINOS}/Flower (1).png`,
  prop_flower_yellow: `${CAINOS}/Flower (5).png`,
  prop_flower_purple: `${CAINOS}/Flower (9).png`,
  prop_mushroom: `${CAINOS}/Mushroom (1).png`,
  prop_mushroom_evil: `${CAINOS}/Mushroom_Evil (1).png`,
  prop_cactus: `${CAINOS}/Cactus.png`,
  prop_grass: `${CAINOS}/Grass (1).png`,
  prop_steprock: `${CAINOS}/StepRock_Gray (1).png`,
};

/** A placed prop: which texture, its rough display height (px), and weight. */
export interface PropSpec {
  key: string;
  height: number;
}

/** Per-biome prop palette. worldBuilder scatters a few of these per region. */
export const BIOME_PROPS: Record<string, PropSpec[]> = {
  citadel: [
    { key: "prop_rock_gray", height: 34 },
    { key: "prop_steprock", height: 30 },
    { key: "prop_bush_small", height: 26 },
  ],
  valley: [
    { key: "prop_tree_olive", height: 70 },
    { key: "prop_bush_med", height: 32 },
    { key: "prop_grass", height: 22 },
  ],
  bazaar: [
    { key: "prop_cactus", height: 40 },
    { key: "prop_rock_brown", height: 32 },
  ],
  mountains: [
    { key: "prop_rock_gray", height: 40 },
    { key: "prop_steprock", height: 34 },
  ],
  highlands: [
    { key: "prop_bush_med", height: 32 },
    { key: "prop_grass", height: 22 },
    { key: "prop_rock_gray", height: 30 },
  ],
  glades: [
    { key: "prop_tree_lime", height: 74 },
    { key: "prop_flower_purple", height: 24 },
    { key: "prop_mushroom", height: 26 },
  ],
  harbor: [
    { key: "prop_rock_brown", height: 32 },
    { key: "prop_bush_small", height: 26 },
  ],
  sanctuary: [
    { key: "prop_flower_white", height: 24 },
    { key: "prop_flower_yellow", height: 24 },
    { key: "prop_bush_med", height: 30 },
  ],
  frontier: [
    { key: "prop_mushroom_evil", height: 28 },
    { key: "prop_rock_gray", height: 32 },
  ],
};

// ── Characters: backend sprite_type → Last Guardian prefix ───────────────────
// Each prefix has 8 frames: <prefix>_<dir><frame>.gif, dir∈{fr,bk,lf,rt}, frame∈{1,2}.
export const CHAR_ROLE_PREFIX: Record<string, string> = {
  player: "avt1", // blonde adventurer hero
  guild_master: "kin1", // crowned king — regal leader
  guide: "man1", // friendly villager mentor
  guardian: "gsd1", // shield guard
  sage: "wmg1", // white mage — robed elder
  oracle: "amg1", // archmage — mystic
  sentinel: "knt1", // knight — security
  architect: "scr1", // robed scholar / planner
  ranger: "thf1", // green scout
  artificer: "ftr1", // smith / tinkerer
};

export const DEFAULT_CHAR_PREFIX = "man1";

/** Directions in the LG file naming, mapped to our logical directions. */
export const LG_DIRS = ["fr", "bk", "lf", "rt"] as const;
export type LgDir = (typeof LG_DIRS)[number];

/** Texture key for one character frame (e.g. lg_avt1_fr1). */
export function charFrameKey(prefix: string, dir: LgDir, frame: 1 | 2): string {
  return `lg_${prefix}_${dir}${frame}`;
}

/** File path for one character frame. */
export function charFrameFile(prefix: string, dir: LgDir, frame: 1 | 2): string {
  return `${CHARS}/${prefix}_${dir}${frame}.png`;
}

/** The distinct set of prefixes we actually load (deduped). */
export function usedCharPrefixes(): string[] {
  const set = new Set<string>(Object.values(CHAR_ROLE_PREFIX));
  set.add(DEFAULT_CHAR_PREFIX);
  return [...set];
}

/** Animation key for a character walk cycle in a logical direction. */
export function walkAnimKey(prefix: string, dir: LgDir): string {
  return `walk_${prefix}_${dir}`;
}
