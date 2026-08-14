// `GET /projects/:id/apps` used to return every App in the project. A member
// therefore saw the name, URL, deployment status and LIVE PREVIEW tile of
// `private` Apps owned by someone else, and of `restricted` Apps they hold no
// grant for — none of which the access-session route would let them open.
// Listing is disclosure, so the list is filtered by the same decision that
// governs opening.
//
// This file uses `mock.module`, which is PROCESS-wide in Bun and does not unwind
// at a file boundary. It therefore lives in its own file and stubs only the
// three collaborators the filter touches, so no sibling suite inherits a broken
// `db`/`iam`/`share`.
import { describe, expect, mock, test } from 'bun:test';

const ACCOUNT_ID = '00000000-0000-4000-a000-0000000000a1';
const PROJECT_ID = '00000000-0000-4000-a000-0000000000a2';
const OWNER_ID = '00000000-0000-4000-a000-0000000000a3';
const MEMBER_ID = '00000000-0000-4000-a000-0000000000a4';
const GROUP_ID = '00000000-0000-4000-a000-0000000000a5';

let authorizeCalls = 0;
let authorizeAllowed = true;
let subject: { userId: string; groupIds: string[] } | null = null;
/** appId -> grants, consulted only for `restricted` Apps. */
let grantRows: Array<{ appId: string; principalType: string; principalId: string }> = [];
let grantQueries = 0;

mock.module('../iam', () => ({
  PROJECT_ACTIONS: { PROJECT_READ: 'project.read' },
  authorize: async () => {
    authorizeCalls += 1;
    return authorizeAllowed
      ? { allowed: true, reason: 'project_role' }
      : { allowed: false, reason: 'not_a_member' };
  },
}));

mock.module('../connectors/share', () => ({
  resolveShareSubject: async () => subject,
}));

// Minimal chainable stand-in for the one query the filter makes.
mock.module('../shared/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: async () => {
          grantQueries += 1;
          return grantRows;
        },
      }),
    }),
  },
}));

const { filterAppsAccessibleToUser } = await import('./access');

function app(appId: string, accessMode: string, createdBy: string | null = OWNER_ID) {
  return { appId, accountId: ACCOUNT_ID, projectId: PROJECT_ID, accessMode, createdBy };
}

function reset(as: { allowed?: boolean; who?: 'owner' | 'member' | null } = {}) {
  authorizeCalls = 0;
  grantQueries = 0;
  grantRows = [];
  authorizeAllowed = as.allowed ?? true;
  const who = as.who === undefined ? 'member' : as.who;
  subject =
    who === 'owner'
      ? { userId: OWNER_ID, groupIds: [] }
      : who === 'member'
        ? { userId: MEMBER_ID, groupIds: [GROUP_ID] }
        : null;
}

describe('filterAppsAccessibleToUser', () => {
  test('hides private Apps owned by someone else, keeps the ones you own', async () => {
    reset({ who: 'member' });
    const rows = [app('a-private-other', 'private', OWNER_ID), app('a-private-mine', 'private', MEMBER_ID)];

    const visible = await filterAppsAccessibleToUser(rows, MEMBER_ID);

    expect(visible.map((a) => a.appId)).toEqual(['a-private-mine']);
  });

  test('hides restricted Apps you hold no grant for, keeps member and group grants', async () => {
    reset({ who: 'member' });
    grantRows = [
      { appId: 'a-by-member', principalType: 'member', principalId: MEMBER_ID },
      { appId: 'a-by-group', principalType: 'group', principalId: GROUP_ID },
      { appId: 'a-other', principalType: 'member', principalId: OWNER_ID },
    ];
    const rows = [app('a-by-member', 'restricted'), app('a-by-group', 'restricted'), app('a-other', 'restricted')];

    const visible = await filterAppsAccessibleToUser(rows, MEMBER_ID);

    expect(visible.map((a) => a.appId)).toEqual(['a-by-member', 'a-by-group']);
  });

  test('keeps project and public Apps, drops password-only ones', async () => {
    reset({ who: 'member' });
    const rows = [app('a-project', 'project'), app('a-public', 'public'), app('a-password', 'password')];

    const visible = await filterAppsAccessibleToUser(rows, MEMBER_ID);

    // `password` is not a Kortix-identity grant — the holder authenticates at
    // the App itself, so it must not appear in an authenticated project list.
    expect(visible.map((a) => a.appId)).toEqual(['a-project', 'a-public']);
  });

  test('returns nothing when the caller cannot read the project at all', async () => {
    reset({ allowed: false, who: 'member' });

    const visible = await filterAppsAccessibleToUser([app('a', 'public')], MEMBER_ID);

    expect(visible).toEqual([]);
  });

  // The batching IS the contract: `appAccessibleToUser` resolves project
  // authorization and the share subject per call, so filtering 30 Apps the
  // naive way cost 30 authorize() round-trips to render one page.
  test('pays ONE authorization round-trip regardless of how many Apps there are', async () => {
    reset({ who: 'member' });
    const rows = Array.from({ length: 30 }, (_, i) => app(`a-${i}`, 'project'));

    const visible = await filterAppsAccessibleToUser(rows, MEMBER_ID);

    expect(visible).toHaveLength(30);
    expect(authorizeCalls).toBe(1);
  });

  test('loads grants only when a restricted App is present', async () => {
    reset({ who: 'member' });
    await filterAppsAccessibleToUser([app('a', 'project'), app('b', 'public')], MEMBER_ID);
    expect(grantQueries).toBe(0);

    reset({ who: 'member' });
    await filterAppsAccessibleToUser([app('a', 'project'), app('c', 'restricted')], MEMBER_ID);
    expect(grantQueries).toBe(1);
  });

  test('an empty list short-circuits without touching iam or the database', async () => {
    reset({ who: 'member' });

    expect(await filterAppsAccessibleToUser([], MEMBER_ID)).toEqual([]);
    expect(authorizeCalls).toBe(0);
    expect(grantQueries).toBe(0);
  });

  test('an unresolvable subject sees only public Apps', async () => {
    reset({ who: null });
    const rows = [app('a-public', 'public'), app('a-project', 'project'), app('a-private', 'private', MEMBER_ID)];

    const visible = await filterAppsAccessibleToUser(rows, MEMBER_ID);

    expect(visible.map((a) => a.appId)).toEqual(['a-public']);
  });
});
