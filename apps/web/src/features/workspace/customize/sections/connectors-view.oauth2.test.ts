import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = import.meta.dir;
const connectorsSource = readFileSync(join(dir, 'connectors-view.tsx'), 'utf8');
const fieldsSource = readFileSync(join(dir, 'connector-oauth2-fields.tsx'), 'utf8');

describe('Custom connector OAuth2 onboarding', () => {
  test('shows OAuth2 client credentials in the initial Auth selector', () => {
    expect(connectorsSource).toContain('<SelectItem value="oauth2_client_credentials">');
    expect(connectorsSource).toContain('OAuth 2.0 client credentials');
  });

  test('renders the OAuth2 credential fields before connector creation', () => {
    expect(connectorsSource).toContain('oauth2Selected={oauth2Selected}');
    expect(connectorsSource).toContain('idPrefix="new-connector-oauth2"');
    expect(connectorsSource).toContain('createConnectorWithOptionalOAuth2(');
  });

  test('covers every supported token endpoint authentication strategy', () => {
    expect(fieldsSource).toContain('value="client_secret_post"');
    expect(fieldsSource).toContain('value="client_secret_basic"');
    expect(fieldsSource).toContain('value="private_key_jwt"');
  });
});
