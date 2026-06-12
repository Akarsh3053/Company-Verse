// ─────────────────────────────────────────────────────────────────────────────
// CompanyVerse — GameBundle data contract.
//
// These interfaces mirror the backend's Pydantic models EXACTLY (verified against
// backend/app/models/*). Field names and shapes are the public contract — do not
// rename. All coordinates are pixel positions on the world canvas.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Input ───────────────────────────────────────────────────────────────────
export type ExperienceLevel =
  | "intern"
  | "junior"
  | "mid"
  | "senior"
  | "lead"
  | "executive";

export interface UserPersona {
  name: string; // required, min length 1
  email: string; // required, must contain "@"
  role: string; // required, e.g. "Junior Software Engineer"
  department?: string | null; // optional (inferred if omitted)
  team?: string | null; // optional
  experience_level?: ExperienceLevel | null; // optional (inferred from role)
  bio?: string | null; // free-text "about me"
  start_date?: string | null;
  goals?: string[]; // optional explicit learning goals
}

// ─── Geometry ──────────────────────────────────────────────────────────────────
export interface Position {
  x: number;
  y: number;
} // pixel coords

// ─── World ───────────────────────────────────────────────────────────────────
export interface Landmark {
  id: string;
  name: string;
  landmark_type: string; // "spire"|"bastion"|"gateway"|"observatory"|"plaza"|"keep"|"tower"|"worksite"|…
  source_type: "system" | "project";
  source_id: string;
  description: string;
  position: Position;
  criticality?: string | null;
  tags: string[];
  metadata: Record<string, string>; // may include {icon, status, …}
}

export interface Region {
  id: string;
  name: string;
  biome: string; // see assetMap for the finite set
  theme: string;
  department: string;
  source_team: string;
  description: string;
  position: Position; // region centre on the world canvas
  color: string; // hex, e.g. "#2563EB" — biome tint
  icon: string; // emoji glyph (fallback / minimap)
  lead?: string | null;
  member_count: number;
  landmarks: Landmark[];
  knowledge_doc_ids: string[];
}

export interface Connection {
  id: string;
  source: string; // region id
  target: string; // region id
  type: "road" | "bridge";
  reason: string;
}

export interface WorldMetadata {
  world_id: string;
  name: string;
  company_name: string;
  industry?: string | null;
  description: string;
  provider: string;
  generator_version: string;
  seed: number;
  generated_at: string;
  region_count: number;
  landmark_count: number;
  connection_count: number;
  employee_count: number;
  content_hash: string;
}

export interface World {
  metadata: WorldMetadata;
  spawn: Position; // world centre / company nexus
  regions: Region[];
  connections: Connection[];
}

// ─── NPCs & dialogue ───────────────────────────────────────────────────────────
export type NPCCategory =
  | "Guild Master"
  | "Guide"
  | "Guardian"
  | "Sage"
  | "Oracle"
  | "Sentinel"
  | "Artificer"
  | "Architect"
  | "Ranger";

export interface NPC {
  id: string;
  name: string;
  title: string;
  role: NPCCategory;
  region_id: string; // which region they stand in
  source_employee: string;
  sprite_type: string; // "sentinel"|"oracle"|"guardian"|"artificer"|"ranger"|"guild_master"|"architect"|"sage"|"guide"
  persona: string;
  expertise: string[];
  knowledge_scope: string[];
  lore: string;
  metadata: Record<string, string>;
}

export type DialogueNodeType =
  | "greeting"
  | "info"
  | "quest_offer"
  | "quest_active"
  | "quest_complete"
  | "farewell";

export interface DialogueChoice {
  id: string;
  text: string;
  next_node_id?: string | null;
  triggers_quest_id?: string | null; // selecting this offers/starts a quest
  ends_dialogue: boolean;
}

export interface DialogueNode {
  id: string;
  type: DialogueNodeType;
  speaker: string;
  text: string;
  choices: DialogueChoice[];
  quest_id?: string | null;
}

export interface DialogueTree {
  npc_id: string;
  root_node_id: string;
  nodes: DialogueNode[];
}

// ─── Quests ────────────────────────────────────────────────────────────────────
export type QuestDifficulty = "intro" | "easy" | "medium" | "hard";
export type QuestStatus = "locked" | "available" | "active" | "complete";
export type ObjectiveType = "talk" | "explore" | "challenge" | "read" | "decision";

export interface Reward {
  xp: number;
  knowledge_points: number;
  badge?: string | null;
  stat_gains: Record<string, number>;
  unlocks: string[]; // quest ids to flip to "available"
}

export interface QuestObjective {
  id: string;
  description: string;
  type: ObjectiveType;
  target_npc_id?: string | null;
  target_region_id?: string | null;
  target_landmark_id?: string | null;
  challenge_id?: string | null;
  knowledge_doc_ids: string[];
  completed: boolean;
}

export interface Quest {
  id: string;
  title: string;
  summary: string;
  narrative: string;
  region_id: string;
  giver_npc_id?: string | null;
  order: number;
  difficulty: QuestDifficulty;
  objectives: QuestObjective[];
  challenge_ids: string[];
  reward: Reward;
  knowledge_doc_ids: string[];
  source: string; // human-readable provenance
  status: QuestStatus; // initial server-side status
  prerequisites: string[]; // quest ids that must complete first
  tags: string[];
}

// ─── Challenges ──────────────────────────────────────────────────────────────
export type ChallengeType = "quiz" | "decision" | "scenario" | "ordering";
export type ChallengeDifficulty = "intro" | "easy" | "medium" | "hard";

export interface ChallengeOption {
  id: string;
  text: string;
  is_correct: boolean; // NOTE: present in payload; never reveal pre-answer
  feedback: string; // shown after this option is picked
  order_index?: number | null; // for "ordering" challenges (1-based)
}

export interface Challenge {
  id: string;
  quest_id: string;
  type: ChallengeType;
  title: string;
  prompt: string;
  scenario?: string | null;
  options: ChallengeOption[];
  explanation: string; // teaching point shown on completion
  difficulty: ChallengeDifficulty;
  reward_xp: number;
  knowledge_doc_ids: string[];
}

// ─── Player ────────────────────────────────────────────────────────────────────
export interface PlayerCharacter {
  id: string;
  display_name: string;
  role: string;
  title: string;
  sprite_type: string; // "player"
  home_region_id: string;
  spawn: Position;
  level: number;
  xp: number;
  stats: Record<string, number>; // 0–100 knowledge stats; grow on quest complete
  backstory: string;
  avatar_color?: string | null; // tint the player sprite
}

// ─── The bundle ────────────────────────────────────────────────────────────────
export interface GameBundleMetadata {
  bundle_id: string;
  user_key: string;
  persona_name: string;
  persona_role: string;
  home_region_id: string;
  provider: string; // "local" | "foundry"
  llm_provider: string; // "local" | "azure_openai" | "foundry"
  generator_version: string;
  generated_at: string;
  quest_count: number;
  npc_count: number;
  challenge_count: number;
  region_count: number;
  grounding_doc_ids: string[];
  content_hash: string;
}

export interface GameBundle {
  metadata: GameBundleMetadata;
  persona: UserPersona;
  narrative_intro: string; // opening cutscene narration
  player: PlayerCharacter;
  world: World;
  npcs: NPC[];
  dialogues: DialogueTree[]; // one per NPC (match on npc_id)
  quests: Quest[]; // ordered by `order`
  challenges: Challenge[]; // resolve via quest.challenge_ids / objective.challenge_id
}

// ─── Chat ──────────────────────────────────────────────────────────────────────
export interface ChatMessage {
  role: "player" | "npc";
  content: string;
}
export interface ChatRequest {
  user_key: string;
  npc_id: string;
  message: string;
  history: ChatMessage[];
}
export interface ChatResponse {
  npc_id: string;
  npc_name: string;
  reply: string;
}
