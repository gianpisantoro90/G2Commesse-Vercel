import { Client } from '@microsoft/microsoft-graph-client';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const hasReplIdentity = !!process.env.REPL_IDENTITY;
  const hasWebReplRenewal = !!process.env.WEB_REPL_RENEWAL;
  
  console.log('🔍 OneDrive connection diagnostics:');
  console.log('   - REPLIT_CONNECTORS_HOSTNAME:', hostname ? '✅ present' : '❌ missing');
  console.log('   - REPL_IDENTITY:', hasReplIdentity ? '✅ present (development mode)' : '❌ missing');
  console.log('   - WEB_REPL_RENEWAL:', hasWebReplRenewal ? '✅ present (production mode)' : '❌ missing');
  
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    console.error('❌ Missing authentication token for Replit Connectors');
    console.error('   This means neither REPL_IDENTITY nor WEB_REPL_RENEWAL are set.');
    console.error('   OneDrive integration requires one of these environment variables.');
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }
  
  if (!hostname) {
    console.error('❌ REPLIT_CONNECTORS_HOSTNAME is not set');
    console.error('   This environment variable is required to connect to Replit Connectors API');
    throw new Error('REPLIT_CONNECTORS_HOSTNAME not found');
  }

  const tokenType = hasReplIdentity ? 'development (REPL_IDENTITY)' : 'production (WEB_REPL_RENEWAL)';
  console.log(`   - Using ${tokenType} token`);
  console.log(`   - Connecting to: https://${hostname}/api/v2/connection`);

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
    
    console.log(`   - Response status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Could not read error response');
      console.error(`   - Error response body: ${errorText.substring(0, 200)}`);
      throw new Error(`Failed to fetch connection: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    connectionSettings = data.items?.[0];
    
    console.log('🔍 Connection response received (sensitive data redacted for security)');
    console.log('🔍 Connection settings obtained (access token redacted for security)');
    
  } catch (error) {
    console.error('❌ Error fetching connection:', error);
    throw error;
  }

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings?.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    console.error('❌ No connection settings or access token found');
    throw new Error('OneDrive not connected');
  }
  
  console.log('✅ OneDrive access token retrieved successfully');
  return accessToken;
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