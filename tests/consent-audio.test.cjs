const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file) {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', file), 'utf8');
  const output = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const module = {exports:{}};
  vm.runInNewContext(output, {module,exports:module.exports,require: name => name === 'react' ? require('react') : {},window:undefined});
  return module.exports;
}
const {splitConsentAudio} = load('useConsentAudio.ts');
const {consentAudio} = load('demo-consent.ts');

test('short opening clip, bounded later clips, and stable preload key', () => {
  for (const text of [('Patient consent. Hospital procedure.\n\nClinical information. ').repeat(80), ('रोगी सहमति पत्र। चिकित्सा प्रक्रिया की जानकारी।\n\n').repeat(80)]) {
    const chunks = splitConsentAudio(text);
    assert.ok(chunks[0].length <= 180);
    assert.ok(chunks.slice(1).every(chunk => chunk.length <= 650));
    assert.equal(splitConsentAudio(chunks[0])[0],chunks[0]);
    assert.equal(chunks.join(' ').replace(/\s+/g,' ').trim(),text.replace(/\s+/g,' ').trim());
  }
});

test('narration reads populated entries and choices without old demo notices', () => {
  const t={title:'Patient consent',subtitle:'Procedure',demo_title:'DEMO DOCUMENT',demo_notice:'software demonstration',policy_notice:'Applicable hospital policies and NMC requirements.',labels:{patient_name:'Patient name'},sections:['Details','Data','Procedure','Declaration','Clinician','Witness'],data_items:[],procedure_items:[],data_yes:'Data accepted',data_no:'Data declined',procedure_yes:'Procedure accepted',procedure_no:'Procedure declined'};
  const form={template:{en:t,hi:t},hospital_name:'Hospital',fields:{patient_name:{text:'Patient Example',ink:null}},data_decision:'declined',procedure_decision:'accepted'};
  const audio=consentAudio(form,'en');
  assert.ok(audio.includes('Patient Example'));
  assert.ok(audio.includes('Data declined'));
  assert.ok(audio.includes('Procedure accepted'));
  assert.ok(audio.includes('NMC requirements'));
  assert.ok(!audio.includes('DEMO DOCUMENT'));
  assert.ok(!audio.includes('software demonstration'));
});
