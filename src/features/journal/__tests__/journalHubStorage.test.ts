import { beforeEach, describe, expect, it, vi } from 'vitest';

interface MockJournalEntryLink {
  id: string;
  entryId: string;
  targetType: 'space';
  targetId: string;
  createdAt: number;
}

const journalBoundaryMocks = vi.hoisted(() => ({
  blocked: false,
  run: vi.fn(async <T>(operation: () => Promise<T>): Promise<T> => {
    if (journalBoundaryMocks.blocked) throw new Error('Account boundary changed');
    return operation();
  }),
}));

const {
  mockPreferencesTable,
  mockSpacesTable,
  mockPracticeSessionsTable,
  mockEntryLinksTable,
  mockSpaceCapturesTable,
} = vi.hoisted(() => {
  const preferences = {
    get: vi.fn(),
    put: vi.fn(() => Promise.resolve()),
    delete: vi.fn(() => Promise.resolve()),
  };

  const spaces = {
    get: vi.fn(),
    toArray: vi.fn(),
    put: vi.fn(() => Promise.resolve()),
    delete: vi.fn(() => Promise.resolve()),
  };

  const practiceSessions = {
    put: vi.fn(() => Promise.resolve()),
    where: vi.fn(() => ({
      equals: vi.fn(() => ({
        toArray: vi.fn(() => Promise.resolve([])),
        reverse: vi.fn(() => ({
          sortBy: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
  };

  const entryLinks = {
    put: vi.fn(() => Promise.resolve()),
    delete: vi.fn(() => Promise.resolve()),
    where: vi.fn(() => ({
      equals: vi.fn(() => ({
        toArray: vi.fn<() => Promise<MockJournalEntryLink[]>>(() => Promise.resolve([])),
      })),
    })),
  };

  const spaceCaptures = {
    toArray: vi.fn(() => Promise.resolve([])),
    put: vi.fn(() => Promise.resolve()),
    where: vi.fn(() => ({
      equals: vi.fn(() => ({
        toArray: vi.fn(() => Promise.resolve([])),
      })),
    })),
  };

  return {
    mockPreferencesTable: preferences,
    mockSpacesTable: spaces,
    mockPracticeSessionsTable: practiceSessions,
    mockEntryLinksTable: entryLinks,
    mockSpaceCapturesTable: spaceCaptures,
  };
});

vi.mock('@/storage/db', () => ({
  db: {
    settings: {
      get: vi.fn(() => Promise.resolve(undefined)),
    },
    journalHubPreferences: mockPreferencesTable,
    journalSpaces: mockSpacesTable,
    journalPracticeSessions: mockPracticeSessionsTable,
    journalEntryLinks: mockEntryLinksTable,
    journalSpaceCaptures: mockSpaceCapturesTable,
  },
}));

vi.mock('../journalContentSession', () => ({
  getJournalContentVaultKey: vi.fn(() => null),
  getJournalContentVaultRevision: vi.fn(() => null),
}));

vi.mock('../journalSecurityWriteLock', () => ({
  runWithJournalSecurityWriteLock: journalBoundaryMocks.run,
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn() },
}));

import {
  DEFAULT_JOURNAL_HUB_PREFERENCES,
  DEFAULT_JOURNAL_SPACES,
  GRATITUDE_SPACE_ID,
  createGratitudeSpaceCapture,
  createJournalSpaceCapture,
  createQuietReleaseSession,
  createJournalPracticeSession,
  deleteJournalSpace,
  ensureGratitudeSpace,
  getQuietReleaseTraceSummaries,
  getJournalSpaceCaptures,
  getJournalHubPreferences,
  getJournalSpaces,
  getSpaceEntryLinks,
  linkEntryToSpace,
  linkJournalEntry,
  QUIET_RELEASE_PRACTICE_ID,
  resetJournalHubPreferences,
  saveJournalSpace,
  saveJournalHubPreferences,
  summarizeQuietReleaseSessionsByDate,
  unlinkEntryFromSpace,
} from '../journalHubStorage';

describe('journalHubStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    journalBoundaryMocks.blocked = false;
    journalBoundaryMocks.run.mockImplementation(async <T>(operation: () => Promise<T>) => {
      if (journalBoundaryMocks.blocked) throw new Error('Account boundary changed');
      return operation();
    });
  });

  it('rejects every direct Hub mutation when the journal account boundary is stale', async () => {
    mockSpacesTable.get.mockResolvedValue({ id: 'space-user', locked: false });
    mockEntryLinksTable.where.mockReturnValue({
      equals: vi.fn(() => ({
        toArray: vi.fn(() =>
          Promise.resolve([
            {
              id: 'link-stale',
              entryId: 'entry-1',
              targetType: 'space',
              targetId: 'space-user',
              createdAt: 1,
            },
          ])
        ),
      })),
    });
    journalBoundaryMocks.blocked = true;

    await expect(saveJournalHubPreferences({ density: 'compact' })).rejects.toThrow(
      /account boundary/i
    );
    await expect(resetJournalHubPreferences()).rejects.toThrow(/account boundary/i);
    await expect(deleteJournalSpace('space-user')).rejects.toThrow(/account boundary/i);
    await expect(
      createJournalPracticeSession({ practiceId: 'focus-note' })
    ).rejects.toThrow(/account boundary/i);
    await expect(
      linkJournalEntry({ entryId: 'entry-1', targetType: 'space', targetId: 'space-user' })
    ).rejects.toThrow(/account boundary/i);
    await expect(unlinkEntryFromSpace('entry-1', 'space-user')).rejects.toThrow(
      /account boundary/i
    );

    expect(mockPreferencesTable.put).not.toHaveBeenCalled();
    expect(mockSpacesTable.delete).not.toHaveBeenCalled();
    expect(mockPracticeSessionsTable.put).not.toHaveBeenCalled();
    expect(mockEntryLinksTable.put).not.toHaveBeenCalled();
    expect(mockEntryLinksTable.delete).not.toHaveBeenCalled();
  });

  it('returns stable default preferences when no saved row exists', async () => {
    mockPreferencesTable.get.mockResolvedValueOnce(undefined);

    const prefs = await getJournalHubPreferences();

    expect(prefs.homeView).toBe('today');
    expect(prefs.visibleViews).toEqual(['today', 'entries', 'spaces', 'practices', 'library']);
    expect(prefs.dockActions).toEqual(['write', 'quickNote', 'gratitude', 'resetThought', 'template']);
  });

  it('merges and persists preference patches', async () => {
    mockPreferencesTable.get.mockResolvedValueOnce({
      ...DEFAULT_JOURNAL_HUB_PREFERENCES,
      density: 'balanced',
    });

    const prefs = await saveJournalHubPreferences({ density: 'compact', homeView: 'spaces' });

    expect(prefs.density).toBe('compact');
    expect(prefs.homeView).toBe('spaces');
    expect(mockPreferencesTable.put).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'default',
        density: 'compact',
        homeView: 'spaces',
      }),
    );
  });

  it('resets preferences to defaults', async () => {
    const prefs = await resetJournalHubPreferences();

    expect(prefs).toMatchObject({
      ...DEFAULT_JOURNAL_HUB_PREFERENCES,
      updatedAt: expect.any(Number),
    });
    expect(mockPreferencesTable.put).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'default', homeView: 'today' }),
    );
  });

  it('returns no visible spaces when no user spaces or gratitude captures exist', async () => {
    mockSpacesTable.toArray.mockResolvedValueOnce([]);

    const spaces = await getJournalSpaces();

    expect(spaces).toEqual([]);
    expect(DEFAULT_JOURNAL_SPACES).toEqual([]);
  });

  it('hides legacy system spaces while keeping user spaces and gratitude', async () => {
    mockSpacesTable.toArray.mockResolvedValueOnce([
      {
        id: 'space-projects',
        nameKey: 'journalHubSpaceProjects',
        iconKey: 'briefcase',
        kind: 'system',
        sortOrder: 20,
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: 'space-custom',
        name: 'Мій пак',
        iconKey: 'folder',
        kind: 'user',
        sortOrder: 30,
        createdAt: 2,
        updatedAt: 2,
      },
      {
        id: GRATITUDE_SPACE_ID,
        nameKey: 'journalHubSpaceGratitude',
        iconKey: 'sprout',
        kind: 'system',
        autoSource: 'gratitude',
        locked: true,
        sortOrder: 15,
        createdAt: 3,
        updatedAt: 3,
      },
    ]);

    const spaces = await getJournalSpaces();

    expect(spaces.map((space) => space.id)).toEqual([GRATITUDE_SPACE_ID, 'space-custom']);
  });

  it('saves user folder descriptions with the folder metadata', async () => {
    const space = await saveJournalSpace({
      id: 'space-user-pack',
      name: 'Мій пак',
      description: 'Челенджі, ідеї та довгі проєкти',
      iconKey: 'folder',
      accent: 'primary',
      private: false,
      kind: 'user',
      coverKey: 'folder',
      pinnedAction: 'write',
      sortOrder: 50,
    });

    expect(space.description).toBe('Челенджі, ідеї та довгі проєкти');
    expect(mockSpacesTable.put).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'space-user-pack',
        name: 'Мій пак',
        description: 'Челенджі, ідеї та довгі проєкти',
      }),
    );
  });

  it('creates local practice sessions without touching cloud sync', async () => {
    const session = await createJournalPracticeSession({
      practiceId: 'focus-note',
      entryId: 'entry-1',
      durationSeconds: 180,
    });

    expect(session.practiceId).toBe('focus-note');
    expect(session.entryId).toBe('entry-1');
    expect(mockPracticeSessionsTable.put).toHaveBeenCalledWith(session);
  });

  it('creates quiet release sessions without saving user text or journal entries', async () => {
    const completedAt = new Date('2026-04-28T12:41:00').getTime();

    const session = await createQuietReleaseSession({ durationSeconds: 4, completedAt });

    expect(session.practiceId).toBe(QUIET_RELEASE_PRACTICE_ID);
    expect(session.startedAt).toBe(completedAt - 4000);
    expect(session.completedAt).toBe(completedAt);
    expect(session.entryId).toBeUndefined();
    expect(session).not.toHaveProperty('text');
    expect(session).not.toHaveProperty('content');
    expect(mockPracticeSessionsTable.put).toHaveBeenCalledWith(session);
  });

  it('groups quiet release traces by local date newest timestamp', async () => {
    const first = new Date('2026-04-28T10:00:00').getTime();
    const second = new Date('2026-04-28T12:41:00').getTime();
    const third = new Date('2026-04-27T23:50:00').getTime();

    const traces = summarizeQuietReleaseSessionsByDate([
      { id: 'q1', practiceId: QUIET_RELEASE_PRACTICE_ID, startedAt: first - 4000, completedAt: first },
      { id: 'q2', practiceId: QUIET_RELEASE_PRACTICE_ID, startedAt: second - 4000, completedAt: second },
      { id: 'q3', practiceId: QUIET_RELEASE_PRACTICE_ID, startedAt: third - 4000, completedAt: third },
    ]);

    expect(traces.get('2026-04-28')).toEqual({ date: '2026-04-28', count: 2, latestAt: second });
    expect(traces.get('2026-04-27')).toEqual({ date: '2026-04-27', count: 1, latestAt: third });
  });

  it('loads quiet release trace summaries from practice sessions only', async () => {
    const completedAt = new Date('2026-04-28T12:41:00').getTime();
    mockPracticeSessionsTable.where.mockReturnValueOnce({
      equals: vi.fn(() => ({
        toArray: vi.fn(() =>
          Promise.resolve([
            {
              id: 'release',
              practiceId: QUIET_RELEASE_PRACTICE_ID,
              startedAt: completedAt - 4000,
              completedAt,
            },
          ]),
        ),
        reverse: vi.fn(() => ({
          sortBy: vi.fn(() => Promise.resolve([])),
        })),
      })),
    } as ReturnType<typeof mockPracticeSessionsTable.where>);

    const traces = await getQuietReleaseTraceSummaries();

    expect(mockPracticeSessionsTable.where).toHaveBeenCalledWith('practiceId');
    expect(traces.get('2026-04-28')).toMatchObject({ count: 1, latestAt: completedAt });
  });

  it('links entries to hub entities locally', async () => {
    const link = await linkJournalEntry({
      entryId: 'entry-1',
      targetType: 'space',
      targetId: 'space-work',
    });

    expect(link.entryId).toBe('entry-1');
    expect(link.targetType).toBe('space');
    expect(mockEntryLinksTable.put).toHaveBeenCalledWith(link);
  });

  it('creates the gratitude smart-space once and protects it from deletion', async () => {
    mockSpacesTable.get.mockResolvedValueOnce(undefined);

    const space = await ensureGratitudeSpace();

    expect(space.id).toBe(GRATITUDE_SPACE_ID);
    expect(space.autoSource).toBe('gratitude');
    expect(space.locked).toBe(true);
    expect(mockSpacesTable.put).toHaveBeenCalledWith(expect.objectContaining({ id: GRATITUDE_SPACE_ID }));
  });

  it('does not duplicate existing space entry links', async () => {
    const existing = {
      id: 'entry-link-existing',
      entryId: 'entry-1',
      targetType: 'space' as const,
      targetId: 'space-projects',
      createdAt: 10,
    };
    mockEntryLinksTable.where.mockReturnValueOnce({
      equals: vi.fn(() => ({
        toArray: vi.fn(() => Promise.resolve([existing])),
      })),
    });

    const link = await linkEntryToSpace('entry-1', 'space-projects');

    expect(link).toBe(existing);
    expect(mockEntryLinksTable.put).not.toHaveBeenCalled();
  });

  it('removes a space link without deleting the journal entry', async () => {
    mockEntryLinksTable.where.mockReturnValueOnce({
      equals: vi.fn(() => ({
        toArray: vi.fn(() =>
          Promise.resolve([
            {
              id: 'entry-link-1',
              entryId: 'entry-1',
              targetType: 'space',
              targetId: 'space-projects',
              createdAt: 10,
            },
          ]),
        ),
      })),
    });

    await unlinkEntryFromSpace('entry-1', 'space-projects');

    expect(mockEntryLinksTable.delete).toHaveBeenCalledWith('entry-link-1');
  });

  it('loads canonical links for a space newest first', async () => {
    mockEntryLinksTable.where.mockReturnValueOnce({
      equals: vi.fn(() => ({
        toArray: vi.fn(() =>
          Promise.resolve([
            { id: 'old', entryId: 'entry-1', targetType: 'space', targetId: 'space-projects', createdAt: 1 },
            { id: 'new', entryId: 'entry-2', targetType: 'space', targetId: 'space-projects', createdAt: 3 },
            { id: 'other', entryId: 'entry-3', targetType: 'space', targetId: 'space-ideas', createdAt: 9 },
          ]),
        ),
      })),
    });

    const links = await getSpaceEntryLinks('space-projects');

    expect(links.map((link) => link.id)).toEqual(['new', 'old']);
  });

  it('creates local space captures without opening cloud sync', async () => {
    const capture = await createJournalSpaceCapture({
      spaceId: 'space-projects',
      spaceName: 'Projects',
      mode: 'Project room',
      title: 'Decision / progress',
      date: '2026-04-26',
      fields: [
        { prompt: 'Context', value: 'Mobile diary' },
        { prompt: 'Decision', value: 'Keep capture inside the space first' },
      ],
    });

    expect(capture.spaceId).toBe('space-projects');
    expect(capture.fields).toHaveLength(2);
    expect(mockSpaceCapturesTable.put).toHaveBeenCalledWith(capture);
  });

  it('captures gratitude inside the smart-space without creating a journal entry', async () => {
    mockSpacesTable.get.mockResolvedValueOnce({
      id: GRATITUDE_SPACE_ID,
      name: 'My gratitudes',
      iconKey: 'sprout',
      accent: 'mint',
      private: false,
      kind: 'system',
      autoSource: 'gratitude',
      locked: true,
      sortOrder: 15,
      createdAt: 1,
      updatedAt: 1,
    });
    mockSpaceCapturesTable.where.mockReturnValueOnce({
      equals: vi.fn(() => ({ toArray: vi.fn(() => Promise.resolve([])) })),
    });

    const capture = await createGratitudeSpaceCapture({
      id: 'gratitude-1',
      text: 'A quiet morning',
      date: '2026-04-29',
      timestamp: 100,
    });

    expect(capture.spaceId).toBe(GRATITUDE_SPACE_ID);
    expect(capture.sourceType).toBe('gratitude');
    expect(capture.sourceId).toBe('gratitude-1');
    expect(capture).not.toHaveProperty('content');
    expect(mockSpaceCapturesTable.put).toHaveBeenCalledWith(capture);
  });

  it('sorts local space captures newest first', async () => {
    mockSpaceCapturesTable.toArray.mockResolvedValueOnce([
      { id: 'old', spaceId: 'space-projects', spaceName: '', title: '', fields: [], createdAt: 1 },
      { id: 'new', spaceId: 'space-projects', spaceName: '', title: '', fields: [], createdAt: 3 },
    ] as any);

    const captures = await getJournalSpaceCaptures();

    expect(captures.map((capture) => capture.id)).toEqual(['new', 'old']);
  });
});
