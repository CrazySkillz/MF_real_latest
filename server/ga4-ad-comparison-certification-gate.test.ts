import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  evaluateGA4AdComparisonCertification,
  GA4_AD_COMPARISON_ACCUMULATION_WINDOW_RULE,
  GA4_AD_COMPARISON_REQUIRED_DEPENDENCIES,
  runGA4AdComparisonCertificationGate,
  sha256NormalizedCertificationText,
} from './ga4-ad-comparison-certification-gate';

const hash = (value: string) =>
  createHash('sha256').update(value).digest('hex');

const statusPath = 'GA4/AD_COMPARISON_PRODUCTION_READINESS.md';
const statusDocument = [
  '# GA4 Ad Comparison Production Readiness',
  '<!-- ga4-ad-comparison-certification-status: UNVERIFIED -->',
  '**Status: UNVERIFIED. Ad Comparison is not currently certified production-ready.**',
  '<!-- /ga4-ad-comparison-current-status -->',
].join('\n');

const content = Object.fromEntries(
  GA4_AD_COMPARISON_REQUIRED_DEPENDENCIES.map((path) => [
    path,
    path === statusPath ? statusDocument : 'dependency:' + path,
  ]),
);

const baseRecord = () => ({
  schemaVersion: 1,
  sectionId: 'ga4-ad-comparison',
  status: 'UNVERIFIED',
  lastReviewedSha: 'a'.repeat(40),
  certifiedSha: null as string | null,
  invalidationReason: 'Production-only evidence remains pending.' as string | null,
  configurationBoundary: {
    platformType: 'google_analytics',
    scope: 'one campaign and property',
    includedSurfaces: ['live Ad Comparison tab'],
    sourceRules: ['exact source only'],
    windowRules: [GA4_AD_COMPARISON_ACCUMULATION_WINDOW_RULE],
    ownershipRules: ['campaign access required'],
  },
  dependencies: GA4_AD_COMPARISON_REQUIRED_DEPENDENCIES.map((path) => ({
    path,
    role: 'required dependency',
    sha256: null as string | null,
  })),
  statusDocument: {
    path: statusPath,
    startMarker: '# GA4 Ad Comparison Production Readiness',
    endMarker: '<!-- /ga4-ad-comparison-current-status -->',
  },
  requiredTests: [
    { id: 'focused', status: 'pending', evidence: 'Required before certification.' },
  ],
  externalGates: [
    { id: 'deployed', status: 'pending', evidence: 'Requires deployed evidence.' },
  ],
});

const gateContext = (files = content) => ({
  exists: (path: string) => Object.hasOwn(files, path),
  readText: (path: string) => files[path],
  sha256: (path: string) => hash(files[path]),
  gitCommitExists: () => true,
  gitCommitIsAncestor: () => true,
});

describe('GA4 Ad Comparison certification gate', () => {
  it('hashes committed text independently of checkout line endings', () => {
    expect(sha256NormalizedCertificationText('first\r\nsecond\rthird\n'))
      .toBe(sha256NormalizedCertificationText('first\nsecond\nthird\n'));
  });

  it('accepts a complete UNVERIFIED record with pending evidence', () => {
    expect(
      evaluateGA4AdComparisonCertification(baseRecord(), gateContext()),
    ).toEqual({ ok: true, errors: [] });
  });

  it('rejects a positive current claim while UNVERIFIED', () => {
    const changed = {
      ...content,
      [statusPath]: statusDocument.replace(
        '**Status: UNVERIFIED. Ad Comparison is not currently certified production-ready.**',
        'Ad Comparison is production-ready.',
      ),
    };
    const result = evaluateGA4AdComparisonCertification(
      baseRecord(),
      gateContext(changed),
    );
    expect(result.errors).toContain(
      'current status claims readiness while record is UNVERIFIED',
    );
  });

  it('rejects a reduced dependency boundary', () => {
    const record = baseRecord();
    record.dependencies.pop();
    const result = evaluateGA4AdComparisonCertification(record, gateContext());
    expect(result.errors.join('\n')).toContain('missing required dependency');
  });

  it('rejects a rolling-only window boundary before certification', () => {
    const record = baseRecord();
    record.configurationBoundary.windowRules = ['last 30 completed days'];
    const result = evaluateGA4AdComparisonCertification(record, gateContext());
    expect(result.errors).toContain(
      'windowRules must require the fixed initial-import accumulation boundary',
    );
  });

  it('rejects an invalid reviewed revision', () => {
    const result = evaluateGA4AdComparisonCertification(baseRecord(), {
      ...gateContext(),
      gitCommitExists: () => false,
    });
    expect(result.errors).toContain(
      'lastReviewedSha does not identify a repository commit',
    );
  });

  it('requires hashes and complete evidence for a ready claim', () => {
    const record = baseRecord();
    record.status = 'PRODUCTION_READY';
    record.certifiedSha = record.lastReviewedSha;
    record.invalidationReason = null;
    const readyFiles = {
      ...content,
      [statusPath]: statusDocument
        .replace('UNVERIFIED', 'PRODUCTION_READY')
        .replace(
          '**Status: UNVERIFIED. Ad Comparison is not currently certified production-ready.**',
          'Ad Comparison is production-ready.',
        ),
    };
    const result = evaluateGA4AdComparisonCertification(
      record,
      gateContext(readyFiles),
    );
    expect(result.errors.join('\n')).toContain('certified hash missing');
    expect(result.errors).toContain(
      'requiredTests focused is pending while certification claims ready',
    );
    expect(result.errors).toContain(
      'externalGates deployed is pending while certification claims ready',
    );
  });

  it('accepts ready only with current hashes and complete evidence', () => {
    const readyFiles = {
      ...content,
      [statusPath]: statusDocument
        .replace('UNVERIFIED', 'PRODUCTION_READY')
        .replace(
          '**Status: UNVERIFIED. Ad Comparison is not currently certified production-ready.**',
          'Ad Comparison is production-ready.',
        ),
    };
    const record = baseRecord();
    record.status = 'PRODUCTION_READY';
    record.certifiedSha = record.lastReviewedSha;
    record.invalidationReason = null;
    record.dependencies = record.dependencies.map((dependency) => ({
      ...dependency,
      sha256: hash(readyFiles[dependency.path]),
    }));
    record.requiredTests[0].status = 'passed';
    record.requiredTests[0].evidence = 'Passed.';
    record.externalGates[0].status = 'passed';
    record.externalGates[0].evidence = 'Passed.';
    expect(
      evaluateGA4AdComparisonCertification(record, gateContext(readyFiles)),
    ).toEqual({ ok: true, errors: [] });

    record.dependencies[0].sha256 = '0'.repeat(64);
    expect(
      evaluateGA4AdComparisonCertification(record, gateContext(readyFiles)).errors
        .join('\n'),
    ).toContain('changed since certification');
  });

  it('accepts the repository fail-closed record', () => {
    expect(runGA4AdComparisonCertificationGate()).toEqual({
      ok: true,
      errors: [],
    });
  });
});
