import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {runEvaluation} from '../dist/evaluation.mjs';
const read=n=>JSON.parse(readFileSync(new URL('../dist/eval-data/'+n+'.json',import.meta.url)));
const report=runEvaluation(read('cases').cases,read('sources').articles,read('history').historical_cases,read('expectations').case_expectations,read('manifest'));
mkdirSync(new URL('../review/results/',import.meta.url),{recursive:true});
writeFileSync(new URL('../review/results/development-latest.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({runId:report.runId,engineVersion:report.engineVersion,summary:report.summary,limitations:report.limitations},null,2));
