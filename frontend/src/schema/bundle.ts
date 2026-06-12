// ─────────────────────────────────────────────────────────────────────────────
// Zod schema for the GameBundle — boundary validation (frontend.md §6).
//
// Tolerant of optional/extra fields: unknown extra keys are allowed
// (`.passthrough()`), but required fields and enums must validate. On failure,
// the play page shows an error screen with the first few issues; we never boot a
// partial world.
// ─────────────────────────────────────────────────────────────────────────────

import { z } from "zod";

const PositionSchema = z
  .object({
    x: z.number(),
    y: z.number(),
  })
  .passthrough();

const LandmarkSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    landmark_type: z.string(),
    source_type: z.enum(["system", "project"]),
    source_id: z.string(),
    description: z.string(),
    position: PositionSchema,
    criticality: z.string().nullish(),
    tags: z.array(z.string()).default([]),
    metadata: z.record(z.string()).default({}),
  })
  .passthrough();

const RegionSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    biome: z.string(),
    theme: z.string(),
    department: z.string(),
    source_team: z.string(),
    description: z.string(),
    position: PositionSchema,
    color: z.string(),
    icon: z.string(),
    lead: z.string().nullish(),
    member_count: z.number().default(0),
    landmarks: z.array(LandmarkSchema).default([]),
    knowledge_doc_ids: z.array(z.string()).default([]),
  })
  .passthrough();

const ConnectionSchema = z
  .object({
    id: z.string(),
    source: z.string(),
    target: z.string(),
    type: z.enum(["road", "bridge"]),
    reason: z.string(),
  })
  .passthrough();

const WorldMetadataSchema = z
  .object({
    world_id: z.string(),
    name: z.string(),
    company_name: z.string(),
    industry: z.string().nullish(),
    description: z.string(),
    provider: z.string(),
    generator_version: z.string(),
    seed: z.number(),
    generated_at: z.string(),
    region_count: z.number(),
    landmark_count: z.number(),
    connection_count: z.number(),
    employee_count: z.number(),
    content_hash: z.string(),
  })
  .passthrough();

const WorldSchema = z
  .object({
    metadata: WorldMetadataSchema,
    spawn: PositionSchema,
    regions: z.array(RegionSchema).default([]),
    connections: z.array(ConnectionSchema).default([]),
  })
  .passthrough();

const NPCSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    title: z.string(),
    // Backend uses a fixed NPCCategory set, but stay tolerant of new categories.
    role: z.string(),
    region_id: z.string(),
    source_employee: z.string(),
    sprite_type: z.string(),
    persona: z.string(),
    expertise: z.array(z.string()).default([]),
    knowledge_scope: z.array(z.string()).default([]),
    lore: z.string().default(""),
    metadata: z.record(z.string()).default({}),
  })
  .passthrough();

const DialogueChoiceSchema = z
  .object({
    id: z.string(),
    text: z.string(),
    next_node_id: z.string().nullish(),
    triggers_quest_id: z.string().nullish(),
    ends_dialogue: z.boolean().default(false),
  })
  .passthrough();

const DialogueNodeSchema = z
  .object({
    id: z.string(),
    type: z
      .enum([
        "greeting",
        "info",
        "quest_offer",
        "quest_active",
        "quest_complete",
        "farewell",
      ])
      .default("info"),
    speaker: z.string(),
    text: z.string(),
    choices: z.array(DialogueChoiceSchema).default([]),
    quest_id: z.string().nullish(),
  })
  .passthrough();

const DialogueTreeSchema = z
  .object({
    npc_id: z.string(),
    root_node_id: z.string(),
    nodes: z.array(DialogueNodeSchema).default([]),
  })
  .passthrough();

const RewardSchema = z
  .object({
    xp: z.number().default(0),
    knowledge_points: z.number().default(0),
    badge: z.string().nullish(),
    stat_gains: z.record(z.number()).default({}),
    unlocks: z.array(z.string()).default([]),
  })
  .passthrough();

const QuestObjectiveSchema = z
  .object({
    id: z.string(),
    description: z.string(),
    type: z.enum(["talk", "explore", "challenge", "read", "decision"]),
    target_npc_id: z.string().nullish(),
    target_region_id: z.string().nullish(),
    target_landmark_id: z.string().nullish(),
    challenge_id: z.string().nullish(),
    knowledge_doc_ids: z.array(z.string()).default([]),
    completed: z.boolean().default(false),
  })
  .passthrough();

const QuestSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    summary: z.string(),
    narrative: z.string().default(""),
    region_id: z.string(),
    giver_npc_id: z.string().nullish(),
    order: z.number().default(0),
    difficulty: z.enum(["intro", "easy", "medium", "hard"]).default("easy"),
    objectives: z.array(QuestObjectiveSchema).default([]),
    challenge_ids: z.array(z.string()).default([]),
    reward: RewardSchema.default({
      xp: 0,
      knowledge_points: 0,
      stat_gains: {},
      unlocks: [],
    }),
    knowledge_doc_ids: z.array(z.string()).default([]),
    source: z.string().default(""),
    status: z
      .enum(["locked", "available", "active", "complete"])
      .default("locked"),
    prerequisites: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
  })
  .passthrough();

const ChallengeOptionSchema = z
  .object({
    id: z.string(),
    text: z.string(),
    is_correct: z.boolean().default(false),
    feedback: z.string().default(""),
    order_index: z.number().nullish(),
  })
  .passthrough();

const ChallengeSchema = z
  .object({
    id: z.string(),
    quest_id: z.string(),
    type: z.enum(["quiz", "decision", "scenario", "ordering"]),
    title: z.string(),
    prompt: z.string(),
    scenario: z.string().nullish(),
    options: z.array(ChallengeOptionSchema).default([]),
    explanation: z.string().default(""),
    difficulty: z.enum(["intro", "easy", "medium", "hard"]).default("easy"),
    reward_xp: z.number().default(25),
    knowledge_doc_ids: z.array(z.string()).default([]),
  })
  .passthrough();

const PlayerCharacterSchema = z
  .object({
    id: z.string(),
    display_name: z.string(),
    role: z.string(),
    title: z.string(),
    sprite_type: z.string(),
    home_region_id: z.string(),
    spawn: PositionSchema,
    level: z.number().default(1),
    xp: z.number().default(0),
    stats: z.record(z.number()).default({}),
    backstory: z.string().default(""),
    avatar_color: z.string().nullish(),
  })
  .passthrough();

const UserPersonaSchema = z
  .object({
    name: z.string().min(1),
    email: z.string(),
    role: z.string().min(1),
    department: z.string().nullish(),
    team: z.string().nullish(),
    experience_level: z
      .enum(["intern", "junior", "mid", "senior", "lead", "executive"])
      .nullish(),
    bio: z.string().nullish(),
    start_date: z.string().nullish(),
    goals: z.array(z.string()).default([]),
  })
  .passthrough();

const GameBundleMetadataSchema = z
  .object({
    bundle_id: z.string(),
    user_key: z.string(),
    persona_name: z.string(),
    persona_role: z.string(),
    home_region_id: z.string(),
    provider: z.string(),
    llm_provider: z.string(),
    generator_version: z.string(),
    generated_at: z.string(),
    quest_count: z.number(),
    npc_count: z.number(),
    challenge_count: z.number(),
    region_count: z.number(),
    grounding_doc_ids: z.array(z.string()).default([]),
    content_hash: z.string().default(""),
  })
  .passthrough();

export const GameBundleSchema = z
  .object({
    metadata: GameBundleMetadataSchema,
    persona: UserPersonaSchema,
    narrative_intro: z.string().default(""),
    player: PlayerCharacterSchema,
    world: WorldSchema,
    npcs: z.array(NPCSchema).default([]),
    dialogues: z.array(DialogueTreeSchema).default([]),
    quests: z.array(QuestSchema).default([]),
    challenges: z.array(ChallengeSchema).default([]),
  })
  .passthrough();

export type ParsedGameBundle = z.infer<typeof GameBundleSchema>;

export interface BundleParseResult {
  success: boolean;
  /** Present on success. */
  data?: ParsedGameBundle;
  /** Up to a handful of human-readable issues on failure. */
  issues?: string[];
}

/**
 * Validate an unknown payload as a GameBundle. Returns a small list of the first
 * issues on failure (used by the boundary error screen).
 */
export function parseBundle(payload: unknown): BundleParseResult {
  const result = GameBundleSchema.safeParse(payload);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const issues = result.error.issues.slice(0, 8).map((issue) => {
    const path = issue.path.join(".") || "(root)";
    return `${path}: ${issue.message}`;
  });
  return { success: false, issues };
}
