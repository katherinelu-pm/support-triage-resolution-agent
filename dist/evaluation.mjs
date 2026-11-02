// Evaluation-only module. The runtime engine never imports this file or labels.
import {analyze,assignAutomatically,adaptDevelopmentCase,developmentOptions,outputType,engineVersion,policyVersion} from './review-engine.mjs';
export function generateBatch(cases,knowledge,history){
 return cases.map(input=>{const c=adaptDevelopmentCase(input);const started=performance.now();try{const r=assignAutomatically(analyze(c,knowledge,history.filter(h=>input.retrieval_fixture.history_candidate_ids.includes(h.id)),developmentOptions(input)),developmentOptions(input));return {caseId:c.id,actual:{category:r.primaryCategory,originalCategory:r.originalCategory,destination:r.destination,priority:r.classification.proposedPriority,outputType:outputType(r),memberDraftAllowed:!!r.draft,draft:r.draft,internalSummary:r.draft?null:r.internalSummary,sourceIds:r.sources.map(s=>s.id),sourceVersions:r.sources,historyIds:r.similar.map(h=>h.id),history:r.similar.map(h=>({id:h.id,why:h.why,difference:h.difference,policyVersions:h.policyVersions})),historyExcluded:r.historyExcluded,handoff:r.handoff,classificationUncertainty:r.classificationUncertainty,evidenceSupport:r.evidenceSupport,state:r.state},elapsedMs:performance.now()-started,sourceSnapshot:r.sourceSnapshot,error:null};}catch(error){return {caseId:c.id,actual:null,elapsedMs:performance.now()-started,error:'Engine failed to prepare an output. Inspect the local test run.'};}});
}
export function scoreBatch(records,expectations){
 return records.map(rec=>{const e=expectations.find(e=>e.case_id===rec.caseId);if(!e)throw Error('Missing independent expectation.');const a=rec.actual,x=e.expected,ec=e.evidence_contract;
 const checks=a?[
 {id:'category',label:'Primary category',pass:a.category===x.primary_category},
 {id:'destination',label:'Destination',pass:a.destination===x.destination},
 {id:'draft_permission',label:'Member draft eligibility',pass:a.memberDraftAllowed===x.member_draft_allowed},
 {id:'output_type',label:'Output type',pass:a.outputType===x.output_type},
 {id:'priority',label:'Suggested priority (proposed rubric)',pass:a.priority===x.suggested_priority},
 {id:'source_eligibility',label:'No retired authority exposed as supporting evidence',pass:ec.prohibited_as_authority_source_ids.every(id=>!a.sourceIds.includes(id))},
 {id:'history',label:'Proposed relevant/excluded references',pass:ec.history_relevant_ids.every(id=>a.historyIds.includes(id))&&ec.history_excluded_ids.every(id=>!a.historyIds.includes(id))},
 {id:'canaries',label:'Seeded markers absent in prepared output/handoff',pass:e.privacy_canaries.every(s=>!JSON.stringify(a).includes(s))}
 ]:[{id:'generation',label:'Output generated',pass:false}];
 return {...rec,title:e.scenario_title,expectedCategory:x.primary_category,expected:x,requirements:e.required_content,forbidden:e.forbidden_behaviors,checks,allChecksPass:checks.every(c=>c.pass),humanReviewStatus:'not_reviewed',criticalSignals:{complianceMiss:x.primary_category==='compliance'&&a?.category!=='compliance',prohibitedDraft:!x.member_draft_allowed&&!!a?.draft}};
 });
}
export function runEvaluation(inputs,k,h,expectations,manifest){
 const records=generateBatch(inputs,k,h); // Complete generation before consulting labels.
 const results=scoreBatch(records,expectations);
 return {runId:'dev-'+new Date().toISOString(),at:new Date().toISOString(),engineVersion,policyVersion,datasetVersion:manifest.dataset_version,rfcSnapshot:manifest.rfc_snapshot_sha256,mode:'synthetic development / deterministic rules',results,summary:{cases:results.length,allStructuredChecksPassed:results.filter(r=>r.allChecksPass).length,categoryAndDestinationMatched:results.filter(r=>r.checks.filter(c=>['category','destination'].includes(c.id)).length===2&&r.checks.filter(c=>['category','destination'].includes(c.id)).every(c=>c.pass)).length,complianceMissSignals:results.filter(r=>r.criticalSignals.complianceMiss).length,prohibitedDraftSignals:results.filter(r=>r.criticalSignals.prohibitedDraft).length,seededPrivacyFailures:results.filter(r=>r.checks.some(c=>c.id==='canaries'&&!c.pass)).length,humanReviewsCompleted:0},limitations:['No live model quality measurement.','No representative or held-out performance estimate.','Output privacy checks cover seeded markers only; model payloads, logs and traces are not instrumented.','Correct structured fields do not establish grounding, usefulness or safe prose.','Timing is local rule computation; no queue, network, model latency or business benefit measured.']};
}
export function validateReview(review){
 if(!review.reviewer?.trim())throw Error('Enter a reviewer name or identifier.');
 const dimensions=['grounding','completeness','actionability','history','privacy','clarity'];
 if(dimensions.some(k=>![0,1,2].includes(review.scores?.[k])))throw Error('Score all six rubric dimensions.');
 if(!['usable_as_is','usable_minor_edits','major_correction','reject'].includes(review.verdict))throw Error('Choose an overall verdict.');
 if(typeof review.criticalFailure!=='boolean')throw Error('Record whether a critical failure was observed.');
 if(!review.notes?.trim())throw Error('Add a short rationale, including any corrections needed.');
 if((review.criticalFailure||Object.values(review.scores).includes(0))&&review.verdict.startsWith('usable'))throw Error('A critical failure or major dimension problem cannot be marked usable.');
 return {...review,at:new Date().toISOString()};
}
