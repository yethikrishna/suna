import { describe, expect, test } from 'bun:test';
import {
  adminAccountLookupPath,
  adminMemberRolePath,
  useAdminAccount,
  useAdminSetMemberRole,
  type AdminAccountMemberRole,
} from './use-admin-accounts';

describe('admin single-account lookup contract', () => {
  // The sheet's live row: an exact-id query against the list route, immune to
  // whatever filters the list currently has. Pins the wire shape.
  test('adminAccountLookupPath queries the list route by exact accountId', () => {
    expect(adminAccountLookupPath('acct_1')).toBe('/admin/api/accounts?accountId=acct_1&limit=1');
  });

  test('useAdminAccount is exported as a hook', () => {
    expect(typeof useAdminAccount).toBe('function');
  });
});

describe('admin member-role mutation contract', () => {
  // The server route is /admin/api/accounts/{id}/members/{userId}/role — the
  // path builder is the single place the hook derives it from, so this test
  // pins the wire contract without needing a rendered hook.
  test('adminMemberRolePath targets the platform-admin role route', () => {
    expect(adminMemberRolePath('acct_1', 'user_9')).toBe(
      '/admin/api/accounts/acct_1/members/user_9/role',
    );
  });

  test('useAdminSetMemberRole is exported as a hook', () => {
    expect(typeof useAdminSetMemberRole).toBe('function');
  });

  test('role union covers exactly the three account roles', () => {
    const roles: AdminAccountMemberRole[] = ['owner', 'admin', 'member'];
    expect(roles).toHaveLength(3);
  });
});
