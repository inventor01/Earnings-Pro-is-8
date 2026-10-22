import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessAudit } from './audit-dependencies.mjs';

function fixture({ severity = 'high', version = '3.0.3', id = 'GHSA-vfj7-8cjw-p6xm' } = {}) {
  return [{ metadata: { vulnerabilities: { total: 1 } }, vulnerabilities: {
    braces: { severity, nodes: ['node_modules/braces'], via: [{ severity, url: `https://github.com/advisories/${id}` }] },
  } }, { packages: { 'node_modules/braces': { version } } }];
}

test('permits only a reviewed advisory at the exact reviewed version and project', () => {
  assert.equal(assessAudit('landing', ...fixture()).failures.length, 0);
  assert.equal(assessAudit('.', ...fixture()).failures.length, 1);
  assert.equal(assessAudit('landing', ...fixture({ version: '3.0.2' })).failures.length, 1);
  assert.equal(assessAudit('landing', ...fixture({ id: 'GHSA-new-advisory' })).failures.length, 1);
});

test('critical findings cannot use an exception', () => {
  assert.ok(assessAudit('landing', ...fixture({ severity: 'critical' })).failures.length > 0);
});

test('network errors and incomplete reports cannot produce a pass', () => {
  assert.throws(() => assessAudit('landing', { error: { code: 'ENOTFOUND' } }, {}));
  assert.throws(() => assessAudit('landing', {}, {}));
  assert.throws(() => assessAudit('landing', { metadata: {}, vulnerabilities: {} }, {}));
});
