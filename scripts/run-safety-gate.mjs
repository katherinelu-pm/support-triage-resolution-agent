import {writeFileSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {runSafetyGate,SafetyBreach} from '../tests/helpers/safety-gate.mjs';
const args=process.argv.slice(2),value=flag=>args.includes(flag)?args[args.indexOf(flag)+1]:undefined;
let report;
try{report=runSafetyGate({injectBreach:value('--inject-breach')});}
catch(error){report={status:'failed',breaches:1,...(error instanceof SafetyBreach?{code:error.code,caseId:error.caseId,surface:error.surface}:{code:'SAFETY_GATE_ERROR'} )};process.exitCode=1;console.error(`SAFETY BREACH [${report.code}] case=${report.caseId||'unknown'} surface=${report.surface||'gate'}; release blocked`);}
const path=value('--report');if(path){mkdirSync(dirname(path),{recursive:true});writeFileSync(path,JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report));
