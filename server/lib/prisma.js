// Ein einziger PrismaClient für den gesamten Server-Prozess (nicht pro Modul
// neu instanzieren - sonst erschöpft jeder Reload/Import den Postgres
// Connection-Pool).
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
