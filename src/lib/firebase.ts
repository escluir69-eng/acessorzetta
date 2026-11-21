/**
 * Adaptador de compatibilidade: emula a superfície do Firebase (Auth, Firestore,
 * Storage) usada pelo Órion sobre o Lovable Cloud (Supabase).
 *
 * - Firestore → tabela public.firestore_docs (path text PK, user_id, data jsonb)
 * - Storage   → bucket privado "attachments"
 * - Auth      → Lovable Cloud Auth (Google gerenciado)
 */
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import type { User as SupabaseUser } from "@supabase/supabase-js";

const TABLE = "firestore_docs";
const BUCKET = "attachments";

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
}

function mapUser(u: SupabaseUser | null): User | null {
  if (!u) return null;
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
  return {
    uid: u.id,
    email: u.email ?? null,
    displayName:
      (typeof meta["full_name"] === "string" && meta["full_name"]) ||
      (typeof meta["name"] === "string" && meta["name"]) ||
      null,
    photoURL: typeof meta["avatar_url"] === "string" ? meta["avatar_url"] : null,
    emailVerified: Boolean(u.email_confirmed_at) || Boolean(u.confirmed_at) || true,
  };
}

let currentUser: User | null = null;

export const auth = {
  get currentUser(): User | null {
    return currentUser;
  },
};

export const googleProvider = { providerId: "google" };

export function onAuthStateChanged(
  _auth: typeof auth,
  callback: (user: User | null) => void,
): () => void {
  let active = true;
  void supabase.auth.getSession().then(({ data }) => {
    if (!active) return;
    currentUser = mapUser(data.session?.user ?? null);
    callback(currentUser);
  });
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    if (!active) return;
    currentUser = mapUser(session?.user ?? null);
    callback(currentUser);
  });
  return () => {
    active = false;
    subscription.unsubscribe();
  };
}

export async function signInWithPopup(
  _auth: typeof auth,
  _provider: typeof googleProvider,
): Promise<void> {
  const result = await lovable.auth.signInWithOAuth("google", {
    redirect_uri: window.location.origin,
    extraParams: { prompt: "select_account" },
  });
  if (result.error) {
    throw result.error instanceof Error ? result.error : new Error(String(result.error));
  }
  // redirected === true: o navegador está indo para o provedor; a sessão
  // retorna via onAuthStateChange.
}

export async function signOut(_auth: typeof auth): Promise<void> {
  await supabase.auth.signOut();
  currentUser = null;
}

// ---------------------------------------------------------------------------
// Firestore emulation
// ---------------------------------------------------------------------------

export interface DocRef {
  kind: "doc";
  path: string;
  id: string;
}

export interface CollectionRef {
  kind: "collection";
  path: string;
}

export interface QueryRef {
  kind: "query";
  path: string;
  filters: Array<{ field: string; op: string; value: unknown }>;
}

export type DocumentData = Record<string, unknown>;

function joinPath(segments: string[]): string {
  return segments.map((s) => s.replace(/^\/+|\/+$/g, "")).join("/");
}

export function doc(_db: unknown, ...segments: string[]): DocRef {
  const path = joinPath(segments);
  return { kind: "doc", path, id: segments[segments.length - 1] ?? "" };
}

export function collection(_db: unknown, ...segments: string[]): CollectionRef {
  return { kind: "collection", path: joinPath(segments) };
}

export function where(field: string, op: string, value: unknown) {
  return { field, op, value };
}

export function query(
  col: CollectionRef,
  ...filters: Array<{ field: string; op: string; value: unknown }>
): QueryRef {
  return { kind: "query", path: col.path, filters };
}

const DELETE_FIELD = Symbol("orion-delete-field");
const SERVER_TS = Symbol("orion-server-timestamp");

export function deleteField(): unknown {
  return DELETE_FIELD;
}

export function serverTimestamp(): unknown {
  return SERVER_TS;
}

function resolveSentinels(value: unknown): unknown {
  if (value === SERVER_TS) return new Date().toISOString();
  if (Array.isArray(value)) return value.map(resolveSentinels);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === DELETE_FIELD) continue;
      out[k] = resolveSentinels(v);
    }
    return out;
  }
  return value;
}

function setDeep(target: Record<string, unknown>, dotPath: string, value: unknown) {
  const parts = dotPath.split(".");
  let node = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]!;
    const next = node[key];
    if (!next || typeof next !== "object" || Array.isArray(next)) {
      node[key] = {};
    }
    node = node[key] as Record<string, unknown>;
  }
  const last = parts[parts.length - 1]!;
  if (value === DELETE_FIELD) {
    delete node[last];
  } else {
    node[last] = resolveSentinels(value);
  }
}

function applyUpdate(existing: DocumentData, update: DocumentData): DocumentData {
  const result: DocumentData = JSON.parse(JSON.stringify(existing)) as DocumentData;
  for (const [key, value] of Object.entries(update)) {
    if (key.includes(".")) {
      setDeep(result, key, value);
    } else if (value === DELETE_FIELD) {
      delete result[key];
    } else {
      result[key] = resolveSentinels(value);
    }
  }
  return result;
}

function matchesFilters(data: DocumentData, filters: QueryRef["filters"]): boolean {
  return filters.every((f) => {
    const value = f.field.split(".").reduce<unknown>((acc, part) => {
      if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[part];
      return undefined;
    }, data);
    switch (f.op) {
      case "==":
        return value === f.value;
      case "!=":
        return value !== f.value;
      case ">":
        return typeof value === "number" && typeof f.value === "number" && value > f.value;
      case "<":
        return typeof value === "number" && typeof f.value === "number" && value < f.value;
      case ">=":
        return typeof value === "number" && typeof f.value === "number" && value >= f.value;
      case "<=":
        return typeof value === "number" && typeof f.value === "number" && value <= f.value;
      case "array-contains":
        return Array.isArray(value) && value.includes(f.value);
      case "in":
        return Array.isArray(f.value) && f.value.includes(value);
      default:
        return true;
    }
  });
}

function ownerUid(): string {
  const uid = currentUser?.uid;
  if (!uid) throw new Error("Usuário não autenticado.");
  return uid;
}

export interface DocSnapshot {
  id: string;
  ref: DocRef;
  exists: () => boolean;
  data: () => DocumentData;
}

export interface QuerySnapshot {
  docs: DocSnapshot[];
  empty: boolean;
  size: number;
  forEach: (cb: (d: DocSnapshot) => void) => void;
}

function makeDocSnapshot(id: string, data: DocumentData | undefined, path?: string): DocSnapshot {
  return {
    id,
    ref: { kind: "doc", path: path ?? id, id },
    exists: () => data !== undefined,
    // Mantém a semântica do Firestore: undefined quando o documento não existe.
    data: () => data as DocumentData,
  };
}

function makeQuerySnapshot(rows: Array<{ path: string; data: DocumentData }>): QuerySnapshot {
  const docs = rows.map((row) =>
    makeDocSnapshot(row.path.split("/").pop() ?? "", row.data, row.path),
  );
  return {
    docs,
    empty: docs.length === 0,
    size: docs.length,
    forEach: (cb) => docs.forEach(cb),
  };
}

async function fetchDoc(path: string): Promise<DocumentData | undefined> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("data")
    .eq("path", path)
    .eq("user_id", ownerUid())
    .maybeSingle();
  if (error) throw error;
  return (data?.data as DocumentData | undefined) ?? undefined;
}

async function fetchQuery(q: QueryRef): Promise<QuerySnapshot> {
  const prefix = `${q.path}/`;
  const { data, error } = await supabase
    .from(TABLE)
    .select("path, data")
    .eq("user_id", ownerUid())
    .like("path", `${prefix}%`);
  if (error) throw error;
  const rows = (data ?? [])
    .filter((row) => {
      const rest = row.path.slice(prefix.length);
      return rest.length > 0 && !rest.includes("/");
    })
    .map((row) => ({ path: row.path as string, data: row.data as DocumentData }))
    .filter((row) => matchesFilters(row.data, q.filters));
  return makeQuerySnapshot(rows);
}

export async function getDoc(ref: DocRef): Promise<DocSnapshot> {
  const data = await fetchDoc(ref.path);
  return makeDocSnapshot(ref.id, data, ref.path);
}

export const getDocFromServer = getDoc;

export async function getDocs(q: QueryRef | CollectionRef): Promise<QuerySnapshot> {
  const queryRef: QueryRef =
    q.kind === "query" ? q : { kind: "query", path: q.path, filters: [] };
  return fetchQuery(queryRef);
}

async function upsertDoc(path: string, data: DocumentData): Promise<void> {
  const { error } = await supabase.from(TABLE).upsert(
    {
      path,
      user_id: ownerUid(),
      data: data as unknown as import("@/integrations/supabase/types").Json,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "path" },
  );
  if (error) throw error;
}

export async function setDoc(
  ref: DocRef,
  data: DocumentData,
  options?: { merge?: boolean },
): Promise<void> {
  const clean = resolveSentinels(data) as DocumentData;
  if (options?.merge) {
    const existing = (await fetchDoc(ref.path)) ?? {};
    await upsertDoc(ref.path, applyUpdate(existing, clean));
  } else {
    await upsertDoc(ref.path, clean);
  }
}

export async function updateDoc(ref: DocRef, update: DocumentData): Promise<void> {
  const existing = (await fetchDoc(ref.path)) ?? {};
  await upsertDoc(ref.path, applyUpdate(existing, update));
}

export async function deleteDoc(ref: DocRef): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq("path", ref.path)
    .eq("user_id", ownerUid());
  if (error) throw error;
}

// --- realtime ---------------------------------------------------------------

type SnapshotCallback = (snap: DocSnapshot | QuerySnapshot) => void;

interface Listener {
  target: DocRef | QueryRef | CollectionRef;
  onNext: SnapshotCallback;
  onError?: (error: Error) => void;
}

const listeners = new Set<Listener>();
let realtimeUserId: string | null = null;
let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;

async function emitListener(listener: Listener): Promise<void> {
  try {
    if (listener.target.kind === "doc") {
      const data = await fetchDoc(listener.target.path);
      listener.onNext(makeDocSnapshot(listener.target.id, data, listener.target.path));
    } else {
      const q: QueryRef =
        listener.target.kind === "query"
          ? listener.target
          : { kind: "query", path: listener.target.path, filters: [] };
      listener.onNext(await fetchQuery(q));
    }
  } catch (error) {
    listener.onError?.(error instanceof Error ? error : new Error(String(error)));
  }
}

function listenerPrefix(listener: Listener): string {
  return listener.target.kind === "doc" ? listener.target.path : `${listener.target.path}/`;
}

function ensureRealtime(uid: string): void {
  if (realtimeChannel && realtimeUserId === uid) return;
  if (realtimeChannel) {
    void supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
  realtimeUserId = uid;
  realtimeChannel = supabase
    .channel(`orion-docs-${uid}-${Math.random().toString(36).slice(2)}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: TABLE, filter: `user_id=eq.${uid}` },
      (payload) => {
        const changedPath =
          (payload.new as { path?: string } | null)?.path ??
          (payload.old as { path?: string } | null)?.path ??
          "";
        for (const listener of listeners) {
          const prefix = listenerPrefix(listener);
          const matches =
            listener.target.kind === "doc"
              ? changedPath === prefix
              : changedPath.startsWith(prefix);
          if (matches) void emitListener(listener);
        }
      },
    )
    .subscribe();
}

export function onSnapshot(
  target: DocRef,
  onNext: (snap: DocSnapshot) => void,
  onError?: (error: Error) => void,
): () => void;
export function onSnapshot(
  target: QueryRef | CollectionRef,
  onNext: (snap: QuerySnapshot) => void,
  onError?: (error: Error) => void,
): () => void;
export function onSnapshot(
  target: DocRef | QueryRef | CollectionRef,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onNext: (snap: any) => void,
  onError?: (error: Error) => void,
): () => void {
  const listener: Listener = { target, onNext: onNext as SnapshotCallback, onError };
  listeners.add(listener);
  void emitListener(listener);
  const uid = currentUser?.uid;
  if (uid) ensureRealtime(uid);
  return () => {
    listeners.delete(listener);
  };
}

// --- batch / transaction ------------------------------------------------------

type BatchOp =
  | { type: "set"; ref: DocRef; data: DocumentData; options?: { merge?: boolean } }
  | { type: "update"; ref: DocRef; data: DocumentData }
  | { type: "delete"; ref: DocRef };

export function writeBatch(_db: unknown) {
  const ops: BatchOp[] = [];
  return {
    set(ref: DocRef, data: DocumentData, options?: { merge?: boolean }) {
      ops.push({ type: "set", ref, data, ...(options ? { options } : {}) });
    },
    update(ref: DocRef, data: DocumentData) {
      ops.push({ type: "update", ref, data });
    },
    delete(ref: DocRef) {
      ops.push({ type: "delete", ref });
    },
    async commit() {
      for (const op of ops) {
        if (op.type === "set") await setDoc(op.ref, op.data, op.options);
        else if (op.type === "update") await updateDoc(op.ref, op.data);
        else await deleteDoc(op.ref);
      }
    },
  };
}

export async function runTransaction<T>(
  _db: unknown,
  updateFunction: (tx: {
    get: (ref: DocRef) => Promise<DocSnapshot>;
    set: (ref: DocRef, data: DocumentData, options?: { merge?: boolean }) => void;
    update: (ref: DocRef, data: DocumentData) => void;
    delete: (ref: DocRef) => void;
  }) => Promise<T>,
): Promise<T> {
  const writes: BatchOp[] = [];
  const tx = {
    get: (ref: DocRef) => getDoc(ref),
    set(ref: DocRef, data: DocumentData, options?: { merge?: boolean }) {
      writes.push({ type: "set", ref, data, ...(options ? { options } : {}) });
    },
    update(ref: DocRef, data: DocumentData) {
      writes.push({ type: "update", ref, data });
    },
    delete(ref: DocRef) {
      writes.push({ type: "delete", ref });
    },
  };
  const result = await updateFunction(tx);
  for (const op of writes) {
    if (op.type === "set") await setDoc(op.ref, op.data, op.options);
    else if (op.type === "update") await updateDoc(op.ref, op.data);
    else await deleteDoc(op.ref);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Storage emulation
// ---------------------------------------------------------------------------

export const storage = { bucket: BUCKET };

export interface StorageRef {
  path: string;
}

export function ref(_storage: typeof storage, path: string): StorageRef {
  return { path };
}

export async function uploadBytes(
  storageRef: StorageRef,
  file: Blob | File,
  metadata?: { contentType?: string },
): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).upload(storageRef.path, file, {
    contentType: metadata?.contentType,
    upsert: true,
  });
  if (error) throw error;
}

export async function getDownloadURL(storageRef: StorageRef): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storageRef.path, 60 * 60 * 24 * 365);
  if (error) throw error;
  return data.signedUrl;
}

export async function getBlob(storageRef: StorageRef): Promise<Blob> {
  const { data, error } = await supabase.storage.from(BUCKET).download(storageRef.path);
  if (error) throw error;
  return data;
}

export async function deleteObject(storageRef: StorageRef): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([storageRef.path]);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Error helper (compatibilidade com o código original)
// ---------------------------------------------------------------------------

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const db = { engine: "lovable-cloud" };
