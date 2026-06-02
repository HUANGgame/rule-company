export type Faction = "employee" | "boss";
export type GamePhase =
  | "preparation"
  | "work"
  | "meeting"
  | "event"
  | "final_work"
  | "escape"
  | "ended";

export type RoomStatus = "waiting" | "playing" | "ended";

export interface PlayerPublic {
  id: string;
  name: string;
  faction?: Faction;
  employeeRoleId?: string;
  isBoss?: boolean;
  hearts: number;
  alive: boolean;
  score: number;
  x: number;
  y: number;
  currentArea: string;
  ready: boolean;
  isBot?: boolean;
}

export interface PrivatePlayerState {
  faction: Faction;
  privateRule: Rule;
  employeeRole?: EmployeeRole;
  bossState?: BossState;
  itemEffects?: ItemEffects;
}

export interface Rule {
  id: string;
  title: string;
  text: string;
  category: string;
  difficulty: number;
}

export interface TaskDef {
  id: string;
  name: string;
  area: string;
  duration: number;
  score: number;
  kind: "sequence" | "memory" | "timing" | "sorting";
  description?: string;
  objective?: string;
  steps?: string[];
  risk?: string;
}

export interface ItemEffects {
  taskBoosts: number;
  usedItems: string[];
}

export interface EmployeeRole {
  id: string;
  name: string;
  description: string;
  activeSkill?: string;
  passiveSkill?: string;
  cooldown: number;
}

export interface Sabotage {
  id: string;
  name: string;
  description: string;
  bossOnly: true;
  energyCost: number;
  cooldown: number;
  duration?: number;
  targetType: "player" | "room" | "object" | "global";
  effectType: string;
  suspicionGain: number;
}

export interface BossState {
  playerId: string;
  sabotageEnergy: number;
  maxSabotageEnergy: number;
  suspicionLevel: number;
  availableSabotages: string[];
  usedSabotages: string[];
  cooldowns: Record<string, number>;
}

export interface SpiritualEvent {
  id: string;
  name: string;
  description: string;
  duration: number;
  effectType: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  channel: "room" | "game" | "meeting" | "spectator";
  message: string;
  createdAt: string;
}

export interface ActiveTask {
  playerId: string;
  taskId: string;
  startedAt: number;
  endsAt: number;
  progress: number;
}

export interface GameState {
  roomId: string;
  matchId?: string;
  status: RoomStatus;
  phase: GamePhase;
  phaseEndsAt?: number;
  workProgress: number;
  players: PlayerPublic[];
  tasks: TaskDef[];
  activeTasks: ActiveTask[];
  activeEvents: SpiritualEvent[];
  activeSabotages: ActiveSabotage[];
  chat: ChatMessage[];
  logs: string[];
  startedAt?: number;
  endedAt?: number;
}

export interface ActiveSabotage {
  id: string;
  sabotageId: string;
  name: string;
  targetId?: string;
  area?: string;
  endsAt: number;
}

export interface RoomSummary {
  id: string;
  name: string;
  status: RoomStatus;
  playerCount: number;
  maxPlayers: number;
  minPlayers: number;
}

export interface GameConfig {
  room: {
    minPlayers: number;
    devMinPlayers: number;
    maxPlayers: number;
  };
  phases: Record<GamePhase, number>;
  player: {
    hearts: number;
    moveSpeed: number;
    slowedMoveSpeed: number;
    startX: number;
    startY: number;
    startSpacing: number;
  };
  boss: {
    initialEnergy: number;
    maxEnergy: number;
    rechargePerSecond: number;
    initialSabotageCount: number;
  };
  scoring: {
    taskWorkDivisor: number;
  };
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  coins: number;
  isAdmin?: boolean;
}

export interface GuessResult {
  correct: boolean;
  targetId: string;
  guessedRuleId: string;
  message: string;
}

export interface CharacterSkin {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  price: number;
  available: boolean;
  faction?: Faction;
}
