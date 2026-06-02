import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import type { AuthedRequest } from "./auth.js";
import { characterSkins, employeeRoles, rules, sabotages, shopItems, spiritualEvents, tasks } from "./content.js";
import { prisma } from "./db.js";

type CollectionName = "rules" | "tasks" | "employeeRoles" | "sabotages" | "spiritualEvents" | "shopItems" | "characterSkins";

const collections = {
  rules,
  tasks,
  employeeRoles,
  sabotages,
  spiritualEvents,
  shopItems,
  characterSkins
};

const collectionSchema = z.enum(["rules", "tasks", "employeeRoles", "sabotages", "spiritualEvents", "shopItems", "characterSkins"]);
const itemSchema = z.record(z.unknown()).and(z.object({ id: z.string().min(2) }));

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV !== "production") {
    next();
    return;
  }
  if (!req.user?.isAdmin) {
    res.status(403).json({ error: "需要管理員權限" });
    return;
  }
  next();
}

export function getAdminContent() {
  return collections;
}

export async function upsertAdminItem(collectionName: string, rawItem: unknown) {
  const name = collectionSchema.parse(collectionName);
  const item = itemSchema.parse(rawItem);
  const collection = collections[name] as Array<Record<string, unknown>>;
  const index = collection.findIndex((entry) => entry.id === item.id);
  if (index >= 0) collection[index] = { ...collection[index], ...item };
  else collection.push(item);
  await persistItem(name, item);
  return collection.find((entry) => entry.id === item.id);
}

export async function removeAdminItem(collectionName: string, id: string) {
  const name = collectionSchema.parse(collectionName);
  const collection = collections[name] as Array<Record<string, unknown>>;
  const index = collection.findIndex((entry) => entry.id === id);
  if (index >= 0) collection.splice(index, 1);
  await deleteItem(name, id);
  return { id };
}

export async function setAvailability(collectionName: string, id: string, available: boolean) {
  return upsertAdminItem(collectionName, { id, available });
}

async function persistItem(name: CollectionName, item: Record<string, unknown>) {
  if (!prisma) return;
  if (name === "rules") await prisma.rule.upsert({ where: { id: String(item.id) }, update: item as any, create: item as any });
  if (name === "tasks") await prisma.task.upsert({ where: { id: String(item.id) }, update: item as any, create: item as any });
  if (name === "employeeRoles") await prisma.employeeRole.upsert({ where: { id: String(item.id) }, update: item as any, create: item as any });
  if (name === "sabotages") await prisma.sabotage.upsert({ where: { id: String(item.id) }, update: item as any, create: item as any });
  if (name === "spiritualEvents") await prisma.spiritualEvent.upsert({ where: { id: String(item.id) }, update: item as any, create: item as any });
  if (name === "shopItems") await prisma.shopItem.upsert({ where: { id: String(item.id) }, update: item as any, create: item as any });
  if (name === "characterSkins") await prisma.characterSkin.upsert({ where: { id: String(item.id) }, update: item as any, create: item as any });
}

async function deleteItem(name: CollectionName, id: string) {
  if (!prisma) return;
  if (name === "rules") await prisma.rule.deleteMany({ where: { id } });
  if (name === "tasks") await prisma.task.deleteMany({ where: { id } });
  if (name === "employeeRoles") await prisma.employeeRole.deleteMany({ where: { id } });
  if (name === "sabotages") await prisma.sabotage.deleteMany({ where: { id } });
  if (name === "spiritualEvents") await prisma.spiritualEvent.deleteMany({ where: { id } });
  if (name === "shopItems") await prisma.shopItem.deleteMany({ where: { id } });
  if (name === "characterSkins") await prisma.characterSkin.deleteMany({ where: { id } });
}
