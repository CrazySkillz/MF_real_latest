import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join, normalize } from 'node:path';
import { pathToFileURL } from 'node:url';

export const GA4_AD_COMPARISON_CERTIFICATION_RECORD =
  'GA4/certifications/ga4-ad-comparison.json';

export const GA4_AD_COMPARISON_ACCUMULATION_WINDOW_RULE =
  'native comparison starts at the saved initial historical import boundary and accumulates through the latest completed reporting day';

export const GA4_AD_COMPARISON_REQUIRED_DEPENDENCIES = [
  'GA4/AD_COMPARISON.md',
  'GA4/AD_COMPARISON_PRODUCTION_READINESS.md',
  'client/src/components/AddRevenueWizardModal.tsx',
  'client/src/components/HubSpotRevenueWizard.tsx',
  'client/src/components/ShopifyRevenueWizard.tsx',
  'client/src/pages/ga4-ad-comparison.tsx',
  'client/src/pages/ga4-metrics.tsx',
  'shared/ga4-ad-comparison-cards.ts',
  'shared/ga4-financial-source.ts',
  'shared/schema.ts',
  'server/analytics.ts',
  'server/auto-refresh-scheduler.ts',
  'server/ga4-ad-comparison-certification-gate.ts',
  'server/ga4-ad-comparison-certification-gate.test.ts',
  'server/ga4-ad-comparison-accumulation-regression.test.ts',
  'server/routes-oauth.ts',
  'server/storage.ts',
  'server/utils/data-transformation.ts',
  'server/utils/hubspot-pagination.ts',
  'server/utils/shopify-provider.ts',
  'server/utils/reporting-timezone.ts',
  'scripts/ga4-ad-comparison-live-readonly.ts',
  'package.json',
  'render.yaml',
] as const;

type GateContext = {
  exists: (path: string) => boolean;
  readText: (path: string) => string;
  sha256: (path: string) => string;
  gitCommitExists: (sha: string) => boolean;
  gitCommitIsAncestor: (sha: string) => boolean;
};
export type CertificationGateResult = { ok: boolean; errors: string[] };

const fullSha = /^[0-9a-f]{40}$/i;
const fileHash = /^[0-9a-f]{64}$/i;
export const sha256NormalizedCertificationText = (value: string) =>
  createHash('sha256').update(value.replace(/\r\n?/g, '\n')).digest('hex');
const isObject = (value: unknown): value is Record<string, any> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isSafePath = (path: string) => {
  if (!path || isAbsolute(path) || path.includes('\\') || /[*?]/.test(path)) return false;
  const resolved = normalize(path).replace(/\\/g, '/');
  return resolved !== '..' && !resolved.startsWith('../');
};

function checkEvidence(
  label: string,
  items: any[],
  ready: boolean,
  errors: string[],
) {
  if (!Array.isArray(items) || items.length === 0) {
    errors.push(label + ' must contain evidence');
    return;
  }
  const ids = new Set<string>();
  for (const item of items) {
    if (!item || typeof item.id !== 'string' || !item.id.trim()) {
      errors.push(label + ' contains an entry without an id');
      continue;
    }
    if (ids.has(item.id)) {
      errors.push(label + ' contains duplicate id ' + item.id);
    }
    ids.add(item.id);
    if (!['passed', 'failed', 'pending', 'not_applicable'].includes(item.status)) {
      errors.push(label + ' ' + item.id + ' has invalid status');
    }
    if (typeof item.evidence !== 'string' || !item.evidence.trim()) {
      errors.push(label + ' ' + item.id + ' has no evidence');
    }
    if (ready && item.status !== 'passed' && item.status !== 'not_applicable') {
      errors.push(label + ' ' + item.id + ' is ' + item.status + ' while certification claims ready');
    }
  }
}

export function evaluateGA4AdComparisonCertification(
  value: unknown,
  context: GateContext,
): CertificationGateResult {
  const errors: string[] = [];
  if (!isObject(value)) return { ok: false, errors: ['record must be a JSON object'] };
  if (value.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  if (value.sectionId !== 'ga4-ad-comparison') errors.push('invalid sectionId');
  if (!['UNVERIFIED', 'PRODUCTION_READY'].includes(value.status)) errors.push('invalid status');
  const ready = value.status === 'PRODUCTION_READY';

  if (!fullSha.test(value.lastReviewedSha || '')) {
    errors.push('lastReviewedSha must be a full Git SHA');
  } else if (!context.gitCommitExists(value.lastReviewedSha)) {
    errors.push('lastReviewedSha does not identify a repository commit');
  } else if (!context.gitCommitIsAncestor(value.lastReviewedSha)) {
    errors.push('lastReviewedSha is not an ancestor of HEAD');
  }
  if (ready) {
    if (!fullSha.test(value.certifiedSha || '')) {
      errors.push('certifiedSha must be a full Git SHA');
    } else if (value.certifiedSha !== value.lastReviewedSha) {
      errors.push('certifiedSha must equal lastReviewedSha');
    } else if (!context.gitCommitExists(value.certifiedSha)) {
      errors.push('certifiedSha is not a repository commit');
    } else if (!context.gitCommitIsAncestor(value.certifiedSha)) {
      errors.push('certifiedSha is not an ancestor of HEAD');
    }
    if (value.invalidationReason !== null) {
      errors.push('ready status requires null invalidationReason');
    }
  } else {
    if (value.certifiedSha !== null) errors.push('certifiedSha must be null while UNVERIFIED');
    if (typeof value.invalidationReason !== 'string' || !value.invalidationReason.trim()) {
      errors.push('UNVERIFIED requires an invalidationReason');
    }
  }

  const boundary = value.configurationBoundary;
  if (!isObject(boundary)) {
    errors.push('configurationBoundary must be an object');
  } else {
    for (const field of ['platformType', 'scope']) {
      if (typeof boundary[field] !== 'string' || !boundary[field].trim()) {
        errors.push('empty boundary ' + field);
      }
    }
    for (const field of ['includedSurfaces', 'sourceRules', 'windowRules', 'ownershipRules']) {
      if (!Array.isArray(boundary[field]) || boundary[field].length === 0) {
        errors.push('empty boundary ' + field);
      }
    }
    if (
      Array.isArray(boundary.windowRules) &&
      !boundary.windowRules.includes(GA4_AD_COMPARISON_ACCUMULATION_WINDOW_RULE)
    ) {
      errors.push('windowRules must require the fixed initial-import accumulation boundary');
    }
  }

  const dependencies = Array.isArray(value.dependencies) ? value.dependencies : [];
  const byPath = new Map(dependencies.map((item: any) => [item?.path, item]));
  for (const required of GA4_AD_COMPARISON_REQUIRED_DEPENDENCIES) {
    if (!byPath.has(required)) errors.push('missing required dependency ' + required);
  }
  const seen = new Set<string>();
  for (const dependency of dependencies) {
    if (!dependency || typeof dependency.path !== 'string' || !isSafePath(dependency.path)) {
      errors.push('unsafe dependency path');
      continue;
    }
    if (seen.has(dependency.path)) errors.push('duplicate dependency ' + dependency.path);
    seen.add(dependency.path);
    if (typeof dependency.role !== 'string' || !dependency.role.trim()) {
      errors.push(dependency.path + ': missing role');
    }
    if (!context.exists(dependency.path)) {
      errors.push(dependency.path + ': missing');
    } else if (ready && !fileHash.test(dependency.sha256 || '')) {
      errors.push(dependency.path + ': certified hash missing');
    } else if (ready && context.sha256(dependency.path) !== dependency.sha256) {
      errors.push(dependency.path + ': changed since certification');
    } else if (!ready && dependency.sha256 !== null && !fileHash.test(dependency.sha256)) {
      errors.push(dependency.path + ': invalid hash');
    }
  }

  const runtimeMarkers: Array<[string, string]> = [
    ['server/routes-oauth.ts', "windowMode === 'import-to-date'"],
    ['server/routes-oauth.ts', 'resolveGA4ImportToDateWindow'],
    ['server/routes-oauth.ts', 'importToDateWindow?.endDate'],
    ['server/analytics.ts', 'endDateOverride: string = endDate ||'],
    ['server/utils/reporting-timezone.ts', 'export function resolveGA4ImportToDateWindow'],
    ['client/src/pages/ga4-metrics.tsx', 'window=import-to-date'],
    ['client/src/pages/ga4-metrics.tsx', 'campaignBreakdownAgg={adComparisonBreakdownAgg}'],
    ['client/src/pages/ga4-ad-comparison.tsx', 'initial-import-to-latest-completed-day comparison window'],
  ];
  for (const [path, marker] of runtimeMarkers) {
    if (context.exists(path) && !context.readText(path).includes(marker)) {
      errors.push(path + ': missing accumulation-path marker ' + marker);
    }
  }

  const doc = value.statusDocument;
  if (!doc || !byPath.has(doc.path) || !context.exists(doc.path)) {
    errors.push('statusDocument must be an existing listed dependency');
  } else {
    const content = context.readText(doc.path);
    const start = content.indexOf(doc.startMarker);
    const end = start < 0
      ? -1
      : content.indexOf(doc.endMarker, start + doc.startMarker.length);
    if (start < 0 || end < 0) {
      errors.push('statusDocument markers are missing');
    } else {
      const current = content.slice(start, end);
      const marker = '<!-- ga4-ad-comparison-certification-status: '
        + value.status
        + ' -->';
      if (!current.includes(marker)) errors.push('status marker does not match record');
      if (!ready && /\bAd Comparison is (?:production-ready|clean-certified)\b/i.test(current)) {
        errors.push('current status claims readiness while record is UNVERIFIED');
      }
    }
  }
  checkEvidence('requiredTests', value.requiredTests, ready, errors);
  checkEvidence('externalGates', value.externalGates, ready, errors);
  return { ok: errors.length === 0, errors };
}

function repositoryContext(root: string): GateContext {
  const resolve = (path: string) => join(root, ...path.split('/'));
  const gitOk = (args: string[]) =>
    spawnSync('git', args, { cwd: root, stdio: 'ignore' }).status === 0;
  return {
    exists: (path) => existsSync(resolve(path)),
    readText: (path) => readFileSync(resolve(path), 'utf8'),
    sha256: (path) =>
      sha256NormalizedCertificationText(readFileSync(resolve(path), 'utf8')),
    gitCommitExists: (sha) => gitOk(['cat-file', '-e', sha + '^{commit}']),
    gitCommitIsAncestor: (sha) =>
      gitOk(['merge-base', '--is-ancestor', sha, 'HEAD']),
  };
}

export function runGA4AdComparisonCertificationGate(
  root = process.cwd(),
  recordPath = GA4_AD_COMPARISON_CERTIFICATION_RECORD,
): CertificationGateResult {
  const context = repositoryContext(root);
  if (!isSafePath(recordPath) || !context.exists(recordPath)) {
    return {
      ok: false,
      errors: [recordPath + ': certification record is missing'],
    };
  }
  try {
    return evaluateGA4AdComparisonCertification(
      JSON.parse(context.readText(recordPath)),
      context,
    );
  } catch (error) {
    return {
      ok: false,
      errors: [recordPath + ': invalid JSON: ' + String(error)],
    };
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runGA4AdComparisonCertificationGate();
  if (!result.ok) {
    console.error('[GA4 Ad Comparison certification] FAILED');
    for (const error of result.errors) console.error('- ' + error);
    process.exitCode = 1;
  } else {
    console.log('[GA4 Ad Comparison certification] PASS: status is internally consistent.');
  }
}
