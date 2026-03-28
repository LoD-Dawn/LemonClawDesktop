const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

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

function git(args, options = {}) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  }).trim();
}

function tryGit(args) {
  try {
    return git(args);
  } catch {
    return '';
  }
}

function getPackageVersion() {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  return packageJson.version;
}

function formatDate(value) {
  return new Date(value).toISOString().replace('.000Z', 'Z');
}

function getCommitRange(fromRef, toRef) {
  if (!fromRef) {
    return [toRef];
  }

  return [`${fromRef}..${toRef}`];
}

function parseCommits(rangeArgs) {
  const output = git([
    'log',
    ...rangeArgs,
    '--date=iso-strict',
    '--pretty=format:%H%x1f%s%x1f%an%x1f%ad',
  ]);

  if (!output) {
    return [];
  }

  return output
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [sha, subject, author, date] = line.split('\u001f');
      return { sha, subject, author, date };
    });
}

function buildMarkdown({ releaseName, releaseTag, targetRef, previousTag, commits }) {
  const lines = [
    `# ${releaseName}`,
    '',
    `- Tag: \`${releaseTag}\``,
    `- Target: \`${targetRef}\``,
    `- Generated At: ${formatDate(Date.now())}`,
  ];

  if (previousTag) {
    lines.push(`- Previous Tag: \`${previousTag}\``);
  }

  lines.push('');
  lines.push('## Changelog');
  lines.push('');

  if (commits.length === 0) {
    lines.push('- No commits found in the selected range.');
  } else {
    for (const commit of commits) {
      const shortSha = commit.sha.slice(0, 7);
      lines.push(
        `- ${commit.subject} (\`${shortSha}\`, ${commit.author}, ${formatDate(commit.date)})`,
      );
    }
  }

  return `${lines.join('\n')}\n`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const targetRef = args.ref || process.env.RELEASE_TARGET || 'HEAD';
  const previousTag = args['from-tag'] || process.env.PREVIOUS_TAG || tryGit(['describe', '--tags', '--abbrev=0']);
  const releaseTag = args.tag || process.env.RELEASE_TAG || `main-build-${tryGit(['rev-parse', '--short', targetRef])}`;
  const version = args.version || process.env.RELEASE_VERSION || getPackageVersion();
  const releaseName = args.name || process.env.RELEASE_NAME || `LemonClaw ${version} (${releaseTag})`;
  const outputPath = path.resolve(args.output || process.env.CHANGELOG_OUTPUT || 'CHANGELOG.auto.md');
  const rangeArgs = getCommitRange(previousTag, targetRef);
  const commits = parseCommits(rangeArgs);
  const markdown = buildMarkdown({
    releaseName,
    releaseTag,
    targetRef,
    previousTag,
    commits,
  });

  fs.writeFileSync(outputPath, markdown, 'utf8');
  process.stdout.write(`${outputPath}\n`);
}

main();
