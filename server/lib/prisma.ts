import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/index.js";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing");
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});


const prisma = new PrismaClient({
  adapter: adapter as any,
});

export default prisma;
