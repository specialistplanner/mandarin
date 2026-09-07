"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { DashboardApp } from "./dashboard-app";
import { getFirebaseServices, signInWithProvider, type AuthProviderName } from "@/firebase/client";
import {
  ProgramConflictError,
  createProgram,
  listProgramsForUser,
  mutationId,
  restoreProgram,
  saveProgram,
  saveUserProfile,
} from "@/firebase/program-store";
import {
  SUBJECT_PRESETS,
  activeProgramName,
  defaultProgramName,
  makeCloudProgram,
  preparePlannerForProgram,
  summarizeLocalProgram,
  type CloudProgram,
  type ProgramSubjectType,
} from "@/lib/cloud-program";
import {
  finishMigrationIntent,
  migrationProgramId,
  readCloudCache,
  writeCloudCache,
  type CloudPendingOperation,
} from "@/lib/cloud-cache";
import { createUnitRecord, touchPlanner, type PlannerData } from "@/lib/domain";
import { markOneTimeMigrationsApplied } from "@/lib/migration-markers";
import { samplePlanner } from "@/lib/sample-data";
import { loadPlanner } from "@/lib/storage";
import { APP_VERSION } from "@/lib/release";

type AppPhase = "initializing" | "signed-out" | "loading-program" | "migration" | "onboarding" | "workspace" | "error";
type SyncTone = "synced" | "saving" | "offline" | "pending" | "conflict";

const LANGUAGE_NAMES = ["Mandarin", "Japanese", "Indonesian", "German", "French", "Auslan"];

function errorMessage(error: unknown): string {
  const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  if (code.includes("popup-closed")) return "Sign-in was cancelled. You can try again when ready.";
  if (code.includes("unauthorized-domain")) return "This website has not yet been authorised for sign-in.";
  if (code.includes("operation-not-allowed")) return "This sign-in provider is not enabled yet.";
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

function initialsFor(user: User): string {
  const source = user.displayName?.trim() || user.email?.split("@")[0] || "Teacher";
  return source.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "T";
}

function inferredSubject(name: string): ProgramSubjectType {
  return LANGUAGE_NAMES.some((language) => name.toLowerCase().includes(language.toLowerCase())) ? "languages" : "other";
}

function AuthScreen({ googleEnabled, microsoftEnabled, onSignIn, message }: {
  googleEnabled: boolean;
  microsoftEnabled: boolean;
  onSignIn: (provider: AuthProviderName) => Promise<void>;
  message: string;
}) {
  return <main className="cloud-entry">
    <section className="cloud-entry-card">
      <span className="brand-mark">SP</span>
      <p className="eyebrow">Specialist Planner {APP_VERSION}</p>
      <h1>Plan your week.<br />Know where every class is up to.</h1>
      <p className="cloud-entry-copy">A private workspace for specialist teachers, available wherever you sign in.</p>
      <div className="identity-actions">
        <button type="button" disabled={!googleEnabled} onClick={() => void onSignIn("google")}><span aria-hidden="true">G</span>Continue with Google</button>
        <button type="button" disabled={!microsoftEnabled} onClick={() => void onSignIn("microsoft")}><span aria-hidden="true" className="microsoft-mark">▦</span>Continue with Microsoft</button>
      </div>
      {!microsoftEnabled && <small className="provider-note">Microsoft sign-in will be enabled after the Microsoft app registration is connected.</small>}
      {message && <p className="cloud-message" role="alert">{message}</p>}
      <small>Your Program is private to your signed-in account. Sharing is not included in v0.6.</small>
    </section>
  </main>;
}

function MigrationChoice({ planner, ownerEmail, backupConfirmed, onBackupConfirmed, onMigrate, onCreateNew, busy, message }: {
  planner: PlannerData;
  ownerEmail: string;
  backupConfirmed: boolean;
  onBackupConfirmed: (confirmed: boolean) => void;
  onMigrate: () => Promise<void>;
  onCreateNew: () => void;
  busy: boolean;
  message: string;
}) {
  const summary = summarizeLocalProgram(planner);
  return <main className="cloud-entry">
    <section className="cloud-entry-card migration-choice">
      <p className="eyebrow">Existing Planner found</p>
      <h1>{summary.name}</h1>
      <div className="migration-summary">
        <span><strong>{summary.classes}</strong> classes</span>
        <span><strong>{summary.units}</strong> Units</span>
        <span><strong>{summary.recordedSessions}</strong> recorded sessions</span>
      </div>
      <p className="cloud-entry-copy">Move this local Program into your private cloud workspace. The local copy will remain untouched until you verify the cloud version.</p>
      <p className="program-owner-note"><strong>Cloud owner: {ownerEmail}</strong><span>Use this same Specialist Planner sign-in identity on every device. Google and Microsoft accounts are not automatically merged.</span></p>
      <label className="backup-confirmation">
        <input aria-label="Confirm that a fresh JSON backup was exported" type="checkbox" checked={backupConfirmed} onChange={(event) => onBackupConfirmed(event.target.checked)} />
        <span><strong>I exported a fresh JSON backup</strong><small>Required before the first cloud migration.</small></span>
      </label>
      <div className="cloud-entry-actions">
        <button className="primary-button" type="button" disabled={!backupConfirmed || busy} onClick={() => void onMigrate()}>{busy ? "Moving Program…" : "Move this Program to my cloud account"}</button>
        <button className="secondary-button" type="button" disabled={busy} onClick={onCreateNew}>Create a new Program instead</button>
      </div>
      {message && <p className="cloud-message" role="alert">{message}</p>}
      <small>Migration is idempotent: retrying cannot duplicate the Program or its Teaching Sessions.</small>
    </section>
  </main>;
}

function ProgramOnboarding({ onCreate, busy, message }: {
  onCreate: (subjectType: ProgramSubjectType, name: string, firstUnit?: { yearLevelName: string; unitTitle: string }) => Promise<void>;
  busy: boolean;
  message: string;
}) {
  const [subjectType, setSubjectType] = useState<ProgramSubjectType>("art");
  const [name, setName] = useState(defaultProgramName("art"));
  const [yearLevelName, setYearLevelName] = useState("");
  const [unitTitle, setUnitTitle] = useState("");
  function choose(next: ProgramSubjectType) {
    setSubjectType(next);
    setName(defaultProgramName(next));
  }
  return <main className="cloud-entry">
    <section className="cloud-entry-card onboarding-program">
      <p className="eyebrow">Welcome to Specialist Planner</p>
      <h1>Create your Specialist Planner</h1>
      <fieldset>
        <legend>What do you teach?</legend>
        <div className="preset-grid">{SUBJECT_PRESETS.map((preset) => <button className={subjectType === preset.id ? "active" : ""} type="button" key={preset.id} onClick={() => choose(preset.id)}>{preset.label}</button>)}</div>
      </fieldset>
      <label className="program-name-field">
        <span>{subjectType === "languages" ? "Language / Program name" : subjectType === "other" ? "Specialist area / Program name" : "Program name"}</span>
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder={subjectType === "languages" ? "e.g. Mandarin or Japanese" : "e.g. Visual Arts"} />
      </label>
      <div className="onboarding-first-unit">
        <span>Create your first Unit <i>optional</i></span>
        <p>Add one teaching sequence now, or enter Week and build the Unit Library progressively.</p>
        <div><label><span>Year level</span><input value={yearLevelName} onChange={(event) => setYearLevelName(event.target.value)} placeholder="e.g. Year 3" /></label><label><span>Unit title</span><input value={unitTitle} onChange={(event) => setUnitTitle(event.target.value)} placeholder="e.g. Drawing" /></label></div>
      </div>
      <p className="cloud-entry-copy">After creation, Week opens first. You can add classes, Lessons and your timetable progressively.</p>
      <div className="cloud-entry-actions">
        <button className="primary-button" type="button" disabled={!name.trim() || busy || Boolean(yearLevelName.trim()) !== Boolean(unitTitle.trim())} onClick={() => void onCreate(subjectType, name, yearLevelName.trim() && unitTitle.trim() ? { yearLevelName: yearLevelName.trim(), unitTitle: unitTitle.trim() } : undefined)}>{busy ? "Creating Program…" : yearLevelName.trim() && unitTitle.trim() ? "Create Program with first Unit" : `Create ${name.trim() || "Program"}`}</button>
        {(yearLevelName || unitTitle) && <button className="secondary-button" type="button" disabled={busy} onClick={() => void onCreate(subjectType, name)}>I’ll add Units later</button>}
      </div>
      {message && <p className="cloud-message" role="alert">{message}</p>}
      <small>No sample classes or progress will be added.</small>
    </section>
  </main>;
}

export function CloudPlannerApp() {
  const services = getFirebaseServices();
  const [phase, setPhase] = useState<AppPhase>(services ? "initializing" : "error");
  const [user, setUser] = useState<User | null>(null);
  const [program, setProgram] = useState<CloudProgram | null>(null);
  const [localPlanner, setLocalPlanner] = useState<PlannerData | null>(null);
  const [message, setMessage] = useState(services ? "" : "Cloud services are not configured for this build.");
  const [busy, setBusy] = useState(false);
  const [backupConfirmed, setBackupConfirmed] = useState(false);
  const [sync, setSync] = useState<{ tone: SyncTone; label: string }>({ tone: "synced", label: "Synced to cloud" });
  const [conflict, setConflict] = useState<CloudProgram | null>(null);
  const [workspaceEpoch, setWorkspaceEpoch] = useState(0);
  const userRef = useRef<User | null>(null);
  const conflictRef = useRef<CloudProgram | null>(null);
  const programRef = useRef<CloudProgram | null>(null);
  const plannerRef = useRef<PlannerData | null>(null);
  const revisionRef = useRef(0);
  const pendingOperationRef = useRef<CloudPendingOperation | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  const flushRef = useRef<() => Promise<void>>(async () => {});

  const cacheProgram = useCallback((next: CloudProgram, pending: boolean, nextMutationId?: string, pendingOperation?: CloudPendingOperation | null) => {
    const currentUser = userRef.current;
    if (!currentUser) return;
    writeCloudCache(window.localStorage, {
      uid: currentUser.uid,
      programId: next.id,
      programName: next.name,
      subjectType: next.subjectType,
      customSubjectName: next.customSubjectName,
      revision: next.revision,
      planner: next.data,
      pending,
      mutationId: nextMutationId,
      ...(pendingOperation ? { pendingOperation } : {}),
    });
  }, []);

  const openWorkspace = useCallback((next: CloudProgram, options: {
    tone?: SyncTone;
    label?: string;
    pending?: boolean;
    pendingOperation?: CloudPendingOperation | null;
  } = {}) => {
    const tone = options.tone ?? "synced";
    const label = options.label ?? "Synced to cloud";
    programRef.current = next;
    plannerRef.current = next.data;
    revisionRef.current = next.revision;
    pendingOperationRef.current = options.pendingOperation ?? null;
    conflictRef.current = null;
    setProgram(next);
    setSync({ tone, label });
    setConflict(null);
    setWorkspaceEpoch((current) => current + 1);
    setPhase("workspace");
    cacheProgram(next, options.pending ?? false, options.pendingOperation?.mutationId, options.pendingOperation);
  }, [cacheProgram]);

  useEffect(() => {
    if (!services) return;
    return onAuthStateChanged(services.auth, (nextUser) => {
      userRef.current = nextUser;
      setUser(nextUser);
      setMessage("");
      setProgram(null);
      programRef.current = null;
      plannerRef.current = null;
      if (!nextUser) {
        setPhase("signed-out");
        return;
      }
      setPhase("loading-program");
      void (async () => {
        try {
          await saveUserProfile(services.db, nextUser);
          const programs = await listProgramsForUser(services.db, nextUser.uid);
          if (programs.length) {
            openWorkspace(programs[0]);
            return;
          }
          const loaded = loadPlanner(window.localStorage, samplePlanner);
          if (loaded.planner) {
            setLocalPlanner(loaded.planner);
            setPhase("migration");
          } else {
            setPhase("onboarding");
          }
        } catch (error) {
          const cached = readCloudCache(window.localStorage, nextUser.uid);
          if (cached) {
            const cachedProgram = {
              ...makeCloudProgram({ id: cached.programId, ownerUid: nextUser.uid, name: cached.programName, subjectType: cached.subjectType, customSubjectName: cached.customSubjectName, planner: cached.planner, mutationId: cached.mutationId ?? "cached-state" }),
              revision: cached.revision,
            };
            openWorkspace(cachedProgram, {
              tone: cached.pending ? "pending" : "offline",
              label: cached.pending ? "Sync pending" : "Offline · showing your locked local cache",
              pending: cached.pending,
              pendingOperation: cached.pendingOperation ?? null,
            });
            if (cached.pending && navigator.onLine) setTimeout(() => void flushRef.current(), 1000);
            return;
          }
          setMessage(errorMessage(error));
          setPhase("error");
        }
      })();
    });
  }, [openWorkspace, services]);

  async function flush() {
    if (!services || !user || !programRef.current || !plannerRef.current || savingRef.current || conflictRef.current) return;
    savingRef.current = true;
    const current = programRef.current;
    const operation = pendingOperationRef.current ?? { mutationId: mutationId("save"), expectedRevision: revisionRef.current, planner: plannerRef.current };
    pendingOperationRef.current = operation;
    let retryDelay: number | null = null;
    setSync({ tone: "saving", label: "Saving…" });
    cacheProgram({ ...current, data: plannerRef.current }, true, operation.mutationId, operation);
    try {
      const saved = await saveProgram(services.db, { uid: user.uid, programId: current.id, expectedRevision: operation.expectedRevision, planner: operation.planner, mutationId: operation.mutationId });
      revisionRef.current = saved.revision;
      pendingOperationRef.current = null;
      const latestPlanner = plannerRef.current ?? saved.data;
      const hasNewerLocalChanges = JSON.stringify(latestPlanner) !== JSON.stringify(operation.planner);
      programRef.current = { ...saved, data: latestPlanner };
      setProgram(programRef.current);
      if (!hasNewerLocalChanges) {
        setSync({ tone: "synced", label: "Synced to cloud" });
        cacheProgram(saved, false);
      } else {
        setSync({ tone: "pending", label: "Sync pending" });
        cacheProgram(programRef.current, true);
        retryDelay = 250;
      }
    } catch (error) {
      if (error instanceof ProgramConflictError) {
        pendingOperationRef.current = null;
        conflictRef.current = error.latest;
        setConflict(error.latest);
        setSync({ tone: "conflict", label: "Sync conflict" });
      } else {
        setSync({ tone: navigator.onLine ? "pending" : "offline", label: navigator.onLine ? "Sync pending" : "Offline · changes saved locally" });
        cacheProgram({ ...current, data: plannerRef.current }, true, operation.mutationId, operation);
        retryDelay = navigator.onLine ? 5000 : null;
      }
    } finally {
      savingRef.current = false;
      if (retryDelay !== null && !conflictRef.current) {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => void flushRef.current(), retryDelay);
      }
    }
  }

  useEffect(() => {
    flushRef.current = flush;
  });

  useEffect(() => {
    const retry = () => void flushRef.current();
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, []);

  function changePlanner(next: PlannerData) {
    if (!programRef.current) return;
    plannerRef.current = next;
    programRef.current = { ...programRef.current, name: activeProgramName(next), data: next };
    setProgram(programRef.current);
    setSync({ tone: navigator.onLine ? "pending" : "offline", label: navigator.onLine ? "Sync pending" : "Offline · changes saved locally" });
    cacheProgram(programRef.current, true, pendingOperationRef.current?.mutationId, pendingOperationRef.current);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void flushRef.current(), 900);
  }

  async function handleSignIn(provider: AuthProviderName) {
    setMessage("");
    try { await signInWithProvider(provider); }
    catch (error) { setMessage(errorMessage(error)); }
  }

  async function migrateLocalProgram() {
    if (!services || !user || !localPlanner || !backupConfirmed) return;
    setBusy(true);
    setMessage("");
    try {
      const programId = migrationProgramId(window.localStorage, user.uid);
      const name = activeProgramName(localPlanner);
      const subjectType = inferredSubject(name);
      const migrated = await createProgram(services.db, { programId, uid: user.uid, name, subjectType, customSubjectName: name, planner: localPlanner, mutationId: `migrate-${programId}` });
      const verified = await listProgramsForUser(services.db, user.uid);
      const readBack = verified.find((item) => item.id === migrated.id);
      if (!readBack) throw new Error("Cloud verification did not find the migrated Program.");
      markOneTimeMigrationsApplied(window.localStorage);
      finishMigrationIntent(window.localStorage, user.uid);
      openWorkspace(readBack);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function createNewProgram(subjectType: ProgramSubjectType, name: string, firstUnit?: { yearLevelName: string; unitTitle: string }) {
    if (!services || !user) return;
    setBusy(true);
    setMessage("");
    try {
      const programId = `program-${crypto.randomUUID()}`;
      let planner = preparePlannerForProgram(programId, name);
      if (firstUnit) {
        const yearLevelId = `year-${crypto.randomUUID()}`;
        const numberLabel = firstUnit.yearLevelName.match(/\d+/)?.[0];
        const shortLabel = numberLabel ?? firstUnit.yearLevelName.trim().slice(0, 2);
        planner = touchPlanner({ ...planner, yearLevels: [{ id: yearLevelId, label: firstUnit.yearLevelName, shortLabel, currentUnitId: null, expectedLessonId: null }] });
        planner = createUnitRecord(planner, {
          id: `unit-${crypto.randomUUID()}`,
          yearLevelId,
          yearLevelIds: [yearLevelId],
          title: firstUnit.unitTitle,
          lessons: [{ id: `lesson-${crypto.randomUUID()}`, title: "First lesson", sequence: 1 }],
        });
      }
      const created = await createProgram(services.db, { programId, uid: user.uid, name, subjectType, customSubjectName: subjectType === "languages" || subjectType === "other" ? name : undefined, planner, mutationId: mutationId("create") });
      openWorkspace(created);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function importCloudBackup(restored: PlannerData): Promise<PlannerData> {
    if (!services || !user || !programRef.current) throw new Error("No cloud Program is open.");
    if (sync.tone !== "synced") throw new Error("Wait for pending changes to sync before restoring a backup.");
    const summary = summarizeLocalProgram(restored);
    const confirmed = window.confirm(`Restore “${summary.name}” with ${summary.classes} classes, ${summary.units} Units and ${summary.recordedSessions} recorded sessions? A cloud safety snapshot will be created first.`);
    if (!confirmed) throw new Error("Backup restore cancelled.");
    const restoredProgram = await restoreProgram(services.db, { uid: user.uid, programId: programRef.current.id, expectedRevision: revisionRef.current, restoredPlanner: restored, mutationId: mutationId("restore") });
    openWorkspace(restoredProgram);
    return restoredProgram.data;
  }

  async function handleSignOut() {
    if (!services) return;
    if ((sync.tone === "pending" || sync.tone === "offline" || sync.tone === "saving") && !window.confirm("Some changes have not reached the cloud yet. Sign out anyway? They will remain locked in this browser for your account.")) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setProgram(null);
    userRef.current = null;
    programRef.current = null;
    plannerRef.current = null;
    await signOut(services.auth);
  }

  function loadLatestAfterConflict() {
    if (!conflict) return;
    pendingOperationRef.current = null;
    conflictRef.current = null;
    openWorkspace(conflict);
  }

  if (!services) return <AuthScreen googleEnabled={false} microsoftEnabled={false} onSignIn={handleSignIn} message={message} />;
  if (phase === "initializing" || phase === "loading-program") return <div className="loading-screen"><span className="brand-mark">SP</span><p>{phase === "initializing" ? "Opening secure sign-in…" : "Opening your private Program…"}</p></div>;
  if (phase === "signed-out" || (phase === "error" && !user)) return <AuthScreen googleEnabled={services.config.authGoogleEnabled} microsoftEnabled={services.config.authMicrosoftEnabled} onSignIn={handleSignIn} message={message} />;
  if (phase === "migration" && localPlanner && user) return <MigrationChoice planner={localPlanner} ownerEmail={user.email ?? "this signed-in account"} backupConfirmed={backupConfirmed} onBackupConfirmed={setBackupConfirmed} onMigrate={migrateLocalProgram} onCreateNew={() => setPhase("onboarding")} busy={busy} message={message} />;
  if (phase === "onboarding") return <ProgramOnboarding onCreate={createNewProgram} busy={busy} message={message} />;
  if (phase === "workspace" && program && user) return <>
    <DashboardApp key={`${program.id}-${workspaceEpoch}`} cloud={{ planner: program.data, user: { displayName: user.displayName ?? user.email?.split("@")[0] ?? "Teacher", email: user.email ?? "Signed-in account", initials: initialsFor(user) }, sync, onPlannerChange: changePlanner, onImportBackup: importCloudBackup, onSignOut: handleSignOut }} />
    {conflict && <div className="modal-layer"><section className="sync-conflict-dialog" role="alertdialog" aria-modal="true" aria-labelledby="sync-conflict-title"><p className="eyebrow">Sync conflict</p><h2 id="sync-conflict-title">This Program was updated on another device.</h2><p>Your local changes were not allowed to overwrite the newer cloud revision. Load the latest cloud version to continue safely.</p><button className="primary-button" type="button" onClick={loadLatestAfterConflict}>Load latest version</button></section></div>}
  </>;
  return <main className="cloud-entry"><section className="cloud-entry-card"><p className="eyebrow">Cloud workspace unavailable</p><h1>We could not open your Program.</h1><p className="cloud-message" role="alert">{message || "Please check your connection and try again."}</p><button className="secondary-button" type="button" onClick={() => window.location.reload()}>Try again</button></section></main>;
}
