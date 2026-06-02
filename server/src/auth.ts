import bcrypt from "bcrypt";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import type { AuthUser } from "@rule-company/shared";

export interface AuthedRequest extends Request {
  user?: AuthUser;
}

const fallbackUsers = new Map<string, AuthUser & { passwordHash: string }>();
const fallbackResetTokens = new Map<string, { email: string; expiresAt: number; used: boolean }>();

export function isConfiguredAdmin(email: string) {
  const admins = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.toLowerCase());
}

export function signUser(user: AuthUser) {
  return jwt.sign(user, process.env.JWT_SECRET || "dev-rule-company-secret", { expiresIn: "7d" });
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) {
    res.status(401).json({ error: "Missing token" });
    return;
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || "dev-rule-company-secret") as AuthUser;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

export async function fallbackRegister(email: string, name: string, password: string) {
  const normalized = email.toLowerCase();
  if (fallbackUsers.has(normalized)) throw new Error("Email already registered");
  const user = {
    id: `user-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    email: normalized,
    name,
    coins: 300,
    isAdmin: fallbackUsers.size === 0 || isConfiguredAdmin(normalized),
    passwordHash: await bcrypt.hash(password, 10)
  };
  fallbackUsers.set(normalized, user);
  return stripPassword(user);
}

export async function fallbackSpendCoins(userId: string, cost: number) {
  const user = [...fallbackUsers.values()].find((entry) => entry.id === userId);
  if (!user) throw new Error("找不到使用者");
  if (user.coins < cost) throw new Error("金幣不足");
  user.coins -= cost;
  return stripPassword(user);
}

export async function fallbackLogin(email: string, password: string) {
  const user = fallbackUsers.get(email.toLowerCase());
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw new Error("Invalid credentials");
  return stripPassword(user);
}

export function createResetToken() {
  return crypto.randomBytes(24).toString("base64url");
}

export async function fallbackCreatePasswordReset(email: string) {
  const normalized = email.toLowerCase();
  if (!fallbackUsers.has(normalized)) return null;
  const token = createResetToken();
  fallbackResetTokens.set(token, {
    email: normalized,
    expiresAt: Date.now() + 30 * 60 * 1000,
    used: false
  });
  return token;
}

export async function fallbackResetPassword(email: string, token: string, password: string) {
  const normalized = email.toLowerCase();
  const reset = fallbackResetTokens.get(token);
  const user = fallbackUsers.get(normalized);
  if (!reset || !user || reset.email !== normalized || reset.used || reset.expiresAt < Date.now()) {
    throw new Error("Invalid or expired reset code");
  }
  user.passwordHash = await bcrypt.hash(password, 10);
  reset.used = true;
  return stripPassword(user);
}

function stripPassword(user: AuthUser & { passwordHash: string }): AuthUser {
  return { id: user.id, email: user.email, name: user.name, coins: user.coins, isAdmin: user.isAdmin };
}
