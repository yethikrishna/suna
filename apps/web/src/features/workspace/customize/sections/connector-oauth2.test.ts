import { describe, expect, test } from 'bun:test';
import { buildOAuth2CredentialInput } from './connector-oauth2';

describe('buildOAuth2CredentialInput', () => {
  test('normalizes a Microsoft client-secret configuration', () => {
    expect(
      buildOAuth2CredentialInput({
        tokenUrl: ' https://login.microsoftonline.com/tenant/oauth2/v2.0/token ',
        clientId: ' client-id ',
        authMethod: 'client_secret_post',
        clientSecret: 'client-secret',
        privateKey: '',
        certificateThumbprint: '',
        scopes: 'https://graph.microsoft.com/.default\nopenid  profile',
        resource: '',
        audience: '',
      }),
    ).toEqual({
      oauth2: {
        type: 'oauth2_client_credentials',
        token_url: 'https://login.microsoftonline.com/tenant/oauth2/v2.0/token',
        client_id: 'client-id',
        token_endpoint_auth_method: 'client_secret_post',
        client_secret: 'client-secret',
        scopes: ['https://graph.microsoft.com/.default', 'openid', 'profile'],
      },
    });
  });

  test('builds a certificate assertion configuration without secret fields', () => {
    const result = buildOAuth2CredentialInput({
      tokenUrl: 'https://login.example.com/token',
      clientId: 'client-id',
      authMethod: 'private_key_jwt',
      clientSecret: '',
      privateKey: 'private-key',
      certificateThumbprint: 'thumbprint',
      scopes: '',
      resource: 'https://tenant.sharepoint.com',
      audience: 'https://api.example.com',
    });

    expect(result).toEqual({
      oauth2: {
        type: 'oauth2_client_credentials',
        token_url: 'https://login.example.com/token',
        client_id: 'client-id',
        token_endpoint_auth_method: 'private_key_jwt',
        private_key: 'private-key',
        certificate_thumbprint: 'thumbprint',
        resource: 'https://tenant.sharepoint.com',
        audience: 'https://api.example.com',
      },
    });
  });
});
