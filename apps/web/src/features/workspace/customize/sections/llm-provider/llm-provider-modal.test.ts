import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const modalSource = readFileSync(join(import.meta.dir, 'llm-provider-modal.tsx'), 'utf8');

describe('LLM provider modal flow', () => {
  test('orders Add provider before Connected and Models', () => {
    const catalog = modalSource.indexOf('<TabsTrigger value="catalog"');
    const connected = modalSource.indexOf('<TabsTrigger value="connected"');
    const models = modalSource.indexOf('<TabsTrigger value="models"');

    expect(catalog).toBeGreaterThan(-1);
    expect(connected).toBeGreaterThan(catalog);
    expect(models).toBeGreaterThan(connected);
  });

  test('renders pending and query-refresh loading states with the shared Loading component', () => {
    expect(modalSource).toContain('pendingProviderId &&');
    expect(modalSource).toContain('secretsQuery.isLoading || secretsQuery.isFetching');
    expect(modalSource).toContain('Connecting {pendingProviderLabel}…');
    expect(modalSource).toContain('<Loading');
  });

  test('uses the compact content-sized modal dimensions', () => {
    expect(modalSource).toContain('max-h-[min(85vh,560px)]');
    expect(modalSource).toContain('max-w-[520px]');
    expect(modalSource).toContain('lg:max-w-[520px]');
    expect(modalSource).toContain('lg:h-auto');
    expect(modalSource).not.toContain('h-[min(80vh,680px)]');
    expect(modalSource).not.toContain('max-w-[600px]');
  });
});
