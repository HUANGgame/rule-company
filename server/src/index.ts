import "dotenv/config";
import http from "node:http";
import path from "node:path";
import bcrypt from "bcrypt";
import cors from "cors";
import express from "express";
import { Server } from "socket.io";
import { z } from "zod";
import { createResetToken, fallbackCreatePasswordReset, fallbackLogin, fallbackRegister, fallbackResetPassword, fallbackSpendCoins, isConfiguredAdmin, requireAuth, signUser, type AuthedRequest } from "./auth.js";
import { getAdminContent, removeAdminItem, requireAdmin, setAvailability, upsertAdminItem } from "./admin.js";
import { getGameConfig, updateGameConfig } from "./config.js";
import { prisma } from "./db.js";
import { characterSkins, employeeRoles, rules, sabotages, shopItems, spiritualEvents, tasks } from "./content.js";
import {
  addChat,
  createRoom,
  getPrivate,
  getRoom,
  guessRule,
  joinRoom,
  listRooms,
  movePlayer,
  rechargeBossEnergy,
  startMatch,
  startTask,
  tickRooms,
  toggleReady,
  useSabotage
} from "./game.js";

const app = express();
const server = http.createServer(app);
const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
const io = new Server(server, {
  cors: {
    origin: [clientUrl, "http://localhost:5173", "http://127.0.0.1:5173"],
    credentials: true
  }
});

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4),
  name: z.string().min(2).max(32).optional()
});
const forgotPasswordSchema = z.object({ email: z.string().email() });
const resetPasswordSchema = z.object({
  email: z.string().email(),
  token: z.string().min(16),
  password: z.string().min(8)
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, name: "規則公司", db: Boolean(prisma), time: new Date().toISOString() });
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const input = credentialsSchema.required({ name: true }).parse(req.body);
    const user = prisma
      ? await prisma.user.create({
          data: {
            email: input.email.toLowerCase(),
            name: input.name,
            passwordHash: await bcrypt.hash(input.password, 10),
            coins: 0,
            isAdmin: isConfiguredAdmin(input.email)
          },
          select: { id: true, email: true, name: true, coins: true, isAdmin: true }
        })
      : await fallbackRegister(input.email, input.name, input.password);
    res.json({ user, token: signUser(user) });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Register failed" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const input = credentialsSchema.parse(req.body);
    let user;
    if (prisma) {
      const found = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
      if (!found || !(await bcrypt.compare(input.password, found.passwordHash))) throw new Error("Invalid credentials");
      user = { id: found.id, email: found.email, name: found.name, coins: found.coins, isAdmin: found.isAdmin };
    } else {
      user = await fallbackLogin(input.email, input.password);
    }
    res.json({ user, token: signUser(user) });
  } catch (error) {
    res.status(401).json({ error: error instanceof Error ? error.message : "Login failed" });
  }
});

app.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const input = forgotPasswordSchema.parse(req.body);
    const email = input.email.toLowerCase();
    let token: string | null = null;
    if (prisma) {
      const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (user) {
        token = createResetToken();
        await prisma.passwordResetToken.create({
          data: {
            userId: user.id,
            token,
            expiresAt: new Date(Date.now() + 30 * 60 * 1000)
          }
        });
      }
    } else {
      token = await fallbackCreatePasswordReset(email);
    }
    res.json({
      ok: true,
      message: "If the email exists, a password reset code has been created.",
      resetToken: token,
      resetUrl: token ? `${clientUrl}/?resetToken=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}` : undefined
    });
  } catch (error) {
    res.status(400).json({ error: message(error) });
  }
});

app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const input = resetPasswordSchema.parse(req.body);
    const email = input.email.toLowerCase();
    if (prisma) {
      const reset = await prisma.passwordResetToken.findUnique({
        where: { token: input.token },
        include: { user: true }
      });
      if (!reset || reset.user.email !== email || reset.usedAt || reset.expiresAt.getTime() < Date.now()) {
        throw new Error("Invalid or expired reset code");
      }
      await prisma.user.update({
        where: { id: reset.userId },
        data: { passwordHash: await bcrypt.hash(input.password, 10) }
      });
      await prisma.passwordResetToken.update({
        where: { token: input.token },
        data: { usedAt: new Date() }
      });
    } else {
      await fallbackResetPassword(email, input.token, input.password);
    }
    res.json({ ok: true, message: "Password has been reset. You can sign in with the new password." });
  } catch (error) {
    res.status(400).json({ error: message(error) });
  }
});

app.get("/api/auth/me", requireAuth, (req: AuthedRequest, res) => {
  res.json({ user: req.user });
});

app.post("/api/auth/logout", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/content", (_req, res) => {
  res.json({ rules, tasks, employeeRoles, sabotages, spiritualEvents, shopItems, characterSkins, gameConfig: getGameConfig() });
});

app.get("/api/admin/content", requireAuth, requireAdmin, (_req, res) => {
  res.json(getAdminContent());
});

app.get("/api/admin/game-config", requireAuth, requireAdmin, (_req, res) => {
  res.json({ config: getGameConfig() });
});

app.put("/api/admin/game-config", requireAuth, requireAdmin, (req, res) => {
  try {
    res.json({ config: updateGameConfig(req.body) });
  } catch (error) {
    res.status(400).json({ error: message(error) });
  }
});

app.put("/api/admin/content/:collection/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const item = await upsertAdminItem(String(req.params.collection), { ...req.body, id: String(req.params.id) });
    res.json({ item });
  } catch (error) {
    res.status(400).json({ error: message(error) });
  }
});

app.delete("/api/admin/content/:collection/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    res.json({ item: await removeAdminItem(String(req.params.collection), String(req.params.id)) });
  } catch (error) {
    res.status(400).json({ error: message(error) });
  }
});

app.patch("/api/admin/content/:collection/:id/availability", requireAuth, requireAdmin, async (req, res) => {
  try {
    const item = await setAvailability(String(req.params.collection), String(req.params.id), Boolean(req.body.available));
    res.json({ item });
  } catch (error) {
    res.status(400).json({ error: message(error) });
  }
});

app.get("/api/rooms", (_req, res) => {
  res.json({ rooms: listRooms() });
});

app.post("/api/rooms", requireAuth, (req: AuthedRequest, res) => {
  const name = String(req.body.name || "規則公司房間").slice(0, 40);
  const state = createRoom(name, req.user!);
  res.json({ state });
});

app.get("/api/shop/items", (_req, res) => {
  res.json({
    items: shopItems.filter((item) => item.available),
    skins: characterSkins.filter((skin) => skin.available)
  });
});

app.post("/api/shop/buy", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const itemId = String(req.body.itemId || "");
    const item = [...shopItems, ...characterSkins].find((entry) => entry.id === itemId && entry.available);
    if (!item) throw new Error("商品不存在或未上架");
    if (prisma) {
      const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
      if (!user) throw new Error("找不到使用者");
      if (user.coins < item.price) throw new Error("金幣不足");
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { coins: { decrement: item.price } },
        select: { id: true, email: true, name: true, coins: true, isAdmin: true }
      });
      await prisma.inventoryItem.create({ data: { userId: user.id, itemId: item.id, quantity: 1 } });
      await prisma.purchaseLog.create({ data: { userId: user.id, itemId: item.id, coins: item.price } });
      res.json({ user: updated, item });
      return;
    }
    res.json({ user: await fallbackSpendCoins(req.user!.id, item.price), item });
  } catch (error) {
    res.status(400).json({ error: message(error) });
  }
});

app.get("/api/shop/inventory", requireAuth, async (req: AuthedRequest, res) => {
  if (!prisma) {
    res.json({ inventory: [] });
    return;
  }
  const inventory = await prisma.inventoryItem.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: "desc" } });
  res.json({ inventory });
});
app.get("/api/leaderboard/coins", async (_req, res) => {
  const users = prisma
    ? await prisma.user.findMany({ orderBy: { coins: "desc" }, take: 20, select: { id: true, name: true, coins: true } })
    : [];
  res.json({ users });
});
app.get("/api/matches/history/me", requireAuth, (_req, res) => res.json({ history: [] }));

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) throw new Error("Missing token");
    const payload = JSON.parse(Buffer.from(String(token).split(".")[1], "base64url").toString("utf8"));
    socket.data.user = payload;
    next();
  } catch {
    next(new Error("Authentication failed"));
  }
});

io.on("connection", (socket) => {
  const user = socket.data.user as { id: string; name: string; email: string; coins: number };

  socket.on("join_room", ({ roomId }, reply) => {
    try {
      const room = joinRoom(roomId, user, socket.id);
      socket.join(roomId);
      emitRoom(roomId);
      reply?.({ ok: true, state: room.state, privateState: getPrivate(roomId, user.id) });
    } catch (error) {
      reply?.({ ok: false, error: message(error) });
    }
  });

  socket.on("player_ready", ({ roomId }, reply) => safeReply(reply, () => emitAndReturn(roomId, toggleReady(roomId, user.id))));
  socket.on("start_match", ({ roomId, devMode }, reply) => safeReply(reply, () => emitAndReturn(roomId, startMatch(roomId, Boolean(devMode)))));
  socket.on("player_move", ({ roomId, dx, dy }, reply) => safeReply(reply, () => emitAndReturn(roomId, movePlayer(roomId, user.id, Number(dx), Number(dy)))));
  socket.on("start_task", ({ roomId, taskId }, reply) => safeReply(reply, () => emitAndReturn(roomId, startTask(roomId, user.id, taskId))));
  socket.on("boss_use_sabotage", ({ roomId, sabotageId, targetId, area }, reply) =>
    safeReply(reply, () => emitAndReturn(roomId, useSabotage(roomId, user.id, sabotageId, targetId, area)))
  );
  socket.on("guess_rule", ({ roomId, targetId, guessedRuleId }, reply) =>
    safeReply(reply, () => {
      const { state, result } = guessRule(roomId, user.id, targetId, guessedRuleId);
      emitRoom(roomId);
      return { state, result };
    })
  );
  socket.on("game_chat_message", ({ roomId, message, channel }, reply) =>
    safeReply(reply, () => emitAndReturn(roomId, addChat(roomId, user.id, user.name, String(message || ""), channel || "game")))
  );
  socket.on("get_private_state", ({ roomId }, reply) => reply?.({ ok: true, privateState: getPrivate(roomId, user.id) }));
});

setInterval(() => {
  tickRooms();
  rechargeBossEnergy();
  for (const room of listRooms()) emitRoom(room.id);
}, 1000);

function emitRoom(roomId: string) {
  const room = getRoom(roomId);
  if (!room) return;
  io.to(roomId).emit("game_state", room.state);
  for (const player of room.state.players) {
    const socketId = room.socketsByPlayer.get(player.id);
    if (socketId) io.to(socketId).emit("private_state", getPrivate(roomId, player.id));
  }
}

function emitAndReturn(roomId: string, state: unknown) {
  emitRoom(roomId);
  return { state };
}

function safeReply(reply: ((payload: unknown) => void) | undefined, fn: () => unknown) {
  try {
    reply?.({ ok: true, ...asObject(fn()) });
  } catch (error) {
    reply?.({ ok: false, error: message(error) });
  }
}

function asObject(value: unknown) {
  return typeof value === "object" && value !== null ? value : { value };
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

if (process.env.NODE_ENV === "production") {
  const clientDistPath = path.resolve(process.cwd(), "../client/dist");
  app.use(express.static(clientDistPath));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(clientDistPath, "index.html"));
  });
}

const port = Number(process.env.PORT || process.env.SERVER_PORT || 3001);
server.listen(port, () => {
  console.log(`規則公司 server listening on http://localhost:${port}`);
});
