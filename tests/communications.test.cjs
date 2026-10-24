const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

function load(file) {
  const filename = path.resolve(__dirname, '..', file);
  const source = readFileSync(filename, 'utf8').replace(/from "@\/(.*?)"/g, (_, name) => `from ${JSON.stringify(path.resolve(__dirname, '..', name) + '.ts')}`);
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod._compile(js, filename); return mod.exports;
}
require.extensions['.ts'] = (mod, filename) => {
  const source = readFileSync(filename, 'utf8');
  mod._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
};
const { parsePhoneImport } = load('lib/phone-import.ts');
const { verifyTwilio, providerEvidenceId, phoneRoutes } = load('lib/communications-provider.ts');

test('CSV preserves quoted multiline messages and explicit timezones', () => {
  const rows = parsePhoneImport('kind,contact,phone,direction,occurredAt,text\r\nsms,"Smith, Jane",+15125551234,inbound,2026-10-24T09:00:00-05:00,"A ",""\n', 'x.csv');
  assert.equal(rows[0].metadata.contact, 'Smith, Jane');
  assert.equal(rows[0].occurredAt, '2026-10-24T14:00:00.000Z');
  const multiline = parsePhoneImport('kind,contact,phone,occurredAt,text\nsms,Jane,,2026-10-24T14:00:00Z,"Line one\nLine ""two"""', 'x.csv');
  assert.equal(multiline[0].text, 'Line one\nLine "two"');
});
test('Android companion envelope and call metadata import together', () => {
  const rows = parsePhoneImport(JSON.stringify({ records: [{kind:'call',contact:'Customer',phone:'',direction:'inbound',occurredAt:'2026-10-24T14:00:00Z',text:'Call record · 50 seconds. No audio.'}] }), 'android.json');
  assert.equal(rows[0].metadata.kind, 'call'); assert.equal(rows[0].metadata.phone, '');
});
test('reject ambiguous dates, malformed phone numbers, empty and oversized batches', () => {
  const record={kind:'sms',contact:'Client',phone:'+15125551234',occurredAt:'2026-10-24T14:00:00Z',text:'Hello'};
  for (const change of [{occurredAt:'2026-10-24T14:00:00'}, {phone:'5125551234'}, {text:''}]) {
    assert.throws(()=>parsePhoneImport(JSON.stringify([{...record,...change}]),'x.json'));
  }
  assert.throws(()=>parsePhoneImport('[]','x.json'));
  assert.throws(()=>parsePhoneImport(JSON.stringify(Array(501).fill(record)),'x.json'));
  assert.throws(()=>parsePhoneImport('Date,Message\ntoday,hello','x.csv'));
});
test('Twilio signature known official test vector, tampering and duplicates', () => {
  const url='https://example.com/myapp.php?foo=1&bar=2';
  const params=new URLSearchParams({CallSid:'CA1234567890ABCDE',Caller:'+14158675310',Digits:'1234',From:'+14158675310',To:'+18005551212'});
  const signature='L/OH5YylLD5NRKLltdqwSvS0BnU=';
  assert.equal(verifyTwilio(url,params,signature,'12345'),true);
  assert.equal(verifyTwilio(url+'x',params,signature,'12345'),false);
  params.append('From','attacker'); assert.equal(verifyTwilio(url,params,signature,'12345'),false);
});
test('provider event identity is stable and invalid route configuration is disabled', () => {
  const id=providerEvidenceId('SM123'); assert.equal(id,providerEvidenceId('SM123')); assert.notEqual(id,providerEvidenceId('SM124'));
  assert.match(id,/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/);
  process.env.PATH_PHONE_ROUTES='invalid'; assert.deepEqual(phoneRoutes(),[]);
});
