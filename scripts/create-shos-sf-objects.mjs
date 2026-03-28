/**
 * Creates SHOS_Knowledge__c and SHOS_Friction__c in Salesforce
 * using the Metadata API deploy (ZIP + XML).
 *
 * Run: node scripts/create-shos-sf-objects.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { deflateRawSync, crc32 } from "zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local
const envPath = join(__dirname, "../.env.local");
const envContent = readFileSync(envPath, "utf8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const idx = trimmed.indexOf("=");
  if (idx === -1) continue;
  process.env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
}

const SF_TOKEN_URL = "https://login.salesforce.com/services/oauth2/token";
const API_VERSION = "62.0";

async function authenticate() {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: process.env.SF_CLIENT_ID,
    refresh_token: process.env.SF_REFRESH_TOKEN,
  });
  const res = await fetch(SF_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) throw new Error(`Auth failed: ${await res.text()}`);
  const data = await res.json();
  return {
    accessToken: data.access_token,
    instanceUrl: data.instance_url || process.env.SF_INSTANCE_URL,
  };
}

// ---------------------------------------------------------------------------
// Metadata XML definitions
// ---------------------------------------------------------------------------

const KNOWLEDGE_OBJECT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>SHOS Knowledge</label>
    <pluralLabel>SHOS Knowledge</pluralLabel>
    <nameField>
        <type>AutoNumber</type>
        <label>Knowledge Name</label>
        <displayFormat>KNOW-{0000}</displayFormat>
        <startingNumber>1</startingNumber>
    </nameField>
    <deploymentStatus>Deployed</deploymentStatus>
    <sharingModel>ReadWrite</sharingModel>
    <enableActivities>false</enableActivities>
    <enableHistory>false</enableHistory>
    <enableReports>true</enableReports>
    <enableSearch>true</enableSearch>
    <fields>
        <fullName>Role__c</fullName>
        <label>Role</label>
        <type>Picklist</type>
        <valueSet>
            <valueSetDefinition>
                <sorted>false</sorted>
                <value><fullName>ed</fullName><label>ed</label><default>false</default></value>
                <value><fullName>cos</fullName><label>cos</label><default>false</default></value>
                <value><fullName>cfo</fullName><label>cfo</label><default>false</default></value>
                <value><fullName>coo</fullName><label>coo</label><default>false</default></value>
                <value><fullName>comms</fullName><label>comms</label><default>false</default></value>
                <value><fullName>dev</fullName><label>dev</label><default>false</default></value>
                <value><fullName>family</fullName><label>family</label><default>false</default></value>
            </valueSetDefinition>
        </valueSet>
    </fields>
    <fields>
        <fullName>Content__c</fullName>
        <label>Content</label>
        <type>LongTextArea</type>
        <length>131072</length>
        <visibleLines>10</visibleLines>
    </fields>
    <fields>
        <fullName>Last_Updated__c</fullName>
        <label>Last Updated</label>
        <type>DateTime</type>
    </fields>
    <fields>
        <fullName>Session_Count__c</fullName>
        <label>Session Count</label>
        <type>Number</type>
        <precision>4</precision>
        <scale>0</scale>
    </fields>
</CustomObject>`;

const FRICTION_OBJECT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>SHOS Friction</label>
    <pluralLabel>SHOS Friction</pluralLabel>
    <nameField>
        <type>AutoNumber</type>
        <label>Friction Name</label>
        <displayFormat>FRIC-{0000}</displayFormat>
        <startingNumber>1</startingNumber>
    </nameField>
    <deploymentStatus>Deployed</deploymentStatus>
    <sharingModel>ReadWrite</sharingModel>
    <enableActivities>false</enableActivities>
    <enableHistory>false</enableHistory>
    <enableReports>true</enableReports>
    <enableSearch>true</enableSearch>
    <fields>
        <fullName>Role__c</fullName>
        <label>Role</label>
        <type>Picklist</type>
        <valueSet>
            <valueSetDefinition>
                <sorted>false</sorted>
                <value><fullName>ed</fullName><label>ed</label><default>false</default></value>
                <value><fullName>cos</fullName><label>cos</label><default>false</default></value>
                <value><fullName>cfo</fullName><label>cfo</label><default>false</default></value>
                <value><fullName>coo</fullName><label>coo</label><default>false</default></value>
                <value><fullName>comms</fullName><label>comms</label><default>false</default></value>
                <value><fullName>dev</fullName><label>dev</label><default>false</default></value>
                <value><fullName>family</fullName><label>family</label><default>false</default></value>
            </valueSetDefinition>
        </valueSet>
    </fields>
    <fields>
        <fullName>Type__c</fullName>
        <label>Type</label>
        <type>Picklist</type>
        <valueSet>
            <valueSetDefinition>
                <sorted>false</sorted>
                <value><fullName>bug</fullName><label>bug</label><default>false</default></value>
                <value><fullName>missing</fullName><label>missing</label><default>false</default></value>
                <value><fullName>improvement</fullName><label>improvement</label><default>false</default></value>
                <value><fullName>idea</fullName><label>idea</label><default>false</default></value>
            </valueSetDefinition>
        </valueSet>
    </fields>
    <fields>
        <fullName>Priority__c</fullName>
        <label>Priority</label>
        <type>Picklist</type>
        <valueSet>
            <valueSetDefinition>
                <sorted>false</sorted>
                <value><fullName>high</fullName><label>high</label><default>false</default></value>
                <value><fullName>medium</fullName><label>medium</label><default>false</default></value>
                <value><fullName>low</fullName><label>low</label><default>false</default></value>
            </valueSetDefinition>
        </valueSet>
    </fields>
    <fields>
        <fullName>Description__c</fullName>
        <label>Description</label>
        <type>LongTextArea</type>
        <length>32768</length>
        <visibleLines>5</visibleLines>
    </fields>
    <fields>
        <fullName>Status__c</fullName>
        <label>Status</label>
        <type>Picklist</type>
        <valueSet>
            <valueSetDefinition>
                <sorted>false</sorted>
                <value><fullName>open</fullName><label>open</label><default>true</default></value>
                <value><fullName>triaged</fullName><label>triaged</label><default>false</default></value>
                <value><fullName>queued</fullName><label>queued</label><default>false</default></value>
                <value><fullName>done</fullName><label>done</label><default>false</default></value>
            </valueSetDefinition>
        </valueSet>
    </fields>
    <fields>
        <fullName>Logged_Date__c</fullName>
        <label>Logged Date</label>
        <type>Date</type>
    </fields>
</CustomObject>`;

const PACKAGE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <members>SHOS_Knowledge__c</members>
        <members>SHOS_Friction__c</members>
        <name>CustomObject</name>
    </types>
    <types>
        <members>SHOS_Knowledge__c.Role__c</members>
        <members>SHOS_Knowledge__c.Content__c</members>
        <members>SHOS_Knowledge__c.Last_Updated__c</members>
        <members>SHOS_Knowledge__c.Session_Count__c</members>
        <members>SHOS_Friction__c.Role__c</members>
        <members>SHOS_Friction__c.Type__c</members>
        <members>SHOS_Friction__c.Priority__c</members>
        <members>SHOS_Friction__c.Description__c</members>
        <members>SHOS_Friction__c.Status__c</members>
        <members>SHOS_Friction__c.Logged_Date__c</members>
        <name>CustomField</name>
    </types>
    <version>${API_VERSION}</version>
</Package>`;

// ---------------------------------------------------------------------------
// Minimal ZIP builder (forward slashes, no external deps)
// ---------------------------------------------------------------------------

function buildZip(files) {
  // files: [{ name: "objects/Foo.object", data: Buffer }]
  const enc = new TextEncoder();
  const localHeaders = [];
  const centralDirs = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = Buffer.from(file.name, "utf8");
    const compressed = deflateRawSync(file.data, { level: 6 });
    const crc = crc32(file.data);
    const modTime = 0x0000;
    const modDate = 0x0000;

    // Local file header
    const lhSize = 30 + nameBytes.length;
    const lh = Buffer.alloc(lhSize);
    lh.writeUInt32LE(0x04034b50, 0);    // signature
    lh.writeUInt16LE(20, 4);             // version needed
    lh.writeUInt16LE(0, 6);              // flags
    lh.writeUInt16LE(8, 8);              // deflate
    lh.writeUInt16LE(modTime, 10);
    lh.writeUInt16LE(modDate, 12);
    lh.writeUInt32LE(crc >>> 0, 14);
    lh.writeUInt32LE(compressed.length, 18);
    lh.writeUInt32LE(file.data.length, 22);
    lh.writeUInt16LE(nameBytes.length, 26);
    lh.writeUInt16LE(0, 28);
    nameBytes.copy(lh, 30);

    localHeaders.push(Buffer.concat([lh, compressed]));

    // Central directory entry
    const cdSize = 46 + nameBytes.length;
    const cd = Buffer.alloc(cdSize);
    cd.writeUInt32LE(0x02014b50, 0);    // signature
    cd.writeUInt16LE(20, 4);             // version made by
    cd.writeUInt16LE(20, 6);             // version needed
    cd.writeUInt16LE(0, 8);              // flags
    cd.writeUInt16LE(8, 10);             // deflate
    cd.writeUInt16LE(modTime, 12);
    cd.writeUInt16LE(modDate, 14);
    cd.writeUInt32LE(crc >>> 0, 16);
    cd.writeUInt32LE(compressed.length, 20);
    cd.writeUInt32LE(file.data.length, 24);
    cd.writeUInt16LE(nameBytes.length, 28);
    cd.writeUInt16LE(0, 30);             // extra
    cd.writeUInt16LE(0, 32);             // comment
    cd.writeUInt16LE(0, 34);             // disk start
    cd.writeUInt16LE(0, 36);             // internal attr
    cd.writeUInt32LE(0, 38);             // external attr
    cd.writeUInt32LE(offset, 42);        // local header offset
    nameBytes.copy(cd, 46);

    centralDirs.push(cd);
    offset += lhSize + compressed.length;
  }

  const cdOffset = offset;
  const cdBuffer = Buffer.concat(centralDirs);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);   // signature
  eocd.writeUInt16LE(0, 4);             // disk number
  eocd.writeUInt16LE(0, 6);             // cd start disk
  eocd.writeUInt16LE(files.length, 8);  // entries on disk
  eocd.writeUInt16LE(files.length, 10); // total entries
  eocd.writeUInt32LE(cdBuffer.length, 12);
  eocd.writeUInt32LE(cdOffset, 16);
  eocd.writeUInt16LE(0, 20);            // comment length

  return Buffer.concat([...localHeaders, cdBuffer, eocd]);
}

// ---------------------------------------------------------------------------
// Deploy via Metadata API
// ---------------------------------------------------------------------------

async function deployMetadata(auth, zipBuffer) {
  const zipBase64 = zipBuffer.toString("base64");
  const soapUrl = `${auth.instanceUrl}/services/Soap/m/${API_VERSION}`;

  // SOAP deploy request
  const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:met="http://soap.sforce.com/2006/04/metadata">
  <soapenv:Header>
    <met:CallOptions><met:client>SHOSDeploy</met:client></met:CallOptions>
    <met:SessionHeader><met:sessionId>${auth.accessToken}</met:sessionId></met:SessionHeader>
  </soapenv:Header>
  <soapenv:Body>
    <met:deploy>
      <met:ZipFile>${zipBase64}</met:ZipFile>
      <met:DeployOptions>
        <met:allowMissingFiles>false</met:allowMissingFiles>
        <met:autoUpdatePackage>false</met:autoUpdatePackage>
        <met:checkOnly>false</met:checkOnly>
        <met:ignoreWarnings>true</met:ignoreWarnings>
        <met:performRetrieve>false</met:performRetrieve>
        <met:purgeOnDelete>false</met:purgeOnDelete>
        <met:rollbackOnError>true</met:rollbackOnError>
        <met:singlePackage>true</met:singlePackage>
        <met:testLevel>RunLocalTests</met:testLevel>
      </met:DeployOptions>
    </met:deploy>
  </soapenv:Body>
</soapenv:Envelope>`;

  const res = await fetch(soapUrl, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml",
      SOAPAction: '""',
    },
    body: soapBody,
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`Deploy SOAP call failed (${res.status}): ${text}`);

  // Extract asyncProcessId from response
  const idMatch = text.match(/<id>([^<]+)<\/id>/);
  if (!idMatch) throw new Error(`No deploy ID in response: ${text.slice(0, 500)}`);
  const deployId = idMatch[1];
  console.log(`  Deploy started (id: ${deployId})`);

  // Poll checkDeployStatus
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 3000));

    const pollBody = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:met="http://soap.sforce.com/2006/04/metadata">
  <soapenv:Header>
    <met:SessionHeader><met:sessionId>${auth.accessToken}</met:sessionId></met:SessionHeader>
  </soapenv:Header>
  <soapenv:Body>
    <met:checkDeployStatus>
      <met:asyncProcessId>${deployId}</met:asyncProcessId>
      <met:includeDetails>true</met:includeDetails>
    </met:checkDeployStatus>
  </soapenv:Body>
</soapenv:Envelope>`;

    const pollRes = await fetch(soapUrl, {
      method: "POST",
      headers: { "Content-Type": "text/xml", SOAPAction: '""' },
      body: pollBody,
    });

    const pollText = await pollRes.text();
    const statusMatch = pollText.match(/<status>([^<]+)<\/status>/);
    const doneMatch = pollText.match(/<done>([^<]+)<\/done>/);
    const successMatch = pollText.match(/<success>([^<]+)<\/success>/);
    const deployedMatch = pollText.match(/<numberComponentsDeployed>([^<]+)<\/numberComponentsDeployed>/);
    const totalMatch = pollText.match(/<numberComponentsTotal>([^<]+)<\/numberComponentsTotal>/);

    const status = statusMatch?.[1] || "Unknown";
    const done = doneMatch?.[1] === "true";
    const success = successMatch?.[1] === "true";
    const deployed = deployedMatch?.[1] || "0";
    const total = totalMatch?.[1] || "?";

    console.log(`  Status: ${status} (${deployed}/${total} components)`);

    if (done) {
      if (success) return { numberComponentsDeployed: deployed };
      // Extract errors
      const errMatches = [...pollText.matchAll(/<problem>([^<]+)<\/problem>/g)];
      const errNames = [...pollText.matchAll(/<fullName>([^<]+)<\/fullName>/g)];
      const msgs = errMatches.map((m, i) => `${errNames[i]?.[1] || "?"}: ${m[1]}`).join("\n  ");
      throw new Error(`Deploy failed:\n  ${msgs || pollText.slice(0, 500)}`);
    }
  }

  throw new Error("Deploy timed out");
}

async function main() {
  console.log("Authenticating with Salesforce...");
  const auth = await authenticate();
  console.log(`✓ Connected to ${auth.instanceUrl}\n`);

  console.log("Creating deploy package...");

  // Build ZIP with forward slashes (required by Salesforce)
  const zipBuffer = buildZip([
    { name: "package.xml",                          data: Buffer.from(PACKAGE_XML, "utf8") },
    { name: "objects/SHOS_Knowledge__c.object",     data: Buffer.from(KNOWLEDGE_OBJECT_XML, "utf8") },
    { name: "objects/SHOS_Friction__c.object",      data: Buffer.from(FRICTION_OBJECT_XML, "utf8") },
  ]);

  console.log(`Package size: ${(zipBuffer.length / 1024).toFixed(1)} KB`);
  console.log("\nDeploying to Salesforce...");

  const result = await deployMetadata(auth, zipBuffer);

  console.log("\n✓ Deploy complete!");
  console.log(`  Components deployed: ${result.numberComponentsDeployed}`);
  console.log("  SHOS_Knowledge__c — knowledge file storage for all 7 roles");
  console.log("  SHOS_Friction__c  — friction log entries from role agents");
}

main().catch((e) => {
  console.error("\n✗ Failed:", e.message);
  process.exit(1);
});
