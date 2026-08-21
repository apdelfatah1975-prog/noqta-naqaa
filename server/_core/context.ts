import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { getUserById } from "../db";
import { getLocalUserId } from "./localAuth";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;
  try {
    const userId = await getLocalUserId(opts.req);
    if (userId) user = (await getUserById(userId)) ?? null;
  } catch {
    user = null;
  }
  return { req: opts.req, res: opts.res, user };
}
