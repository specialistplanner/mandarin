import type { User } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
  type Firestore,
} from "firebase/firestore";
import { clonePlanner, type PlannerData } from "../lib/domain.ts";
import { activeProgramName, makeCloudProgram, programBelongsTo, validateCloudProgram, type CloudProgram, type ProgramSubjectType } from "../lib/cloud-program.ts";

export class ProgramConflictError extends Error {
  constructor(public latest: CloudProgram) {
    super("This Program was updated on another device.");
    this.name = "ProgramConflictError";
  }
}

export class ProgramAccessError extends Error {
  constructor(message = "You do not have access to this Program.") {
    super(message);
    this.name = "ProgramAccessError";
  }
}

export function mutationId(prefix = "mutation"): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export async function saveUserProfile(db: Firestore, user: User) {
  const reference = doc(db, "users", user.uid);
  const existing = await getDoc(reference);
  await setDoc(reference, {
    uid: user.uid,
    displayName: user.displayName ?? null,
    email: user.email ?? null,
    authProviders: [...new Set(user.providerData.map((provider) => provider.providerId))],
    ...(!existing.exists() ? { createdAt: serverTimestamp() } : {}),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function listProgramsForUser(db: Firestore, uid: string): Promise<CloudProgram[]> {
  const snapshot = await getDocs(query(collection(db, "programs"), where("memberUids", "array-contains", uid)));
  return snapshot.docs
    .map((item) => validateCloudProgram(item.data()))
    .filter((program) => programBelongsTo(program, uid))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadProgram(db: Firestore, uid: string, programId: string): Promise<CloudProgram> {
  const snapshot = await getDoc(doc(db, "programs", programId));
  if (!snapshot.exists()) throw new Error("Program not found.");
  const program = validateCloudProgram(snapshot.data());
  if (!programBelongsTo(program, uid)) throw new ProgramAccessError();
  return program;
}

export async function createProgram(db: Firestore, input: {
  programId: string;
  uid: string;
  name: string;
  subjectType: ProgramSubjectType;
  customSubjectName?: string;
  planner: PlannerData;
  mutationId: string;
}): Promise<CloudProgram> {
  const reference = doc(db, "programs", input.programId);
  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(reference);
    if (existing.exists()) {
      const program = validateCloudProgram(existing.data());
      if (!programBelongsTo(program, input.uid)) throw new ProgramAccessError();
      if (program.lastMutationId !== input.mutationId) throw new ProgramConflictError(program);
      return;
    }
    transaction.set(reference, {
      ...makeCloudProgram({
        id: input.programId,
        ownerUid: input.uid,
        name: input.name,
        subjectType: input.subjectType,
        customSubjectName: input.customSubjectName,
        planner: clonePlanner(input.planner),
        mutationId: input.mutationId,
      }),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
  return loadProgram(db, input.uid, input.programId);
}

export async function saveProgram(db: Firestore, input: {
  uid: string;
  programId: string;
  expectedRevision: number;
  planner: PlannerData;
  mutationId: string;
}): Promise<CloudProgram> {
  const reference = doc(db, "programs", input.programId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists()) throw new Error("Program not found.");
    const current = validateCloudProgram(snapshot.data());
    if (!programBelongsTo(current, input.uid)) throw new ProgramAccessError();
    if (current.lastMutationId === input.mutationId) return;
    if (current.revision !== input.expectedRevision) throw new ProgramConflictError(current);
    transaction.update(reference, {
      data: clonePlanner(input.planner),
      name: activeProgramName(input.planner),
      revision: current.revision + 1,
      lastMutationId: input.mutationId,
      updatedAt: serverTimestamp(),
    });
  });
  return loadProgram(db, input.uid, input.programId);
}

export async function restoreProgram(db: Firestore, input: {
  uid: string;
  programId: string;
  expectedRevision: number;
  restoredPlanner: PlannerData;
  mutationId: string;
}): Promise<CloudProgram> {
  const reference = doc(db, "programs", input.programId);
  const snapshotReference = doc(collection(reference, "snapshots"));
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists()) throw new Error("Program not found.");
    const current = validateCloudProgram(snapshot.data());
    if (!programBelongsTo(current, input.uid)) throw new ProgramAccessError();
    if (current.lastMutationId === input.mutationId) return;
    if (current.revision !== input.expectedRevision) throw new ProgramConflictError(current);
    transaction.set(snapshotReference, {
      programId: current.id,
      revision: current.revision,
      createdBy: input.uid,
      createdAt: serverTimestamp(),
      reason: "backup-restore",
      data: clonePlanner(current.data),
    });
    transaction.update(reference, {
      data: clonePlanner(input.restoredPlanner),
      name: activeProgramName(input.restoredPlanner),
      revision: current.revision + 1,
      lastMutationId: input.mutationId,
      updatedAt: serverTimestamp(),
    });
  });
  return loadProgram(db, input.uid, input.programId);
}
