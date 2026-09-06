import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { after, before, beforeEach } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
const ruleTest = emulatorHost ? test : test.skip;
let environment;

function program(ownerUid, id = `program-${ownerUid}`) {
  return { id, ownerUid, memberUids: [ownerUid], members: { [ownerUid]: "owner" }, name: "Visual Arts", subjectType: "art", schemaVersion: 1, plannerSchemaVersion: 9, revision: 1, lastMutationId: `create-${ownerUid}`, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), data: { schemaVersion: 9 } };
}

before(async () => {
  if (!emulatorHost) return;
  const [host, port] = emulatorHost.split(":");
  environment = await initializeTestEnvironment({ projectId: "specialist-planner-staging", firestore: { host, port: Number(port), rules: await readFile(new URL("../firestore.rules", import.meta.url), "utf8") } });
});

beforeEach(async () => { if (environment) await environment.clearFirestore(); });
after(async () => { if (environment) await environment.cleanup(); });

ruleTest("signed-out visitors cannot read or write private data", async () => {
  const db = environment.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, "programs", "program-a")));
  await assertFails(setDoc(doc(db, "programs", "program-a"), program("teacher-a", "program-a")));
  await assertFails(getDoc(doc(db, "users", "teacher-a")));
});

ruleTest("a teacher can create and update only their own Program", async () => {
  const owner = environment.authenticatedContext("teacher-a").firestore();
  const other = environment.authenticatedContext("teacher-b").firestore();
  const reference = doc(owner, "programs", "program-a");
  await assertSucceeds(setDoc(reference, program("teacher-a", "program-a")));
  await assertSucceeds(getDoc(reference));
  await assertFails(getDoc(doc(other, "programs", "program-a")));
  await assertFails(updateDoc(doc(other, "programs", "program-a"), { name: "Taken over" }));
  await assertSucceeds(updateDoc(reference, { name: "Visual Arts 2027", revision: 2, lastMutationId: "save-a", updatedAt: serverTimestamp(), data: { schemaVersion: 9, marker: "owner update" } }));
});

ruleTest("revision skipping, ownership changes and injected membership are denied", async () => {
  const owner = environment.authenticatedContext("teacher-a").firestore();
  const reference = doc(owner, "programs", "program-a");
  await assertSucceeds(setDoc(reference, program("teacher-a", "program-a")));
  await assertFails(updateDoc(reference, { revision: 3, lastMutationId: "skip", updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(reference, { ownerUid: "teacher-b", revision: 2, lastMutationId: "owner", updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(reference, { memberUids: ["teacher-a", "teacher-b"], members: { "teacher-a": "owner", "teacher-b": "owner" }, revision: 2, lastMutationId: "member", updatedAt: serverTimestamp() }));
});

ruleTest("member-filtered queries return only the signed-in teacher's Program", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "programs", "program-a"), program("teacher-a", "program-a"));
    await setDoc(doc(db, "programs", "program-b"), program("teacher-b", "program-b"));
  });
  const owner = environment.authenticatedContext("teacher-a").firestore();
  const allowed = await assertSucceeds(getDocs(query(collection(owner, "programs"), where("memberUids", "array-contains", "teacher-a"))));
  assert.deepEqual(allowed.docs.map((item) => item.id), ["program-a"]);
  await assertFails(getDocs(collection(owner, "programs")));
  await assertFails(getDocs(query(collection(owner, "programs"), where("memberUids", "array-contains", "teacher-b"))));
});

ruleTest("each user profile is private and cannot impersonate another UID", async () => {
  const owner = environment.authenticatedContext("teacher-a").firestore();
  const other = environment.authenticatedContext("teacher-b").firestore();
  const profile = doc(owner, "users", "teacher-a");
  await assertSucceeds(setDoc(profile, { uid: "teacher-a", displayName: "Teacher A", email: "a@example.test", authProviders: ["google.com"], createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  await assertSucceeds(getDoc(profile));
  await assertFails(getDoc(doc(other, "users", "teacher-a")));
  await assertFails(setDoc(doc(owner, "users", "teacher-b"), { uid: "teacher-b", authProviders: [], createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
});

ruleTest("pre-restore snapshots are owner-readable, immutable and owner-created", async () => {
  const owner = environment.authenticatedContext("teacher-a").firestore();
  const other = environment.authenticatedContext("teacher-b").firestore();
  await assertSucceeds(setDoc(doc(owner, "programs", "program-a"), program("teacher-a", "program-a")));
  const snapshot = doc(owner, "programs", "program-a", "snapshots", "snapshot-a");
  await assertSucceeds(setDoc(snapshot, { programId: "program-a", revision: 1, createdBy: "teacher-a", createdAt: serverTimestamp(), reason: "backup-restore", data: { schemaVersion: 9 } }));
  await assertSucceeds(getDoc(snapshot));
  await assertFails(getDoc(doc(other, "programs", "program-a", "snapshots", "snapshot-a")));
  await assertFails(updateDoc(snapshot, { reason: "changed" }));
});
