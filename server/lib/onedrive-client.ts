import { Client } from '@microsoft/microsoft-graph-client';

interface TokenCache {
  access_token: string;
  expires_at: number; // Unix timestamp in ms
}

let tokenCache: TokenCache | null = null;

async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 5-min buffer)
  if (tokenCache && tokenCache.expires_at > Date.now() + 5 * 60 * 1000) {
    return tokenCache.access_token;
  }

  const tenantId = process.env.MICROSOFT_TENANT_ID;
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error(
      'Missing Microsoft OAuth2 configuration. Set MICROSOFT_TENANT_ID, MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET environment variables.'
    );
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Could not read error response');
    console.error('❌ OAuth2 token request failed:', response.status, errorText.substring(0, 200));
    throw new Error(`OAuth2 token request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (!data.access_token || typeof data.expires_in !== 'number') {
    throw new Error('Invalid OAuth2 token response: missing access_token or expires_in');
  }

  tokenCache = {
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in * 1000),
  };

  console.log('✅ Microsoft Graph access token retrieved successfully');
  return data.access_token;
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
// Always call this function again to get a fresh client.
export async function getUncachableOneDriveClient() {
  const accessToken = await getAccessToken();

  return Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => accessToken
    }
  });
}
