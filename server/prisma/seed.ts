import { PrismaClient } from "@prisma/client";
import { characterSkins, employeeRoles, rules, sabotages, shopItems, spiritualEvents, tasks } from "../src/content.js";

const prisma = new PrismaClient();

async function main() {
  for (const rule of rules) {
    await prisma.rule.upsert({ where: { id: rule.id }, update: rule, create: rule });
  }
  for (const task of tasks) {
    await prisma.task.upsert({ where: { id: task.id }, update: task, create: task });
  }
  for (const role of employeeRoles) {
    await prisma.employeeRole.upsert({ where: { id: role.id }, update: role, create: role });
  }
  for (const sabotage of sabotages) {
    await prisma.sabotage.upsert({
      where: { id: sabotage.id },
      update: sabotage,
      create: sabotage
    });
  }
  for (const event of spiritualEvents) {
    await prisma.spiritualEvent.upsert({ where: { id: event.id }, update: event, create: event });
  }
  for (const item of shopItems) {
    await prisma.shopItem.upsert({ where: { id: item.id }, update: item, create: item });
  }
  for (const skin of characterSkins) {
    await prisma.characterSkin.upsert({ where: { id: skin.id }, update: skin, create: skin });
  }
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
