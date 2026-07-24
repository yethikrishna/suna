import type {
  ConnectionProfileCredentialInput,
  OAuth2ClientCredentials,
} from '@kortix/sdk/projects-client';

export interface OAuth2CredentialForm {
  tokenUrl: string;
  clientId: string;
  authMethod: OAuth2ClientCredentials['token_endpoint_auth_method'];
  clientSecret: string;
  privateKey: string;
  certificateThumbprint: string;
  scopes: string;
  resource: string;
  audience: string;
}

export const EMPTY_OAUTH2_CREDENTIAL_FORM: OAuth2CredentialForm = {
  tokenUrl: '',
  clientId: '',
  authMethod: 'client_secret_post',
  clientSecret: '',
  privateKey: '',
  certificateThumbprint: '',
  scopes: '',
  resource: '',
  audience: '',
};

export function buildOAuth2CredentialInput(
  form: OAuth2CredentialForm,
): ConnectionProfileCredentialInput {
  const oauth2: OAuth2ClientCredentials = {
    type: 'oauth2_client_credentials',
    token_url: form.tokenUrl.trim(),
    client_id: form.clientId.trim(),
    token_endpoint_auth_method: form.authMethod,
  };
  if (form.authMethod === 'private_key_jwt') {
    oauth2.private_key = form.privateKey;
    oauth2.certificate_thumbprint = form.certificateThumbprint.trim();
  } else {
    oauth2.client_secret = form.clientSecret;
  }
  const scopes = form.scopes.split(/\s+/).filter(Boolean);
  if (scopes.length) oauth2.scopes = scopes;
  if (form.resource.trim()) oauth2.resource = form.resource.trim();
  if (form.audience.trim()) oauth2.audience = form.audience.trim();
  return { oauth2 };
}
