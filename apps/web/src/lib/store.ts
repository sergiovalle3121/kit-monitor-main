import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

export type UserStatus = "active" | "pending" | "rejected";
export type UserRole =
  | "admin"
  | "engineering"
  | "production"
  | "quality"
  | "inventory"
  | "finance";

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
  approvedAt?: string;
  rejectedAt?: string;
}

export interface AdminNotification {
  id: string;
  type: "user.pending" | "user.approved" | "user.rejected";
  title: string;
  body: string;
  userId: string;
  read: boolean;
  createdAt: string;
}

interface StoreShape {
  users: StoredUser[];
  notifications: AdminNotification[];
}

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "store.json");

async function ensureFile(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    const seed = await defaultStore();
    await fs.writeFile(DATA_FILE, JSON.stringify(seed, null, 2), "utf8");
  }
}

function hashPassword(password: string, salt?: string) {
  const useSalt = salt ?? crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .scryptSync(password, useSalt, 64)
    .toString("hex");
  return { hash, salt: useSalt };
}

export function verifyPassword(user: StoredUser, password: string): boolean {
  const { hash } = hashPassword(password, user.passwordSalt);
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(user.passwordHash, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

async function defaultStore(): Promise<StoreShape> {
  const adminPass = hashPassword("admin123");
  const now = new Date().toISOString();
  return {
    users: [
      {
        id: crypto.randomUUID(),
        name: "Sergio Valle",
        email: "admin@axos.com",
        role: "admin",
        status: "active",
        passwordHash: adminPass.hash,
        passwordSalt: adminPass.salt,
        createdAt: now,
        approvedAt: now,
      },
    ],
    notifications: [],
  };
}

async function readStore(): Promise<StoreShape> {
  await ensureFile();
  const raw = await fs.readFile(DATA_FILE, "utf8");
  return JSON.parse(raw) as StoreShape;
}

async function writeStore(store: StoreShape): Promise<void> {
  await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2), "utf8");
}

export async function findUserByEmail(
  email: string,
): Promise<StoredUser | undefined> {
  const store = await readStore();
  return store.users.find(
    (u) => u.email.toLowerCase() === email.toLowerCase(),
  );
}

export async function findUserById(id: string): Promise<StoredUser | undefined> {
  const store = await readStore();
  return store.users.find((u) => u.id === id);
}

export async function createUser(input: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}): Promise<StoredUser> {
  const store = await readStore();
  const exists = store.users.some(
    (u) => u.email.toLowerCase() === input.email.toLowerCase(),
  );
  if (exists) {
    throw new Error("EMAIL_TAKEN");
  }
  const { hash, salt } = hashPassword(input.password);
  const user: StoredUser = {
    id: crypto.randomUUID(),
    name: input.name,
    email: input.email,
    role: input.role,
    status: "pending",
    passwordHash: hash,
    passwordSalt: salt,
    createdAt: new Date().toISOString(),
  };
  store.users.push(user);
  store.notifications.unshift({
    id: crypto.randomUUID(),
    type: "user.pending",
    title: "Nueva solicitud de acceso",
    body: `${user.name} (${user.email}) solicita acceso como ${user.role}.`,
    userId: user.id,
    read: false,
    createdAt: user.createdAt,
  });
  await writeStore(store);
  return user;
}

export async function setUserStatus(
  id: string,
  status: Exclude<UserStatus, "pending">,
): Promise<StoredUser | undefined> {
  const store = await readStore();
  const user = store.users.find((u) => u.id === id);
  if (!user) return undefined;
  user.status = status;
  const now = new Date().toISOString();
  if (status === "active") user.approvedAt = now;
  if (status === "rejected") user.rejectedAt = now;
  store.notifications.unshift({
    id: crypto.randomUUID(),
    type: status === "active" ? "user.approved" : "user.rejected",
    title:
      status === "active" ? "Usuario aprobado" : "Solicitud rechazada",
    body: `${user.name} (${user.email}) fue ${
      status === "active" ? "aprobado" : "rechazado"
    }.`,
    userId: user.id,
    read: false,
    createdAt: now,
  });
  await writeStore(store);
  return user;
}

export async function listPendingUsers(): Promise<StoredUser[]> {
  const store = await readStore();
  return store.users
    .filter((u) => u.status === "pending")
    .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
}

export async function listAllUsers(): Promise<StoredUser[]> {
  const store = await readStore();
  return [...store.users].sort((a, b) =>
    a.createdAt > b.createdAt ? -1 : 1,
  );
}

export async function listNotifications(opts?: {
  unreadOnly?: boolean;
  limit?: number;
}): Promise<AdminNotification[]> {
  const store = await readStore();
  let items = store.notifications;
  if (opts?.unreadOnly) items = items.filter((n) => !n.read);
  if (opts?.limit) items = items.slice(0, opts.limit);
  return items;
}

export async function markAllNotificationsRead(): Promise<void> {
  const store = await readStore();
  store.notifications = store.notifications.map((n) => ({ ...n, read: true }));
  await writeStore(store);
}

export function publicUser(user: StoredUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
  };
}
