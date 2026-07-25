import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(join(import.meta.dir, 'project-create-modal.tsx'), 'utf8');

describe('new project git provider default', () => {
  test('starts with a managed repository and keeps user GitHub explicit', () => {
    expect(source).toContain("'github-create' | 'github-import' | 'managed' | 'template'");
    expect(source).toMatch(/useState<[\s\S]*?>\(\s*'managed'/);
    expect(source).toContain('createProjectRepo');
    expect(source).toContain('Create in your GitHub');
    expect(source).not.toContain('Code Storage');
    expect(source).not.toMatch(/<GitFork className="size-4" \/> Managed by Kortix/);
  });

  test('keeps a selected marketplace template on the managed path', () => {
    expect(source).toMatch(/function pickTemplate[\s\S]*?setMode\('managed'\)/);
  });

  test('uses current project-modal list and radius primitives', () => {
    expect(source).not.toContain('@/components/ui/list');
    expect(source).not.toContain('rounded-2xl');
  });

  test('does not mistake the managed PAT import fallback for a GitHub App installation', () => {
    expect(source).toContain('isGitHubAppInstallationId');
    expect(source).toContain('githubAppInstallations');
    expect(source).toContain('installation_id: selectedInstallationId');
  });

  test('searches large GitHub owners remotely and exposes repository load failures', () => {
    expect(source).toContain('useDebounce(repositorySearch.trim(), 300)');
    expect(source).toContain("search: debouncedRepositorySearch || undefined");
    expect(source).toContain('onSearchChange={setRepositorySearch}');
    expect(source).toContain('githubReposQuery.isError');
    expect(source).toContain('Could not load repositories');
    expect(source).toContain('githubReposQuery.refetch()');
  });

  test('explains how to link an existing GitHub App installation', () => {
    expect(source).toContain('Link a GitHub account');
    expect(source).toContain(
      'Select Configure in GitHub when the Kortix App is already installed.',
    );
    expect(source).toContain("isConnectingGitHub ? 'Connecting' : 'Link GitHub'");
  });
});

describe('new project dialog: simplified default state', () => {
  test('repository source starts collapsed behind a disclosure, not shown up front', () => {
    // The 3-way tabs live inside DisclosureContent, gated by `advancedOpen`
    // (default false) — never rendered open on mount.
    expect(source).toMatch(/const \[advancedOpen, setAdvancedOpen\] = useState\(false\)/);
    expect(source).toContain('<DisclosureTrigger>');
    expect(source).toContain('<DisclosureContent>');
    expect(source).toContain("'Hide repository options' : 'Use my own GitHub'");
    // The tabs render inside DisclosureContent, not as a direct sibling of
    // the trigger row — so they stay collapsed until the trigger is opened.
    expect(source).toMatch(
      /<DisclosureContent>[\s\S]*?<Label>Repository source<\/Label>[\s\S]*?<\/DisclosureContent>/,
    );
  });

  test('reopens the repository picker automatically once the user leaves the managed default', () => {
    expect(source).toContain(
      "const repositoryOptionsOpen = advancedOpen || mode !== 'managed' || managedGitUnavailable;",
    );
  });

  test('resets the disclosure back to collapsed when the modal closes', () => {
    expect(source).toMatch(/function resetAndClose\(\)[\s\S]*?setAdvancedOpen\(false\)/);
  });

  test('removes the duplicated "Managed repository" and "Starter skills" cards', () => {
    expect(source).not.toContain('Managed repository');
    expect(source).not.toContain('Starter skills');
    expect(source).not.toContain('Starter pack');
    expect(source).not.toContain('Kortix creates a private repository and manages its credentials.');
  });

  test('the account switcher only renders when there is more than one account to choose from', () => {
    expect(source).toMatch(
      /accountSelection\.canSwitch && accountSelection\.currentAccount \? \(\s*<CreateAccountField/,
    );
  });
});
