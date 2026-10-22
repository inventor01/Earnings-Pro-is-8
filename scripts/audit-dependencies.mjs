import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// Each exception is tied to the exact package, version and advisory reviewed
// in docs/security-qa-2026-10-21.md. New advisories or critical findings fail.
const exceptions = {
  'GHSA-vfj7-8cjw-p6xm': { name: 'braces', versions: ['3.0.3'], projects: ['earnings-ninja-expo', 'frontend', 'landing'] },
  'GHSA-vcc3-ghjq-m6fr': { name: 'decode-uri-component', versions: ['0.2.2'], projects: ['earnings-ninja-expo'] },
  'GHSA-5p2g-fcmc-qvqq': { name: 'image-size', versions: ['1.2.1'], projects: ['earnings-ninja-expo'] },
  'GHSA-w3rx-r6r6-pgpr': { name: 'image-size', versions: ['1.2.1'], projects: ['earnings-ninja-expo'] },
  'GHSA-86w9-cpqp-85rv': { name: 'node-forge', versions: ['1.4.0'], projects: ['earnings-ninja-expo'] },
  'GHSA-hp3w-g68c-fv3c': { name: 'sprintf-js', versions: ['1.0.3'], projects: ['earnings-ninja-expo'] },
};

export function assessAudit(project, audit, lock) {
  if (audit.error || !Number.isInteger(audit.metadata?.vulnerabilities?.total) || !audit.vulnerabilities
      || audit.metadata.vulnerabilities.total !== Object.keys(audit.vulnerabilities).length) {
    throw new Error('npm audit returned an incomplete report');
  }
  const findings = [];
  const failures = [];
  if (audit.metadata.vulnerabilities.critical > 0) failures.push('Critical vulnerabilities reported by npm');
  for (const [name, item] of Object.entries(audit.vulnerabilities)) {
    if (item.severity === 'critical') failures.push(`Critical dependency: ${name}`);
    for (const advisory of item.via.filter(v => typeof v === 'object')) {
      const id = advisory.url?.split('/').pop();
      const exception = exceptions[id];
      const versions = item.nodes.map(path => lock.packages?.[path]?.version);
      if (!exception || exception.name !== name || !exception.projects.includes(project)
          || versions.length === 0 || versions.some(v => !exception.versions.includes(v))
          || advisory.severity === 'critical') {
        failures.push(`${name}: ${id ?? 'unknown advisory'} (${versions.join(', ')})`);
      } else {
        findings.push(`${name}: ${id} (${versions.join(', ')})`);
      }
    }
  }
  if (Object.keys(audit.vulnerabilities).length && !findings.length && !failures.length) {
    failures.push('Dependency findings had no reviewable advisory details');
  }
  return { findings, failures };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  let failed = false;
  for (const project of ['.', 'earnings-ninja-expo', 'frontend', 'landing']) {
    const cwd = resolve(root, project);
    const result = spawnSync('npm', ['audit', '--package-lock-only', '--json', '--registry=https://registry.npmjs.org'], {
      cwd, encoding: 'utf8', timeout: 120000, maxBuffer: 20 * 1024 * 1024,
    });
    try {
      if (result.error || ![0, 1].includes(result.status)) throw result.error ?? new Error(`npm exited ${result.status}`);
      const audit = JSON.parse(result.stdout);
      const lock = JSON.parse(readFileSync(resolve(cwd, 'package-lock.json'), 'utf8'));
      const assessment = assessAudit(project, audit, lock);
      console.log(`${project}: ${audit.metadata.vulnerabilities.total} findings; ${assessment.findings.length} reviewed advisories`);
      for (const failure of assessment.failures) console.error(`  FAIL ${failure}`);
      failed ||= assessment.failures.length > 0;
    } catch (error) {
      console.error(`${project}: audit failed: ${error.message}`);
      failed = true;
    }
  }
  process.exitCode = failed ? 1 : 0;
}
