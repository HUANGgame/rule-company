import type {
  ActiveSabotage,
  ChatMessage,
  GamePhase,
  GameState,
  PlayerPublic,
  PrivatePlayerState,
  RoomSummary
} from "@rule-company/shared";
import { getGameConfig } from "./config.js";
import { employeeRoles, rules, sabotages, shopItems, spiritualEvents, tasks } from "./content.js";

interface RoomRuntime {
  name: string;
  createdAt: number;
  botsAdded: boolean;
  nextBotActionAt: number;
  state: GameState;
  privateByPlayer: Map<string, PrivatePlayerState>;
  socketsByPlayer: Map<string, string>;
}

const rooms = new Map<string, RoomRuntime>();

const phaseOrder: GamePhase[] = ["preparation", "work", "meeting", "event", "final_work", "escape", "ended"];
const botJoinDelayMs = 25_000;
const botActionIntervalMs = 2_500;
const botNames = ["實習員小林", "稽核機器人", "夜班支援員", "資料助理"];
const taskTargets: Record<string, { x: number; y: number }> = {
  Reception: { x: 360, y: 360 },
  Archive: { x: 180, y: 130 },
  Accounting: { x: 790, y: 420 },
  "Meeting Room": { x: 450, y: 140 },
  "Server Room": { x: 170, y: 410 },
  "Break Room": { x: 790, y: 300 },
  "Executive Office": { x: 790, y: 140 },
  "Exit Gate": { x: 490, y: 520 }
};

export function createRoom(name: string, owner: { id: string; name: string }) {
  const id = `room-${Math.random().toString(36).slice(2, 8)}`;
  const room: RoomRuntime = {
    name,
    createdAt: Date.now(),
    botsAdded: false,
    nextBotActionAt: 0,
    state: {
      roomId: id,
      status: "waiting",
      phase: "preparation",
      workProgress: 0,
      players: [],
      tasks,
      activeTasks: [],
      activeEvents: [],
      activeSabotages: [],
      chat: [],
      logs: [`${owner.name} 建立了房間 ${name}`]
    },
    privateByPlayer: new Map(),
    socketsByPlayer: new Map()
  };
  rooms.set(id, room);
  joinRoom(id, owner);
  return room.state;
}

export function listRooms(): RoomSummary[] {
  const config = getGameConfig();
  return [...rooms.values()].map((room) => ({
    id: room.state.roomId,
    name: room.name,
    status: room.state.status,
    playerCount: room.state.players.length,
    maxPlayers: config.room.maxPlayers,
    minPlayers: config.room.minPlayers
  }));
}

export function getRoom(roomId: string) {
  return rooms.get(roomId);
}

export function joinRoom(roomId: string, user: { id: string; name: string }, socketId?: string) {
  const room = rooms.get(roomId);
  if (!room) throw new Error("Room not found");
  let player = room.state.players.find((entry) => entry.id === user.id);
  if (!player) {
    const config = getGameConfig();
    if (room.state.players.length >= config.room.maxPlayers) throw new Error("Room is full");
    player = {
      id: user.id,
      name: user.name,
      hearts: config.player.hearts,
      alive: true,
      score: 0,
      x: config.player.startX + room.state.players.length * config.player.startSpacing,
      y: config.player.startY,
      currentArea: "Reception",
      ready: false
    };
    room.state.players.push(player);
    room.state.logs.unshift(`${user.name} 加入房間`);
  }
  if (socketId) room.socketsByPlayer.set(user.id, socketId);
  return room;
}

export function toggleReady(roomId: string, playerId: string) {
  const room = mustRoom(roomId);
  const player = mustPlayer(room, playerId);
  player.ready = !player.ready;
  return room.state;
}

export function startMatch(roomId: string, devMode = true) {
  const room = mustRoom(roomId);
  const config = getGameConfig();
  const minPlayers = devMode ? config.room.devMinPlayers : config.room.minPlayers;
  if (room.state.players.length < minPlayers) throw new Error(`至少需要 ${minPlayers} 人開始`);
  if (room.state.status === "playing") return room.state;

  const boss = pick(room.state.players);
  room.privateByPlayer.clear();
  room.state.players.forEach((player, index) => {
    const isBoss = player.id === boss.id;
    const role = employeeRoles[index % employeeRoles.length];
    const privateRule = rules[(index * 3 + Math.floor(Math.random() * rules.length)) % rules.length];
    player.faction = isBoss ? "boss" : "employee";
    player.isBoss = isBoss;
    player.employeeRoleId = isBoss ? undefined : role.id;
    player.hearts = config.player.hearts;
    player.alive = true;
    player.score = 0;
    player.x = config.player.startX + index * config.player.startSpacing;
    player.y = config.player.startY;
    player.currentArea = "Reception";
    room.privateByPlayer.set(player.id, {
      faction: isBoss ? "boss" : "employee",
      privateRule,
      employeeRole: isBoss ? undefined : role,
      itemEffects: {
        taskBoosts: 0,
        usedItems: []
      },
      bossState: isBoss
        ? {
            playerId: player.id,
            sabotageEnergy: config.boss.initialEnergy,
            maxSabotageEnergy: config.boss.maxEnergy,
            suspicionLevel: 0,
            availableSabotages: sabotages.slice(0, config.boss.initialSabotageCount).map((entry) => entry.id),
            usedSabotages: [],
            cooldowns: {}
          }
        : undefined
    });
  });

  room.state.status = "playing";
  room.state.matchId = `match-${Date.now()}`;
  room.state.startedAt = Date.now();
  room.state.workProgress = 0;
  room.state.activeTasks = [];
  room.state.activeEvents = [];
  room.state.activeSabotages = [];
  setPhase(room, "preparation");
  room.state.logs.unshift("系統已分配老闆、員工職業與私人規則");
  return room.state;
}

export function setPhase(room: RoomRuntime, phase: GamePhase) {
  room.state.phase = phase;
  room.state.phaseEndsAt = phase === "ended" ? undefined : Date.now() + getGameConfig().phases[phase] * 1000;
  if (phase === "ended") {
    room.state.status = "ended";
    room.state.endedAt = Date.now();
    room.state.logs.unshift("下班鐘響起，本局結束");
  } else {
    room.state.logs.unshift(`進入 ${phase} 階段`);
  }
}

export function tickRooms() {
  for (const room of rooms.values()) {
    const now = Date.now();
    if (room.state.status === "waiting") {
      maybeAddBots(room, now);
      continue;
    }
    if (room.state.status !== "playing") continue;
    room.state.activeTasks = room.state.activeTasks.filter((task) => {
      if (task.endsAt > now) return true;
      const player = room.state.players.find((entry) => entry.id === task.playerId);
      const taskDef = tasks.find((entry) => entry.id === task.taskId);
      if (player && taskDef && player.alive) {
        player.score += taskDef.score;
        room.state.workProgress = Math.min(100, room.state.workProgress + Math.ceil(taskDef.score / getGameConfig().scoring.taskWorkDivisor));
        room.state.logs.unshift(`${player.name} 完成 ${taskDef.name}`);
      }
      return false;
    });
    room.state.activeSabotages = room.state.activeSabotages.filter((entry) => entry.endsAt > now);
    room.state.activeEvents = room.state.activeEvents.filter((entry) => {
      const started = Number(entry.id.split("@")[1] || now);
      return started + entry.duration * 1000 > now;
    });

    if (room.state.workProgress >= 100 && room.state.phase !== "escape" && room.state.phase !== "ended") {
      setPhase(room, "escape");
    }

    if (room.state.phaseEndsAt && room.state.phaseEndsAt <= now) {
      advancePhase(room);
    }

    runBotActions(room, now);
  }
}

export function advancePhase(room: RoomRuntime) {
  const currentIndex = phaseOrder.indexOf(room.state.phase);
  const next = phaseOrder[Math.min(currentIndex + 1, phaseOrder.length - 1)];
  if (next === "event") triggerSpiritualEvent(room);
  setPhase(room, next);
}

export function movePlayer(roomId: string, playerId: string, dx: number, dy: number) {
  const room = mustRoom(roomId);
  const player = mustPlayer(room, playerId);
  if (!player.alive || room.state.status !== "playing") return room.state;
  const slowed = room.state.activeSabotages.some((entry) => entry.targetId === playerId && entry.sabotageId === "trip");
  const config = getGameConfig();
  const speed = slowed ? config.player.slowedMoveSpeed : config.player.moveSpeed;
  player.x = clamp(player.x + Math.sign(dx) * speed, 30, 930);
  player.y = clamp(player.y + Math.sign(dy) * speed, 40, 560);
  player.currentArea = areaFor(player.x, player.y);
  return room.state;
}

export function startTask(roomId: string, playerId: string, taskId: string) {
  const room = mustRoom(roomId);
  const player = mustPlayer(room, playerId);
  const privateState = room.privateByPlayer.get(playerId);
  const task = tasks.find((entry) => entry.id === taskId);
  if (!task) throw new Error("Task not found");
  if (player.faction === "boss") throw new Error("老闆不用完成工作");
  if (!player.alive) throw new Error("已淘汰玩家不能工作");
  if (player.currentArea !== task.area) throw new Error(`請先前往 ${task.area}`);
  if (room.state.activeTasks.some((entry) => entry.playerId === playerId)) throw new Error("已有進行中的任務");
  let multiplier = room.state.activeEvents.some((entry) => entry.effectType === "printer_noise") && ["Reception", "Archive"].includes(task.area) ? 1.4 : 1;
  if ((privateState?.itemEffects?.taskBoosts || 0) > 0) {
    multiplier *= 0.75;
    privateState!.itemEffects!.taskBoosts -= 1;
  }
  room.state.activeTasks.push({
    playerId,
    taskId,
    startedAt: Date.now(),
    endsAt: Date.now() + task.duration * multiplier * 1000,
    progress: 0
  });
  room.state.logs.unshift(`${player.name} 開始 ${task.name}`);
  return room.state;
}

export function useInventoryItem(roomId: string, playerId: string, itemId: string) {
  const room = mustRoom(roomId);
  const player = mustPlayer(room, playerId);
  const privateState = room.privateByPlayer.get(playerId);
  const item = shopItems.find((entry) => entry.id === itemId && entry.available);
  if (!item) throw new Error("Item not found");
  if (!privateState) throw new Error("Match has not started");
  if (room.state.status !== "playing") throw new Error("道具只能在遊戲開始後使用");
  privateState.itemEffects ||= { taskBoosts: 0, usedItems: [] };

  if (item.effectType === "resist_darkness") {
    const before = room.state.activeSabotages.length;
    room.state.activeSabotages = room.state.activeSabotages.filter((entry) => entry.sabotageId !== "lights-out");
    if (before === room.state.activeSabotages.length) throw new Error("目前沒有熄燈干擾");
  } else if (item.effectType === "unlock_once") {
    const before = room.state.activeSabotages.length;
    room.state.activeSabotages = room.state.activeSabotages.filter((entry) => entry.sabotageId !== "lock-door" || entry.area !== player.currentArea);
    if (before === room.state.activeSabotages.length) throw new Error("目前區域沒有門禁鎖定");
  } else if (item.effectType === "task_boost") {
    privateState.itemEffects.taskBoosts += 1;
  } else {
    throw new Error("此道具目前不能在遊戲中使用");
  }

  privateState.itemEffects.usedItems.unshift(itemId);
  room.state.logs.unshift(`${player.name} 使用 ${item.name}`);
  return room.state;
}

export function useSabotage(roomId: string, playerId: string, sabotageId: string, targetId?: string, area?: string) {
  const room = mustRoom(roomId);
  const privateState = room.privateByPlayer.get(playerId);
  if (!privateState?.bossState) throw new Error("只有老闆可以使用干擾");
  const sabotage = sabotages.find((entry) => entry.id === sabotageId);
  if (!sabotage) throw new Error("Sabotage not found");
  const now = Date.now();
  if ((privateState.bossState.cooldowns[sabotageId] || 0) > now) throw new Error("技能冷卻中");
  if (privateState.bossState.sabotageEnergy < sabotage.energyCost) throw new Error("干擾能量不足");
  privateState.bossState.sabotageEnergy -= sabotage.energyCost;
  privateState.bossState.suspicionLevel += sabotage.suspicionGain;
  privateState.bossState.cooldowns[sabotageId] = now + sabotage.cooldown * 1000;
  privateState.bossState.usedSabotages.push(sabotageId);
  const active: ActiveSabotage = {
    id: `${sabotageId}-${now}`,
    sabotageId,
    name: sabotage.name,
    targetId,
    area,
    endsAt: now + (sabotage.duration || 8) * 1000
  };
  room.state.activeSabotages.push(active);
  room.state.logs.unshift(`老闆使用了 ${sabotage.name}`);
  return room.state;
}

export function guessRule(roomId: string, guesserId: string, targetId: string, guessedRuleId: string) {
  const room = mustRoom(roomId);
  const guesser = mustPlayer(room, guesserId);
  const target = mustPlayer(room, targetId);
  const targetPrivate = room.privateByPlayer.get(targetId);
  if (!targetPrivate) throw new Error("Target private state missing");
  const correct = targetPrivate.privateRule.id === guessedRuleId;
  if (correct) {
    target.alive = false;
    guesser.score += Math.max(10, target.score);
    room.state.logs.unshift(`${guesser.name} 猜中 ${target.name} 的私人規則，${target.name} 被淘汰`);
  } else {
    guesser.hearts -= 1;
    if (guesser.hearts <= 0) guesser.alive = false;
    room.state.logs.unshift(`${guesser.name} 猜錯規則並失去 1 心`);
  }
  return {
    state: room.state,
    result: {
      correct,
      targetId,
      guessedRuleId,
      message: correct ? "猜中，目標被淘汰" : "猜錯，扣 1 心"
    }
  };
}

export function addChat(roomId: string, senderId: string, senderName: string, message: string, channel: ChatMessage["channel"] = "game") {
  const room = mustRoom(roomId);
  const chat: ChatMessage = {
    id: `chat-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    senderId,
    senderName,
    channel,
    message: message.slice(0, 240),
    createdAt: new Date().toISOString()
  };
  room.state.chat.unshift(chat);
  room.state.chat = room.state.chat.slice(0, 80);
  return room.state;
}

export function getPrivate(roomId: string, playerId: string) {
  return mustRoom(roomId).privateByPlayer.get(playerId);
}

export function rechargeBossEnergy() {
  for (const room of rooms.values()) {
    for (const privateState of room.privateByPlayer.values()) {
      if (privateState.bossState) {
        const config = getGameConfig();
        privateState.bossState.sabotageEnergy = Math.min(
          privateState.bossState.maxSabotageEnergy,
          privateState.bossState.sabotageEnergy + config.boss.rechargePerSecond
        );
      }
    }
  }
}

function maybeAddBots(room: RoomRuntime, now: number) {
  if (room.botsAdded || now - room.createdAt < botJoinDelayMs) return;
  const config = getGameConfig();
  const openSlots = Math.max(0, config.room.maxPlayers - room.state.players.length);
  const botCount = Math.min(2, openSlots);
  if (!botCount) return;

  for (let index = 0; index < botCount; index += 1) {
    const botIndex = room.state.players.filter((player) => player.isBot).length;
    const name = botNames[botIndex % botNames.length];
    const player: PlayerPublic = {
      id: `bot-${room.state.roomId}-${botIndex + 1}`,
      name,
      hearts: config.player.hearts,
      alive: true,
      score: 0,
      x: config.player.startX + room.state.players.length * config.player.startSpacing,
      y: config.player.startY,
      currentArea: "Reception",
      ready: true,
      isBot: true
    };
    room.state.players.push(player);
    room.state.logs.unshift(`${name} 加入匹配並已準備`);
  }
  room.botsAdded = true;
}

function runBotActions(room: RoomRuntime, now: number) {
  if (now < room.nextBotActionAt) return;
  room.nextBotActionAt = now + botActionIntervalMs;

  for (const bot of room.state.players.filter((player) => player.isBot && player.alive)) {
    const privateState = room.privateByPlayer.get(bot.id);
    if (privateState?.bossState) {
      runBossBot(room, bot);
    } else {
      runEmployeeBot(room, bot);
    }
  }
}

function runEmployeeBot(room: RoomRuntime, bot: PlayerPublic) {
  if (room.state.activeTasks.some((entry) => entry.playerId === bot.id)) return;
  const task = chooseBotTask(room, bot);
  const target = taskTargets[task.area] || taskTargets.Reception;
  moveBotToward(bot, target.x, target.y);
  bot.currentArea = areaFor(bot.x, bot.y);
  if (bot.currentArea === task.area || distance(bot.x, bot.y, target.x, target.y) < 28) {
    bot.x = target.x;
    bot.y = target.y;
    bot.currentArea = task.area;
    try {
      startTask(room.state.roomId, bot.id, task.id);
    } catch {
      // Bot AI is opportunistic; if a task cannot start this tick it will retry later.
    }
  }
}

function runBossBot(room: RoomRuntime, bot: PlayerPublic) {
  const privateState = room.privateByPlayer.get(bot.id);
  const bossState = privateState?.bossState;
  if (!bossState) return;
  const available = sabotages.filter((sabotage) => {
    const ready = (bossState.cooldowns[sabotage.id] || 0) <= Date.now();
    return ready && bossState.sabotageEnergy >= sabotage.energyCost;
  });
  const sabotage = available[0];
  if (!sabotage) return;
  const target = room.state.players.find((player) => !player.isBot && player.id !== bot.id && player.alive) || room.state.players.find((player) => player.id !== bot.id && player.alive);
  try {
    useSabotage(room.state.roomId, bot.id, sabotage.id, target?.id, target?.currentArea || bot.currentArea);
  } catch {
    // Cooldowns and energy can change between selection and use.
  }
}

function chooseBotTask(room: RoomRuntime, bot: PlayerPublic) {
  const completedOffset = bot.score % tasks.length;
  return tasks[(room.state.players.indexOf(bot) + completedOffset) % tasks.length] || tasks[0];
}

function moveBotToward(player: PlayerPublic, targetX: number, targetY: number) {
  const config = getGameConfig();
  const dx = targetX - player.x;
  const dy = targetY - player.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const step = config.player.moveSpeed;
  player.x = clamp(player.x + (dx / length) * step, 30, 930);
  player.y = clamp(player.y + (dy / length) * step, 40, 560);
}

function distance(x1: number, y1: number, x2: number, y2: number) {
  return Math.hypot(x2 - x1, y2 - y1);
}

function triggerSpiritualEvent(room: RoomRuntime) {
  const event = pick(spiritualEvents);
  room.state.activeEvents.push({ ...event, id: `${event.id}@${Date.now()}` });
  room.state.logs.unshift(`靈性事件觸發：${event.name}`);
}

function mustRoom(roomId: string) {
  const room = rooms.get(roomId);
  if (!room) throw new Error("Room not found");
  return room;
}

function mustPlayer(room: RoomRuntime, playerId: string) {
  const player = room.state.players.find((entry) => entry.id === playerId);
  if (!player) throw new Error("Player not found");
  return player;
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function areaFor(x: number, y: number) {
  if (x >= 430 && x <= 550 && y > 490) return "Exit Gate";
  if (x > 704 && y > 344) return "Accounting";
  if (x > 704 && y > 236) return "Break Room";
  if (x > 704) return "Executive Office";
  if (x < 285 && y > 330) return "Server Room";
  if (x < 350 && y < 180) return "Archive";
  if (x >= 340 && x < 620 && y < 240) return "Meeting Room";
  return "Reception";
}
