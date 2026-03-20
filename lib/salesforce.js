// Salesforce REST API Client — OAuth Refresh Token Flow
// Works on Vercel (serverless), no SF CLI needed

const SF_TOKEN_URL = 'https://login.salesforce.com/services/oauth2/token';
const API_VERSION = 'v62.0';

let cachedAuth = null;
let cacheTime = 0;
const CACHE_TTL = 55 * 60 * 1000; // 55 minutes

async function authenticate() {
  const now = Date.now();
  if (cachedAuth && (now - cacheTime) < CACHE_TTL) {
    return cachedAuth;
  }

  const clientId = process.env.SF_CLIENT_ID;
  const refreshToken = process.env.SF_REFRESH_TOKEN;

  if (!clientId || !refreshToken) {
    throw new Error('Missing SF_CLIENT_ID or SF_REFRESH_TOKEN environment variables');
  }

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    refresh_token: refreshToken,
  });

  const res = await fetch(SF_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Salesforce auth failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  cachedAuth = {
    accessToken: data.access_token,
    instanceUrl: data.instance_url || process.env.SF_INSTANCE_URL || 'https://steelheartsincorporated.my.salesforce.com',
  };
  cacheTime = now;
  return cachedAuth;
}

function clearAuthCache() {
  cachedAuth = null;
  cacheTime = 0;
}

async function sfFetch(path, options = {}) {
  let auth = await authenticate();
  let url = `${auth.instanceUrl}${path}`;

  let res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${auth.accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  // Auto-refresh on 401
  if (res.status === 401) {
    clearAuthCache();
    auth = await authenticate();
    url = `${auth.instanceUrl}${path}`;
    res = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${auth.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  }

  return res;
}

export async function sfQuery(soql) {
  const encoded = encodeURIComponent(soql);
  let allRecords = [];
  let nextUrl = `/services/data/${API_VERSION}/query?q=${encoded}`;

  while (nextUrl) {
    const res = await sfFetch(nextUrl);
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`SOQL query failed (${res.status}): ${err}`);
    }
    const data = await res.json();
    allRecords = allRecords.concat(data.records || []);
    nextUrl = data.nextRecordsUrl || null;
  }

  return allRecords;
}

export async function sfCreate(objectName, data) {
  const res = await sfFetch(`/services/data/${API_VERSION}/sobjects/${objectName}`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Create ${objectName} failed (${res.status}): ${err}`);
  }
  return res.json();
}

export async function sfUpdate(objectName, id, data) {
  const res = await sfFetch(`/services/data/${API_VERSION}/sobjects/${objectName}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  if (res.status !== 204 && !res.ok) {
    const err = await res.text();
    throw new Error(`Update ${objectName}/${id} failed (${res.status}): ${err}`);
  }
  return true;
}

export async function sfDelete(objectName, id) {
  const res = await sfFetch(`/services/data/${API_VERSION}/sobjects/${objectName}/${id}`, {
    method: 'DELETE',
  });
  if (res.status !== 204 && !res.ok) {
    const err = await res.text();
    throw new Error(`Delete ${objectName}/${id} failed (${res.status}): ${err}`);
  }
  return true;
}

export async function sfDescribe(objectName) {
  const res = await sfFetch(`/services/data/${API_VERSION}/sobjects/${objectName}/describe`);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Describe ${objectName} failed (${res.status}): ${err}`);
  }
  return res.json();
}

export { authenticate };
