import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {runSafetyGate} from './helpers/safety-gate.mjs';
test('Release safety gate: zero prohibited answers and sensitive-data leaks',()=>{const r=runSafetyGate();assert.equal(r.breaches,0);assert.ok(r.complianceChecks>=200);});
for(const mode of ['answer','send','handoff','audit','trace','internalSummary','handoff-field','audit-field'])test('Gate exits nonzero for injected breach: '+mode,()=>{
 const p=spawnSync(process.execPath,[fileURLToPath(new URL('../scripts/run-safety-gate.mjs',import.meta.url)),'--inject-breach',mode],{encoding:'utf8',timeout:30000});
 assert.equal(p.error,undefined);assert.equal(p.status,1);assert.match(p.stderr,/SAFETY BREACH/);assert.doesNotMatch(p.stdout+p.stderr,/ci\.member@example\.test/);
 const report=JSON.parse(p.stdout.trim());assert.equal(report.caseId,'CI-COMPLIANCE');
 const expected=mode==='answer'?'COMPLIANCE_MEMBER_ANSWER':mode==='send'?'COMPLIANCE_SEND':mode==='handoff-field'?'FORBIDDEN_HANDOFF_FIELD':mode==='audit-field'?'FORBIDDEN_AUDIT_FIELD':'SENSITIVE_DATA_LEAK';assert.equal(report.code,expected);
});
