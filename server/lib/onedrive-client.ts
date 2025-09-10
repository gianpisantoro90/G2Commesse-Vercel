import { Client } from '@microsoft/microsoft-graph-client';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.CONNECTORS_HOSTNAME
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  console.log('🔍 OneDrive Environment Check (Server):', {
    hasHostname: !!hostname,
    hasReplIdentity: !!process.env.REPL_IDENTITY,
    hasWebReplRenewal: !!process.env.WEB_REPL_RENEWAL,
    hasToken: !!xReplitToken
  });

  if (!xReplitToken) {
    throw new Error('OneDrive integration requires Replit environment variables. This may not work in local development.');
  }

  try {
    const response = await fetch(
      'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=onedrive',
      {
        headers: {
          'Accept': 'application/json',
          'X_REPLIT_TOKEN': xReplitToken
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Connection API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    connectionSettings = data.items?.[0];

    console.log('🔍 OneDrive Connection Data (Server):', {
      hasData: !!data,
      itemsCount: data.items?.length || 0,
      hasConnection: !!connectionSettings,
      connectionStatus: connectionSettings?.status
    });

    const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

    if (!connectionSettings || !accessToken) {
      throw new Error('OneDrive not connected. Please check your OneDrive integration in the project settings.');
    }
    return accessToken;
  } catch (error) {
    console.error('❌ OneDrive connection error (Server):', error);
    throw error;
  }
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