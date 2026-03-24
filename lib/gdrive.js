import { google } from "googleapis";

// ---------------------------------------------------------------------------
// Google Drive API client using Google Workspace domain-wide delegation.
// Uses the same service account as Gmail.
//
// Environment variables:
//   GOOGLE_SERVICE_ACCOUNT_EMAIL — the service account email
//   GOOGLE_SERVICE_ACCOUNT_KEY   — the private key (PEM format)
//   GDRIVE_DESIGNS_FOLDER_ID     — shared Drive folder for bracelet designs
// ---------------------------------------------------------------------------

const DESIGNS_FOLDER_ID = process.env.GDRIVE_DESIGNS_FOLDER_ID || "";

/**
 * Build an authenticated Drive client that impersonates a @steel-hearts.org user.
 */
export async function getDriveClient(userEmail = "joseph.wiseman@steel-hearts.org") {
  const serviceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = (process.env.GOOGLE_SERVICE_ACCOUNT_KEY || "").replace(
    /\\n/g,
    "\n"
  );

  if (!serviceEmail || !privateKey) {
    throw new Error(
      "Google service account not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_KEY."
    );
  }

  const auth = new google.auth.JWT({
    email: serviceEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
    subject: userEmail,
  });

  await auth.authorize();
  return google.drive({ version: "v3", auth });
}

/**
 * Upload a design SVG to the shared bracelet designs folder.
 *
 * @param {Buffer|ReadableStream} fileBuffer — the SVG file content
 * @param {string} sku — the bracelet SKU (used as filename)
 * @returns {{ fileId: string, webViewLink: string, webContentLink: string }}
 */
export async function uploadDesignSVG(fileBuffer, sku) {
  if (!DESIGNS_FOLDER_ID) {
    throw new Error("GDRIVE_DESIGNS_FOLDER_ID not configured");
  }

  const drive = await getDriveClient();
  const fileName = `${sku}.svg`;

  // Check if file already exists in folder
  const existing = await drive.files.list({
    q: `name = '${fileName}' and '${DESIGNS_FOLDER_ID}' in parents and trashed = false`,
    fields: "files(id, name)",
  });

  let fileId;

  if (existing.data.files && existing.data.files.length > 0) {
    // Update existing file
    fileId = existing.data.files[0].id;
    await drive.files.update({
      fileId,
      media: {
        mimeType: "image/svg+xml",
        body: fileBuffer,
      },
    });
  } else {
    // Create new file
    const res = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [DESIGNS_FOLDER_ID],
        mimeType: "image/svg+xml",
      },
      media: {
        mimeType: "image/svg+xml",
        body: fileBuffer,
      },
      fields: "id, webViewLink, webContentLink",
    });
    fileId = res.data.id;
  }

  // Make file viewable by anyone with the link
  await drive.permissions.create({
    fileId,
    requestBody: {
      role: "reader",
      type: "anyone",
    },
  });

  // Get the shareable links
  const file = await drive.files.get({
    fileId,
    fields: "id, webViewLink, webContentLink",
  });

  return {
    fileId: file.data.id,
    webViewLink: file.data.webViewLink,
    webContentLink: file.data.webContentLink,
    fileName,
  };
}

/**
 * Get the design SVG URL for a given SKU.
 * Returns null if no design exists.
 */
export async function getDesignURL(sku) {
  if (!DESIGNS_FOLDER_ID) return null;

  try {
    const drive = await getDriveClient();
    const fileName = `${sku}.svg`;

    const res = await drive.files.list({
      q: `name = '${fileName}' and '${DESIGNS_FOLDER_ID}' in parents and trashed = false`,
      fields: "files(id, webViewLink, webContentLink)",
    });

    if (res.data.files && res.data.files.length > 0) {
      return {
        fileId: res.data.files[0].id,
        webViewLink: res.data.files[0].webViewLink,
        webContentLink: res.data.files[0].webContentLink,
      };
    }
    return null;
  } catch (err) {
    console.error("Drive lookup error:", err.message);
    return null;
  }
}

/**
 * List all design SVGs in the shared folder.
 */
export async function listDesigns() {
  if (!DESIGNS_FOLDER_ID) return [];

  try {
    const drive = await getDriveClient();
    const res = await drive.files.list({
      q: `'${DESIGNS_FOLDER_ID}' in parents and trashed = false and mimeType = 'image/svg+xml'`,
      fields: "files(id, name, webViewLink, webContentLink, modifiedTime, size)",
      orderBy: "modifiedTime desc",
      pageSize: 500,
    });

    return (res.data.files || []).map((f) => ({
      fileId: f.id,
      name: f.name,
      sku: f.name.replace(".svg", ""),
      webViewLink: f.webViewLink,
      webContentLink: f.webContentLink,
      modifiedTime: f.modifiedTime,
      size: f.size,
    }));
  } catch (err) {
    console.error("Drive list error:", err.message);
    return [];
  }
}
