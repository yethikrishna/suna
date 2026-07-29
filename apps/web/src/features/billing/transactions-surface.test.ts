import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const webSource = join(import.meta.dir, '../..');
const transactionsTabPath = join(webSource, 'features/accounts/settings/transactions-tab.tsx');
const accountPagePath = join(webSource, 'app/(app)/accounts/[id]/page.tsx');

describe('account credit transactions surface', () => {
  test('renders only the credit ledger', () => {
    const source = readFileSync(transactionsTabPath, 'utf8');

    expect(source).toContain('<CreditTransactions />');
    expect(source.match(/^import /gm)).toHaveLength(1);
    expect(source.match(/<[A-Z][A-Za-z]+ \/>/g)).toEqual(['<CreditTransactions />']);
  });

  test('describes the complete account credit ledger', () => {
    const source = readFileSync(accountPagePath, 'utf8');

    expect(source).toContain(
      'Credit ledger for this account, including grants, purchases, usage, refunds, and adjustments.',
    );
  });
});
