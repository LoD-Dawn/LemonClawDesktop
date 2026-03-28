const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_TIMEOUT_MS = Number(process.env.GITEE_REQUEST_TIMEOUT_MS || 180000);
const DEFAULT_RETRIES = Number(process.env.GITEE_REQUEST_RETRIES || 4);
const DEFAULT_RETRY_DELAY_MS = Number(process.env.GITEE_REQUEST_RETRY_DELAY_MS || 5000);

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = 'true';
      continue;
    }

    args[key] = next;
    i += 1;
  }

  return args;
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

async function requestJson(url, options = {}) {
  const response = await fetchWithRetry(url, options);
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(`Request failed (${response.status} ${response.statusText}): ${text}`);
  }

  return data;
}

async function request(url, options = {}) {
  const response = await fetchWithRetry(url, options);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Request failed (${response.status} ${response.statusText}): ${text}`);
  }

  return text;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(error) {
  if (!error) {
    return false;
  }

  return (
    error.name === 'TimeoutError' ||
    error.code === 'UND_ERR_HEADERS_TIMEOUT' ||
    error.code === 'UND_ERR_CONNECT_TIMEOUT' ||
    error.code === 'ECONNRESET' ||
    error.code === 'ETIMEDOUT' ||
    /timeout/i.test(error.message || '')
  );
}

function buildRequestOptions(options = {}) {
  const timeoutMs = Number(options.timeoutMs || DEFAULT_TIMEOUT_MS);
  const { timeoutMs: _timeoutMs, ...rest } = options;
  return {
    ...rest,
    signal: AbortSignal.timeout(timeoutMs),
  };
}

async function fetchWithRetry(url, options = {}) {
  let lastError = null;
  for (let attempt = 1; attempt <= DEFAULT_RETRIES; attempt += 1) {
    try {
      return await fetch(url, buildRequestOptions(options));
    } catch (error) {
      lastError = error;
      if (attempt >= DEFAULT_RETRIES || !isRetryableError(error)) {
        throw error;
      }

      console.warn(
        `[gitee-release] Request attempt ${attempt}/${DEFAULT_RETRIES} failed: ${error.message}. Retrying...`,
      );
      await sleep(DEFAULT_RETRY_DELAY_MS * attempt);
    }
  }

  throw lastError;
}

function collectFiles(rootDir) {
  const files = [];
  const queue = [rootDir];

  while (queue.length > 0) {
    const current = queue.shift();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
        continue;
      }

      if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function shouldUpload(filePath, includeAll) {
  if (includeAll) {
    return true;
  }

  return /\.(exe|dmg|zip|yml|yaml|blockmap|deb|AppImage)$/i.test(filePath);
}

async function getReleaseByTag(apiBase, owner, repo, token, tag) {
  const url = `${apiBase}/repos/${owner}/${repo}/releases/tags/${encodeURIComponent(tag)}?access_token=${encodeURIComponent(token)}`;
  const response = await fetchWithRetry(url);
  if (response.status === 404) {
    return null;
  }

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Failed to query release by tag (${response.status} ${response.statusText}): ${text}`);
  }

  return text ? JSON.parse(text) : null;
}

async function createRelease(apiBase, owner, repo, token, payload) {
  const body = new URLSearchParams({
    access_token: token,
    tag_name: payload.tagName,
    name: payload.name,
    body: payload.body,
    target_commitish: payload.targetCommitish,
    prerelease: payload.prerelease ? 'true' : 'false',
  });

  return requestJson(`${apiBase}/repos/${owner}/${repo}/releases`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
}

async function updateRelease(apiBase, owner, repo, token, releaseId, payload) {
  const body = new URLSearchParams({
    access_token: token,
    tag_name: payload.tagName,
    name: payload.name,
    body: payload.body,
    prerelease: payload.prerelease ? 'true' : 'false',
  });

  return requestJson(`${apiBase}/repos/${owner}/${repo}/releases/${releaseId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
}

async function listAttachments(apiBase, owner, repo, token, releaseId) {
  return requestJson(
    `${apiBase}/repos/${owner}/${repo}/releases/${releaseId}/attach_files?access_token=${encodeURIComponent(token)}`,
  );
}

async function deleteAttachment(apiBase, owner, repo, token, releaseId, attachmentId) {
  await request(
    `${apiBase}/repos/${owner}/${repo}/releases/${releaseId}/attach_files/${attachmentId}?access_token=${encodeURIComponent(token)}`,
    {
      method: 'DELETE',
    },
  );
}

async function uploadAttachment(apiBase, owner, repo, token, releaseId, filePath) {
  const fileName = path.basename(filePath);
  const form = new FormData();
  form.append('access_token', token);
  form.append('release_id', String(releaseId));
  form.append(
    'file',
    new File([fs.readFileSync(filePath)], fileName, {
      type: 'application/octet-stream',
    }),
    fileName,
  );

  return requestJson(`${apiBase}/repos/${owner}/${repo}/releases/${releaseId}/attach_files`, {
    method: 'POST',
    timeoutMs: Number(process.env.GITEE_UPLOAD_TIMEOUT_MS || 600000),
    body: form,
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const owner = args.owner || requireEnv('GITEE_OWNER');
  const repo = args.repo || requireEnv('GITEE_REPO');
  const token = args.token || requireEnv('GITEE_TOKEN');
  const tagName = args.tag || requireEnv('RELEASE_TAG');
  const releaseName = args.name || process.env.RELEASE_NAME || tagName;
  const targetCommitish = args.target || process.env.RELEASE_TARGET || 'main';
  const releaseNotesPath = path.resolve(args['body-file'] || process.env.RELEASE_BODY_FILE || 'CHANGELOG.auto.md');
  const releaseDir = path.resolve(args['release-dir'] || process.env.RELEASE_DIR || 'release');
  const prerelease = (args.prerelease || process.env.RELEASE_PRERELEASE || 'true') === 'true';
  const includeAllArtifacts = (args['include-all'] || process.env.GITEE_RELEASE_INCLUDE_ALL || 'false') === 'true';
  const apiBase = process.env.GITEE_API_BASE || 'https://gitee.com/api/v5';
  const releaseBody = fs.readFileSync(releaseNotesPath, 'utf8');
  const files = fs.existsSync(releaseDir)
    ? collectFiles(releaseDir).filter((file) => shouldUpload(file, includeAllArtifacts))
    : [];

  let release = await getReleaseByTag(apiBase, owner, repo, token, tagName);
  if (release) {
    release = await updateRelease(apiBase, owner, repo, token, release.id, {
      tagName,
      name: releaseName,
      body: releaseBody,
      prerelease,
    });
  } else {
    release = await createRelease(apiBase, owner, repo, token, {
      tagName,
      name: releaseName,
      body: releaseBody,
      targetCommitish,
      prerelease,
    });
  }

  const existingAttachments = asArray(await listAttachments(apiBase, owner, repo, token, release.id));
  const existingByName = new Map(
    existingAttachments.map((attachment) => [attachment.name || attachment.browser_download_url?.split('/').pop(), attachment]),
  );

  for (const filePath of files) {
    const existing = existingByName.get(path.basename(filePath));
    if (existing?.id) {
      await deleteAttachment(apiBase, owner, repo, token, release.id, existing.id);
    }

    await uploadAttachment(apiBase, owner, repo, token, release.id, filePath);
  }

  process.stdout.write(`${release.html_url || release.url}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
