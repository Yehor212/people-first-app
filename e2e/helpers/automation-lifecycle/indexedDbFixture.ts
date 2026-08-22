export interface AutomationLifecycleFixture {
  readonly databaseName: "ZenFlowDB";
  readonly expectedDatabaseVersion: 110;
  readonly ownerA: string;
  readonly ownerB: string;
  readonly keys: {
    readonly primaryMood: string;
    readonly acknowledgedMood: string;
    readonly staleSourceMood: string;
    readonly staleDerivedMood: string;
    readonly derivedJournal: string;
    readonly sourceIntentA: string;
    readonly sourceIntentB: string;
    readonly pendingTransaction: string;
    readonly acknowledgedTransaction: string;
    readonly staleTransaction: string;
    readonly pendingRevision: string;
    readonly acknowledgedRevision: string;
    readonly pendingOutbox: string;
    readonly acknowledgedOutbox: string;
    readonly staleOutbox: string;
    readonly historyMarker: string;
  };
  readonly rows: {
    readonly moods: readonly Record<string, unknown>[];
    readonly journalEntries: readonly Record<string, unknown>[];
    readonly automationTransactions: readonly Record<string, unknown>[];
    readonly automationHistoryMarkers: readonly Record<string, unknown>[];
    readonly offlineQueue: readonly Record<string, unknown>[];
  };
}

export interface AutomationLifecycleSnapshot {
  readonly databaseVersion: number;
  readonly primary: {
    readonly mood: { readonly count: number; readonly id: string | null; readonly mood: string | null };
    readonly intent: {
      readonly count: number;
      readonly id: string | null;
      readonly kind: string | null;
      readonly ownerUserId: string | null;
    };
  };
  readonly derived: {
    readonly journal: { readonly count: number; readonly id: string | null; readonly updatedAt: number | null };
    readonly transaction: {
      readonly count: number;
      readonly id: string | null;
      readonly ownerUserId: string | null;
      readonly status: string | null;
    };
    readonly revision: {
      readonly count: number;
      readonly id: string | null;
      readonly transactionId: string | null;
    };
    readonly outbox: {
      readonly count: number;
      readonly id: string | null;
      readonly operationId: string | null;
      readonly ownerUserId: string | null;
    };
  };
  readonly remoteAck: {
    readonly mood: { readonly count: number; readonly id: string | null; readonly mood: string | null };
    readonly transaction: {
      readonly count: number;
      readonly id: string | null;
      readonly ownerUserId: string | null;
      readonly serverSequence: number | null;
      readonly status: string | null;
    };
    readonly revision: {
      readonly count: number;
      readonly id: string | null;
      readonly transactionId: string | null;
    };
    readonly outboxCount: number;
    readonly marker: {
      readonly count: number;
      readonly historyGeneration: number | null;
      readonly lastAppliedServerSequence: number | null;
      readonly ownerUserId: string | null;
    };
  };
  readonly staleOwner: {
    readonly sourceMoodCount: number;
    readonly intentOwnerUserId: string | null;
    readonly transactionOwnerUserId: string | null;
    readonly outboxOwnerUserId: string | null;
    readonly derivedMoodCount: number;
  };
}

const OWNER_A = "14600000-0000-4000-8000-000000000001";
const OWNER_B = "14600000-0000-4000-8000-000000000002";
const CONSENT_EPOCH = "14600000-0000-4000-8000-000000000003";
const PENDING_TRANSACTION = "14600000-0000-4000-8000-000000000010";
const ACKNOWLEDGED_TRANSACTION = "14600000-0000-4000-8000-000000000011";
const STALE_TRANSACTION = "14600000-0000-4000-8000-000000000012";
const PENDING_REVISION_TOKEN = "14600000-0000-4000-8000-000000000020";
const ACKNOWLEDGED_REVISION_TOKEN = "14600000-0000-4000-8000-000000000021";
const SOURCE_KEY_A = `sha256:${"a".repeat(64)}`;
const SOURCE_KEY_B = `sha256:${"d".repeat(64)}`;
const SOURCE_INTENT_A = `source_pending:${SOURCE_KEY_A}`;
const SOURCE_INTENT_B = `source_pending:${SOURCE_KEY_B}`;
const DERIVED_JOURNAL = "t146-derived-journal";
const ACKNOWLEDGED_MOOD = "t146-acked-mood";
const TEST_ONLY_JOURNAL_ENVELOPE =
  "zenflow:journal-content:v1:eyJhbGciOiJBRVMtR0NNIiwiY2lwaGVydGV4dCI6Ik1USXpORFUyTnpnNU1HRmlZMlJsWmc9PSIsIml2IjoiTVRJek5EVTJOemc1TURFeSIsImtkZiI6IlBCS0RGMi1TSEEyNTYiLCJpdGVyYXRpb25zIjo2MDAwMDAsInNhbHQiOiJNVEl6TkRVMk56ZzVNR0ZpWTJSbFpnPT0iLCJ2IjoxfQ==";

export const T146_AUTOMATION_LIFECYCLE_FIXTURE: AutomationLifecycleFixture = {
  databaseName: "ZenFlowDB",
  expectedDatabaseVersion: 110,
  ownerA: OWNER_A,
  ownerB: OWNER_B,
  keys: {
    primaryMood: "t146-primary-mood",
    acknowledgedMood: ACKNOWLEDGED_MOOD,
    staleSourceMood: "t146-stale-source-mood",
    staleDerivedMood: "t146-stale-derived-mood",
    derivedJournal: DERIVED_JOURNAL,
    sourceIntentA: SOURCE_INTENT_A,
    sourceIntentB: SOURCE_INTENT_B,
    pendingTransaction: PENDING_TRANSACTION,
    acknowledgedTransaction: ACKNOWLEDGED_TRANSACTION,
    staleTransaction: STALE_TRANSACTION,
    pendingRevision: `record_revision:journal:${DERIVED_JOURNAL}`,
    acknowledgedRevision: `record_revision:mood:${ACKNOWLEDGED_MOOD}`,
    pendingOutbox: `automation-commit:${PENDING_TRANSACTION}`,
    acknowledgedOutbox: `automation-commit:${ACKNOWLEDGED_TRANSACTION}`,
    staleOutbox: `automation-commit:${STALE_TRANSACTION}`,
    historyMarker: OWNER_A,
  },
  rows: {
    moods: [
      {
        id: "t146-primary-mood",
        mood: "okay",
        date: "2026-08-08",
        timestamp: 1_460_001,
        updatedAt: 1_460_001,
      },
      {
        id: ACKNOWLEDGED_MOOD,
        mood: "good",
        date: "2026-08-08",
        timestamp: 1_460_003,
        updatedAt: 1_460_003,
      },
      {
        id: "t146-stale-source-mood",
        mood: "bad",
        date: "2026-08-08",
        timestamp: 1_460_004,
        updatedAt: 1_460_004,
        note: "t146 isolated lifecycle fixture",
      },
    ],
    journalEntries: [
      {
        id: DERIVED_JOURNAL,
        date: "2026-08-08",
        title: "",
        content: TEST_ONLY_JOURNAL_ENVELOPE,
        stickers: [],
        photoIds: [],
        audioIds: [],
        tags: [],
        createdAt: 1_460_002,
        updatedAt: 1_460_002,
      },
    ],
    automationTransactions: [
      {
        kind: "source_pending",
        id: SOURCE_INTENT_A,
        schemaVersion: 1,
        ownerUserId: OWNER_A,
        consentEpoch: CONSENT_EPOCH,
        accountBoundaryGeneration: "t146-boundary-a",
        source: {
          schemaVersion: 1,
          type: "mood",
          id: "t146-primary-mood",
          revision: "updatedAt:1460001",
          committedAt: 1_460_001,
        },
        candidateRuleIds: ["mood.note-to-journal.v1"],
        sourceKey: SOURCE_KEY_A,
        createdAt: 1_460_001,
        updatedAt: 1_460_001,
      },
      {
        kind: "transaction",
        id: PENDING_TRANSACTION,
        ownerUserId: OWNER_A,
        consentEpoch: CONSENT_EPOCH,
        sourceKey: `sha256:${"b".repeat(64)}`,
        ruleId: "mood.note-to-journal.v1",
        ruleVersion: 1,
        sourceType: "mood",
        sourceId: "t146-primary-mood",
        status: "commit_pending",
        revisionCiphertext: "zenflow:automation-revision:v1:t146-pending",
        createdAt: 1_460_002,
        updatedAt: 1_460_002,
        schemaVersion: 1,
      },
      {
        kind: "record_revision",
        id: `record_revision:journal:${DERIVED_JOURNAL}`,
        schemaVersion: 1,
        ownerUserId: OWNER_A,
        entityType: "journal",
        entityId: DERIVED_JOURNAL,
        recordExists: true,
        revisionToken: PENDING_REVISION_TOKEN,
        stateHash: `sha256:${"c".repeat(64)}`,
        mutationGeneration: 1,
        transactionId: PENDING_TRANSACTION,
        updatedAt: 1_460_002,
      },
      {
        kind: "transaction",
        id: ACKNOWLEDGED_TRANSACTION,
        ownerUserId: OWNER_A,
        consentEpoch: CONSENT_EPOCH,
        sourceKey: `sha256:${"c".repeat(64)}`,
        ruleId: "journal.mood-to-checkin.v1",
        ruleVersion: 1,
        sourceType: "journal",
        sourceId: "t146-remote-source",
        status: "committed",
        revisionCiphertext: "zenflow:automation-revision:v1:t146-acknowledged",
        createdAt: 1_460_003,
        updatedAt: 1_460_003,
        serverSequence: 7,
        historyGeneration: 1,
        schemaVersion: 1,
      },
      {
        kind: "record_revision",
        id: `record_revision:mood:${ACKNOWLEDGED_MOOD}`,
        schemaVersion: 1,
        ownerUserId: OWNER_A,
        entityType: "mood",
        entityId: ACKNOWLEDGED_MOOD,
        recordExists: true,
        revisionToken: ACKNOWLEDGED_REVISION_TOKEN,
        stateHash: `sha256:${"d".repeat(64)}`,
        mutationGeneration: 1,
        transactionId: ACKNOWLEDGED_TRANSACTION,
        updatedAt: 1_460_003,
      },
      {
        kind: "source_pending",
        id: SOURCE_INTENT_B,
        schemaVersion: 1,
        ownerUserId: OWNER_B,
        consentEpoch: CONSENT_EPOCH,
        accountBoundaryGeneration: "t146-boundary-b",
        source: {
          schemaVersion: 1,
          type: "mood",
          id: "t146-stale-source-mood",
          revision: "updatedAt:1460004",
          committedAt: 1_460_004,
        },
        candidateRuleIds: ["mood.note-to-journal.v1"],
        sourceKey: SOURCE_KEY_B,
        createdAt: 1_460_004,
        updatedAt: 1_460_004,
      },
      {
        kind: "transaction",
        id: STALE_TRANSACTION,
        ownerUserId: OWNER_B,
        consentEpoch: CONSENT_EPOCH,
        sourceKey: `sha256:${"e".repeat(64)}`,
        ruleId: "mood.note-to-journal.v1",
        ruleVersion: 1,
        sourceType: "mood",
        sourceId: "t146-stale-source-mood",
        status: "commit_pending",
        revisionCiphertext: "zenflow:automation-revision:v1:t146-stale-owner",
        createdAt: 1_460_004,
        updatedAt: 1_460_004,
        schemaVersion: 1,
      },
    ],
    automationHistoryMarkers: [
      {
        schemaVersion: 1,
        ownerUserId: OWNER_A,
        historyGeneration: 1,
        snapshotSequence: 7,
        lastAppliedServerSequence: 7,
        bootstrapCompletedAt: 1_460_003,
        updatedAt: 1_460_003,
      },
    ],
    offlineQueue: [
      {
        id: `automation-commit:${PENDING_TRANSACTION}`,
        operationId: PENDING_TRANSACTION,
        type: "COMMIT_AUTOMATION_TRANSACTION",
        entityId: PENDING_TRANSACTION,
        ownerUserId: OWNER_A,
        payload: {
          schemaVersion: 1,
          transactionId: PENDING_TRANSACTION,
          expectedPreferenceRevision: 1,
          expectedHistoryGeneration: 1,
          deviceId: "t146-android",
        },
        timestamp: 1_460_002,
        retries: 0,
        maxRetries: 5,
        priority: "critical",
      },
      {
        id: `automation-commit:${STALE_TRANSACTION}`,
        operationId: STALE_TRANSACTION,
        type: "COMMIT_AUTOMATION_TRANSACTION",
        entityId: STALE_TRANSACTION,
        ownerUserId: OWNER_B,
        payload: {
          schemaVersion: 1,
          transactionId: STALE_TRANSACTION,
          expectedPreferenceRevision: 1,
          expectedHistoryGeneration: 1,
          deviceId: "t146-stale-owner",
        },
        timestamp: 1_460_004,
        retries: 0,
        maxRetries: 5,
        priority: "critical",
      },
    ],
  },
};

export const T146_EXPECTED_AUTOMATION_LIFECYCLE_SNAPSHOT: AutomationLifecycleSnapshot = {
  databaseVersion: 110,
  primary: {
    mood: { count: 1, id: "t146-primary-mood", mood: "okay" },
    intent: { count: 1, id: SOURCE_INTENT_A, kind: "source_pending", ownerUserId: OWNER_A },
  },
  derived: {
    journal: { count: 1, id: DERIVED_JOURNAL, updatedAt: 1_460_002 },
    transaction: {
      count: 1,
      id: PENDING_TRANSACTION,
      ownerUserId: OWNER_A,
      status: "commit_pending",
    },
    revision: {
      count: 1,
      id: `record_revision:journal:${DERIVED_JOURNAL}`,
      transactionId: PENDING_TRANSACTION,
    },
    outbox: {
      count: 1,
      id: `automation-commit:${PENDING_TRANSACTION}`,
      operationId: PENDING_TRANSACTION,
      ownerUserId: OWNER_A,
    },
  },
  remoteAck: {
    mood: { count: 1, id: ACKNOWLEDGED_MOOD, mood: "good" },
    transaction: {
      count: 1,
      id: ACKNOWLEDGED_TRANSACTION,
      ownerUserId: OWNER_A,
      serverSequence: 7,
      status: "committed",
    },
    revision: {
      count: 1,
      id: `record_revision:mood:${ACKNOWLEDGED_MOOD}`,
      transactionId: ACKNOWLEDGED_TRANSACTION,
    },
    outboxCount: 0,
    marker: {
      count: 1,
      historyGeneration: 1,
      lastAppliedServerSequence: 7,
      ownerUserId: OWNER_A,
    },
  },
  staleOwner: {
    sourceMoodCount: 1,
    intentOwnerUserId: OWNER_B,
    transactionOwnerUserId: OWNER_B,
    outboxOwnerUserId: OWNER_B,
    derivedMoodCount: 0,
  },
};

export async function seedAutomationLifecycleFixture(
  fixture: AutomationLifecycleFixture,
): Promise<{ databaseVersion: number }> {
  const openRequest = indexedDB.open(fixture.databaseName);
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    openRequest.onerror = () =>
      reject(new Error("T146 could not open ZenFlowDB", { cause: openRequest.error }));
    openRequest.onsuccess = () => resolve(openRequest.result);
  });
  const storeNames = [
    "moods",
    "journalEntries",
    "automationTransactions",
    "automationHistoryMarkers",
    "offlineQueue",
  ];
  for (const storeName of storeNames) {
    if (!database.objectStoreNames.contains(storeName)) {
      database.close();
      throw new Error(`T146 requires IndexedDB store ${storeName}`);
    }
  }

  const transaction = database.transaction(storeNames, "readwrite");
  const cleanupKeys: Record<string, readonly string[]> = {
    moods: [
      fixture.keys.primaryMood,
      fixture.keys.acknowledgedMood,
      fixture.keys.staleSourceMood,
      fixture.keys.staleDerivedMood,
    ],
    journalEntries: [fixture.keys.derivedJournal],
    automationTransactions: [
      fixture.keys.sourceIntentA,
      fixture.keys.sourceIntentB,
      fixture.keys.pendingTransaction,
      fixture.keys.acknowledgedTransaction,
      fixture.keys.staleTransaction,
      fixture.keys.pendingRevision,
      fixture.keys.acknowledgedRevision,
    ],
    automationHistoryMarkers: [fixture.keys.historyMarker],
    offlineQueue: [
      fixture.keys.pendingOutbox,
      fixture.keys.acknowledgedOutbox,
      fixture.keys.staleOutbox,
    ],
  };
  for (const [storeName, keys] of Object.entries(cleanupKeys)) {
    const store = transaction.objectStore(storeName);
    for (const key of keys) store.delete(key);
  }
  for (const [storeName, rows] of Object.entries(fixture.rows)) {
    const store = transaction.objectStore(storeName);
    for (const row of rows) store.put(row);
  }
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(new Error("T146 fixture transaction failed", { cause: transaction.error }));
    transaction.onabort = () =>
      reject(new Error("T146 fixture transaction aborted", { cause: transaction.error }));
  });
  const databaseVersion = database.version;
  database.close();
  return { databaseVersion };
}

export async function readAutomationLifecycleSnapshot(
  fixture: AutomationLifecycleFixture,
): Promise<AutomationLifecycleSnapshot> {
  const openRequest = indexedDB.open(fixture.databaseName);
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    openRequest.onerror = () =>
      reject(new Error("T146 could not open ZenFlowDB", { cause: openRequest.error }));
    openRequest.onsuccess = () => resolve(openRequest.result);
  });
  const transaction = database.transaction(
    [
      "moods",
      "journalEntries",
      "automationTransactions",
      "automationHistoryMarkers",
      "offlineQueue",
    ],
    "readonly",
  );
  const request = <T>(value: IDBRequest<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      value.onsuccess = () => resolve(value.result);
      value.onerror = () =>
        reject(new Error("T146 IndexedDB read failed", { cause: value.error }));
    });
  const get = (storeName: string, key: string): Promise<Record<string, unknown> | undefined> =>
    request(transaction.objectStore(storeName).get(key));
  const count = (storeName: string, key: string): Promise<number> =>
    request(transaction.objectStore(storeName).count(key));

  const [
    primaryMood,
    primaryMoodCount,
    sourceIntent,
    sourceIntentCount,
    derivedJournal,
    derivedJournalCount,
    pendingTransaction,
    pendingTransactionCount,
    pendingRevision,
    pendingRevisionCount,
    pendingOutbox,
    pendingOutboxCount,
    acknowledgedMood,
    acknowledgedMoodCount,
    acknowledgedTransaction,
    acknowledgedTransactionCount,
    acknowledgedRevision,
    acknowledgedRevisionCount,
    acknowledgedOutboxCount,
    historyMarker,
    historyMarkerCount,
    staleSourceMoodCount,
    staleIntent,
    staleTransaction,
    staleOutbox,
    staleDerivedMoodCount,
  ] = await Promise.all([
    get("moods", fixture.keys.primaryMood),
    count("moods", fixture.keys.primaryMood),
    get("automationTransactions", fixture.keys.sourceIntentA),
    count("automationTransactions", fixture.keys.sourceIntentA),
    get("journalEntries", fixture.keys.derivedJournal),
    count("journalEntries", fixture.keys.derivedJournal),
    get("automationTransactions", fixture.keys.pendingTransaction),
    count("automationTransactions", fixture.keys.pendingTransaction),
    get("automationTransactions", fixture.keys.pendingRevision),
    count("automationTransactions", fixture.keys.pendingRevision),
    get("offlineQueue", fixture.keys.pendingOutbox),
    count("offlineQueue", fixture.keys.pendingOutbox),
    get("moods", fixture.keys.acknowledgedMood),
    count("moods", fixture.keys.acknowledgedMood),
    get("automationTransactions", fixture.keys.acknowledgedTransaction),
    count("automationTransactions", fixture.keys.acknowledgedTransaction),
    get("automationTransactions", fixture.keys.acknowledgedRevision),
    count("automationTransactions", fixture.keys.acknowledgedRevision),
    count("offlineQueue", fixture.keys.acknowledgedOutbox),
    get("automationHistoryMarkers", fixture.keys.historyMarker),
    count("automationHistoryMarkers", fixture.keys.historyMarker),
    count("moods", fixture.keys.staleSourceMood),
    get("automationTransactions", fixture.keys.sourceIntentB),
    get("automationTransactions", fixture.keys.staleTransaction),
    get("offlineQueue", fixture.keys.staleOutbox),
    count("moods", fixture.keys.staleDerivedMood),
  ]);

  const stringField = (row: Record<string, unknown> | undefined, field: string): string | null =>
    typeof row?.[field] === "string" ? row[field] : null;
  const numberField = (row: Record<string, unknown> | undefined, field: string): number | null =>
    typeof row?.[field] === "number" ? row[field] : null;
  const snapshot: AutomationLifecycleSnapshot = {
    databaseVersion: database.version,
    primary: {
      mood: {
        count: primaryMoodCount,
        id: stringField(primaryMood, "id"),
        mood: stringField(primaryMood, "mood"),
      },
      intent: {
        count: sourceIntentCount,
        id: stringField(sourceIntent, "id"),
        kind: stringField(sourceIntent, "kind"),
        ownerUserId: stringField(sourceIntent, "ownerUserId"),
      },
    },
    derived: {
      journal: {
        count: derivedJournalCount,
        id: stringField(derivedJournal, "id"),
        updatedAt: numberField(derivedJournal, "updatedAt"),
      },
      transaction: {
        count: pendingTransactionCount,
        id: stringField(pendingTransaction, "id"),
        ownerUserId: stringField(pendingTransaction, "ownerUserId"),
        status: stringField(pendingTransaction, "status"),
      },
      revision: {
        count: pendingRevisionCount,
        id: stringField(pendingRevision, "id"),
        transactionId: stringField(pendingRevision, "transactionId"),
      },
      outbox: {
        count: pendingOutboxCount,
        id: stringField(pendingOutbox, "id"),
        operationId: stringField(pendingOutbox, "operationId"),
        ownerUserId: stringField(pendingOutbox, "ownerUserId"),
      },
    },
    remoteAck: {
      mood: {
        count: acknowledgedMoodCount,
        id: stringField(acknowledgedMood, "id"),
        mood: stringField(acknowledgedMood, "mood"),
      },
      transaction: {
        count: acknowledgedTransactionCount,
        id: stringField(acknowledgedTransaction, "id"),
        ownerUserId: stringField(acknowledgedTransaction, "ownerUserId"),
        serverSequence: numberField(acknowledgedTransaction, "serverSequence"),
        status: stringField(acknowledgedTransaction, "status"),
      },
      revision: {
        count: acknowledgedRevisionCount,
        id: stringField(acknowledgedRevision, "id"),
        transactionId: stringField(acknowledgedRevision, "transactionId"),
      },
      outboxCount: acknowledgedOutboxCount,
      marker: {
        count: historyMarkerCount,
        historyGeneration: numberField(historyMarker, "historyGeneration"),
        lastAppliedServerSequence: numberField(historyMarker, "lastAppliedServerSequence"),
        ownerUserId: stringField(historyMarker, "ownerUserId"),
      },
    },
    staleOwner: {
      sourceMoodCount: staleSourceMoodCount,
      intentOwnerUserId: stringField(staleIntent, "ownerUserId"),
      transactionOwnerUserId: stringField(staleTransaction, "ownerUserId"),
      outboxOwnerUserId: stringField(staleOutbox, "ownerUserId"),
      derivedMoodCount: staleDerivedMoodCount,
    },
  };
  database.close();
  return snapshot;
}

export async function cleanupAutomationLifecycleFixture(
  fixture: AutomationLifecycleFixture,
): Promise<{ remaining: number }> {
  const cleanupKeys: Record<string, readonly string[]> = {
    moods: [
      fixture.keys.primaryMood,
      fixture.keys.acknowledgedMood,
      fixture.keys.staleSourceMood,
      fixture.keys.staleDerivedMood,
    ],
    journalEntries: [fixture.keys.derivedJournal],
    automationTransactions: [
      fixture.keys.sourceIntentA,
      fixture.keys.sourceIntentB,
      fixture.keys.pendingTransaction,
      fixture.keys.acknowledgedTransaction,
      fixture.keys.staleTransaction,
      fixture.keys.pendingRevision,
      fixture.keys.acknowledgedRevision,
    ],
    automationHistoryMarkers: [fixture.keys.historyMarker],
    offlineQueue: [
      fixture.keys.pendingOutbox,
      fixture.keys.acknowledgedOutbox,
      fixture.keys.staleOutbox,
    ],
  };
  const openRequest = indexedDB.open(fixture.databaseName);
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    openRequest.onerror = () =>
      reject(new Error("T146 could not open ZenFlowDB", { cause: openRequest.error }));
    openRequest.onsuccess = () => resolve(openRequest.result);
  });
  const transaction = database.transaction(Object.keys(cleanupKeys), "readwrite");
  for (const [storeName, keys] of Object.entries(cleanupKeys)) {
    const store = transaction.objectStore(storeName);
    for (const key of keys) store.delete(key);
  }
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(new Error("T146 cleanup transaction failed", { cause: transaction.error }));
    transaction.onabort = () =>
      reject(new Error("T146 cleanup transaction aborted", { cause: transaction.error }));
  });
  const countTransaction = database.transaction(Object.keys(cleanupKeys), "readonly");
  const counts: Promise<number>[] = [];
  for (const [storeName, keys] of Object.entries(cleanupKeys)) {
    const store = countTransaction.objectStore(storeName);
    for (const key of keys) {
      const countRequest = store.count(key);
      counts.push(
        new Promise<number>((resolve, reject) => {
          countRequest.onsuccess = () => resolve(countRequest.result);
          countRequest.onerror = () =>
            reject(new Error("T146 cleanup verification failed", { cause: countRequest.error }));
        }),
      );
    }
  }
  const remaining = (await Promise.all(counts)).reduce((total, value) => total + value, 0);
  database.close();
  return { remaining };
}
