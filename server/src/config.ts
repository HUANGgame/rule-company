import fs from "node:fs";
import path from "node:path";
import type { GameConfig, GamePhase } from "@rule-company/shared";
import { z } from "zod";

const configPath = path.resolve(process.cwd(), "data", "game-config.json");

export const defaultGameConfig: GameConfig = {
  room: {
    minPlayers: 4,
    devMinPlayers: 3,
    maxPlayers: 10
  },
  phases: {
    preparation: 25,
    work: 180,
    meeting: 60,
    event: 30,
    final_work: 150,
    escape: 60,
    ended: 0
  },
  player: {
    hearts: 3,
    moveSpeed: 16,
    slowedMoveSpeed: 8,
    startX: 220,
    startY: 360,
    startSpacing: 34
  },
  boss: {
    initialEnergy: 100,
    maxEnergy: 100,
    rechargePerSecond: 4,
    initialSabotageCount: 4
  },
  scoring: {
    taskWorkDivisor: 3
  }
};

const phaseSchema: z.ZodType<Record<GamePhase, number>> = z.object({
  preparation: z.number().int().min(0).max(3600),
  work: z.number().int().min(0).max(3600),
  meeting: z.number().int().min(0).max(3600),
  event: z.number().int().min(0).max(3600),
  final_work: z.number().int().min(0).max(3600),
  escape: z.number().int().min(0).max(3600),
  ended: z.number().int().min(0).max(3600)
});

const configSchema: z.ZodType<GameConfig> = z.object({
  room: z.object({
    minPlayers: z.number().int().min(1).max(20),
    devMinPlayers: z.number().int().min(1).max(20),
    maxPlayers: z.number().int().min(1).max(20)
  }),
  phases: phaseSchema,
  player: z.object({
    hearts: z.number().int().min(1).max(20),
    moveSpeed: z.number().int().min(1).max(80),
    slowedMoveSpeed: z.number().int().min(1).max(80),
    startX: z.number().int().min(0).max(980),
    startY: z.number().int().min(0).max(590),
    startSpacing: z.number().int().min(0).max(120)
  }),
  boss: z.object({
    initialEnergy: z.number().int().min(0).max(1000),
    maxEnergy: z.number().int().min(1).max(1000),
    rechargePerSecond: z.number().int().min(0).max(100),
    initialSabotageCount: z.number().int().min(1).max(20)
  }),
  scoring: z.object({
    taskWorkDivisor: z.number().min(0.25).max(100)
  })
}).superRefine((config, ctx) => {
  if (config.room.minPlayers > config.room.maxPlayers) {
    ctx.addIssue({ code: "custom", path: ["room", "minPlayers"], message: "minPlayers must be <= maxPlayers" });
  }
  if (config.room.devMinPlayers > config.room.maxPlayers) {
    ctx.addIssue({ code: "custom", path: ["room", "devMinPlayers"], message: "devMinPlayers must be <= maxPlayers" });
  }
  if (config.player.slowedMoveSpeed > config.player.moveSpeed) {
    ctx.addIssue({ code: "custom", path: ["player", "slowedMoveSpeed"], message: "slowedMoveSpeed must be <= moveSpeed" });
  }
  if (config.boss.initialEnergy > config.boss.maxEnergy) {
    ctx.addIssue({ code: "custom", path: ["boss", "initialEnergy"], message: "initialEnergy must be <= maxEnergy" });
  }
});

let gameConfig = loadConfig();

export function getGameConfig() {
  return gameConfig;
}

export function updateGameConfig(rawConfig: unknown) {
  const next = configSchema.parse(mergeConfig(defaultGameConfig, rawConfig));
  gameConfig = next;
  persistConfig(next);
  return gameConfig;
}

function loadConfig() {
  try {
    if (!fs.existsSync(configPath)) return defaultGameConfig;
    const parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
    return configSchema.parse(mergeConfig(defaultGameConfig, parsed));
  } catch {
    return defaultGameConfig;
  }
}

function persistConfig(config: GameConfig) {
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

function mergeConfig(base: GameConfig, patch: unknown): GameConfig {
  if (!patch || typeof patch !== "object") return base;
  const partial = patch as Partial<GameConfig>;
  return {
    room: { ...base.room, ...partial.room },
    phases: { ...base.phases, ...partial.phases },
    player: { ...base.player, ...partial.player },
    boss: { ...base.boss, ...partial.boss },
    scoring: { ...base.scoring, ...partial.scoring }
  };
}
