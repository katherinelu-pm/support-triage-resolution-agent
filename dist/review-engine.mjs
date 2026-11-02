// RFC review workflow around the unchanged rule baseline. No evaluator imports.
import * as base from './engine.mjs';
export const engineVersion='rules-review-2.5';
export const policyVersion='rfc-assisted-2.0';
export const categories={general_qa:'General FAQ',product_feedback:'Product feedback',compliance:'Compliance-sensitive',unknown:'Needs human assessment'};
export const redact=base.redact;
const now=()=>new Date().toISOString();
const stamp=x=>{let h=2166136261;for(const c of JSON.stringify(x)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(16);}; // Change marker, not a security hash.
const words=s=>new Set((s.toLowerCase().match(/[a-z]{4,}/g)||[]).filter(w=>!['that','this','with','from','case','member','support','reported','their','have','after'].includes(w)));
const optionsOf=o=>({failure:'none',low:false,responseLow:false,shadow:false,paused:false,noHistory:false,...o});
function permittedKnowledge(c,k){return k.filter(a=>!a.effective_at||Date.parse(a.effective_at)<=Date.parse(c.as_of||c.updated_at||'2026-11-02T23:59:59Z'));}
export function historyEligibility(c,k,history){
 const approved=new Map(k.filter(s=>s.status==='approved').map(s=>[s.id,s]));const cutoff=c.created_at||c.intake_at||'2026-11-02T14:00:00Z';
 const allowed=c.access_context?.allowed_history_visibility||['support_sanitized_reference'];const eligible=[],excluded=[];
 for(const h of history){let reason=null;
 if(!allowed.includes(h.visibility))reason='permission';
 else if(h.review_status!=='demo_reviewed'||h.record_status!=='closed')reason='unreviewed_or_open';
 else if(Date.parse(h.closed_at)>=Date.parse(cutoff)||h.origin_case_ref===c.id)reason='not_available_before_intake';
 else if(h.policy_source_ids.some(id=>!approved.has(id)||h.policy_versions?.[id]&&h.policy_versions[id]!==approved.get(id).version))reason='policy_not_current';
 else if(base.sensitive(JSON.stringify(h)))reason='sensitive_content';
 if(reason)excluded.push({id:h.id,reason});else eligible.push(h);
 }return {eligible,excluded};
}
const complianceConcerns=[
 [/discriminat|national origin|people of my race|people from my country/i,'Possible discriminatory treatment by a lender.'],
 [/without (my )?(consent|permission)|did not authoriz|not authoriz|withdr[ae]w.{0,30}permission|keeps calling|calling after|called my workplace/i,'Possible consent or unauthorized-contact concern.'],
 [/someone else|another person|different person|shared with lenders/i,'Possible unauthorized disclosure or sharing of personal information.'],
 [/hidden fee|misleading/i,'Potentially misleading offer information or undisclosed fees.'],
 [/forged|backdate|erase.{0,30}(record|message|complaint)|delete.{0,40}(message|complaint|record)/i,'Possible manipulation or removal of complaint records.'],
 [/credit inquiry|credit report/i,'Potential credit-reporting or inquiry authorization concern.'],
 [/screen.reader|disability|refused any alternative/i,'Possible accessibility barrier or unequal access.'],
 [/regulator/i,'A regulatory concern or escalation is mentioned.']
];
// Fictional demo ownership map; not Bankrate's actual team directory.
export function productDetails(c){
 const area=c.product_area||'Unassigned';
 const team=/mortgage/i.test(area)?'Mortgages':/credit.card/i.test(area)?'Credit Cards':/savings|banking/i.test(area)?'Banking':/loan/i.test(area)?'Loans':/lender|referral/i.test(area)?'Lender Marketplace':/member account/i.test(area)?'Member Experience':'Product Triage';
 const channel=({authenticated_web:'Signed-in web intake',demo_intake:'Demo case form',email:'Email',chat:'Chat',phone:'Phone'})[c.channel]||'Not specified';
 return {product:area,channel,team};
}
function internalSummary(c,r){
 const reports=c.conversation.filter(m=>m.author_role==='member').map(m=>redact(m.text).replace(/\s+/g,' ').trim());
 const summary={issue:reports.join('\n').slice(0,1700),context:`Product area: ${c.product_area}. ${r.compliance?'These are member allegations, not independently verified findings.':'This summary reflects the conversation; no account action has been performed.'}`,unknowns:r.summary.gaps.join('\n')||'No additional verified facts are available beyond the cited conversation and approved guidance.',nextSteps:r.steps.map(s=>s.text).join('\n')||'Continue manual review under current policy; no supported automated action is available.'};
 if(r.compliance){
  const matches=complianceConcerns.filter(([pattern])=>reports.some(text=>pattern.test(text)));
  const evidence=reports.flatMap(text=>text.match(/[^.!?]+[.!?]*/g)||[text]).filter(text=>matches.some(([pattern])=>pattern.test(text))).map(text=>text.trim());
  summary.concern=matches.map(([,label])=>label).join(' ')||'A potential compliance concern requires specialist assessment; the specific concern is not established from the available member messages.';
  summary.whyFlagged=evidence.length?`The member reports: “${evidence.slice(0,2).join(' ').slice(0,420)}” This triggered the demo’s compliance screening; it is not a verified violation.`:`Flagged through manual compliance routing. Reviewer reason: ${redact(r.classification.review?.reason||'Review the original case to establish the concern.')} No specific violation has been inferred.`;
  summary.team='Compliance / Legal — assess the allegation, applicable obligations, and permitted response. Customer Support retains case ownership and gathers missing context for the restricted handoff.';
  summary.issue=reports.join(' ').slice(0,500)+(reports.join(' ').length>500?'…':'');
 }
 if(!r.compliance&&r.primaryCategory==='product_feedback'){
  const details=productDetails(c);
  // Keep explicit feature requests; unrelated personal/financial narratives stay in the restricted case.
  const requestSentences=reports.flatMap(text=>text.match(/[^.!?]+[.!?]*/g)||[]).filter(text=>/please add|could you add|feature request|would like|i suggest|i want.{0,30}(feature|filter|option)|request.{0,25}(feature|filter|option)/i.test(text)&&!/(?:[$£€]\s*\d|settlement|inheritance|divorc|diagnos|salary|social security|account number)/i.test(text));
  summary.productFeedback=requestSentences.map(text=>text.trim()).join(' ').slice(0,650)||'Product improvement requested; review the authorized case for the exact change.';
  summary.issue=summary.productFeedback;
  summary.productType=details.product;summary.channel=details.channel;summary.productTeam=details.team;
 }
 return summary;
}
export function analyze(c,k,history,opts={}){
 const started=performance.now(),options=optionsOf(opts),availableK=permittedKnowledge(c,k);
 const eligibility=historyEligibility(c,availableK,history);const description=c.conversation.filter(m=>m.author_role==='member').map(m=>redact(m.text)).join(' ');const terms=words(description);
 const discovery=options.noHistory||options.failure==='history'?[]:eligibility.eligible.map(h=>({id:h.id,overlap:[...words(h.title+' '+h.sanitized_description)].filter(t=>terms.has(t)).length})).filter(h=>h.overlap>=2).sort((a,b)=>b.overlap-a.overlap).slice(0,5);
 const retrievalMs=performance.now()-started;
 // Candidate discovery precedes classification. The baseline classifier remains rule-only;
 // no claim that a contextual AI classifier has consumed historical evidence.
 let r=base.analyze(c,options.failure==='knowledge'?[]:availableK,options.noHistory?[]:eligibility.eligible,{...options,low:options.low||options.responseLow});
 const primary=r.category==='unsupported'?'general_qa':['general_qa','product_feedback','compliance'].includes(r.category)?r.category:'unknown';
 const uncertainty=options.low||options.failure==='model'||primary==='unknown';
 const severity=r.compliance&&/another person|someone else|backdate|credit inquiry|credit report/i.test(description)?'P1':r.compliance?'P2':c.priority;
 r={...r,engineVersion,policyVersion,originalCategory:r.category,primaryCategory:primary,classification:{status:'pending',proposedCategory:primary,proposedPriority:severity,reason:`Rule baseline: ${r.reason}. ${r.category==='unsupported'?'Primary intent mapped to routine/service request; action stays manual.':''}`,riskFlags:r.compliance?['compliance_signal']:r.category==='security_review'?['untrusted_instruction']:[],review:null},classificationUncertainty:{status:uncertainty?'Human assessment required':'Rule proposal · uncalibrated',reason:uncertainty?'The category is unresolved or classification is unavailable/low confidence.':'Explicit rules produced a proposal; no model probability has been estimated.'},evidenceSupport:{status:r.draft?'Supported by approved guidance':r.reason==='CONFLICTING_EVIDENCE'?'Conflicting guidance':r.compliance||r.category==='product_feedback'?'Internal use only':'Insufficient for member drafting',reason:options.responseLow?'Response support is low; category proposal is retained.':r.reason},historyDiscovery:discovery,historyExcluded:eligibility.excluded,outputRevision:1,summaryApproval:null,classificationRequired:true,reviewStartedAt:Date.now(),timing:{engine:'local deterministic simulation',queueMs:null,retrievalMs,requestToReviewReadyMs:performance.now()-started,liveModelMs:null},sourceSnapshot:stamp(k),caseFingerprint:base.fingerprint(c,k),operatingFingerprint:stamp(options),preparedState:r.state,state:'awaiting_classification',approval:null};
 r.similar=r.similar.map(h=>({...h,policyVersions:h.policy_versions||Object.fromEntries(h.policy_source_ids.map(id=>[id,k.find(s=>s.id===id)?.version])),difference:`Current product: ${c.product_area}; historical product: ${h.product_area}. Current priority: ${c.priority}; historical priority: ${h.severity}. Current message and past description must be compared; shared topic words do not establish the same cause or outcome.`,currentReport:description.slice(0,280),eligibility:'Sanitized visibility, reviewed/closed record, pre-intake date and current policy checked.'}));
 if(r.draft){const subject=availableK.find(s=>s.id===r.source?.id)?.title||'Your support request';r.draft=`Subject: ${subject}

Hello,

Thank you for contacting Bankrate Support. I’m happy to help with your question.

${r.draft}

If you need further help with these steps, please reply to this email and let us know where you got stuck.

Best regards,
Bankrate Support`;}
 r.internalSummary=internalSummary(c,r);
 if(r.internalSummary.productFeedback)r.similar=r.similar.map(item=>({...item,currentReport:r.internalSummary.productFeedback}));
 if(c.createdInDemo)r.sources=r.sources.filter(s=>s.id===r.source?.id||r.steps.some(step=>step.policy===s.id));
 r.trace=[{stage:'Validate and select evidence',detail:'Local fixture permissions, source dates and historical eligibility checked.'},{stage:'Discover historical candidates',detail:`${discovery.length} candidates by description before classification; baseline rules do not infer intent from history.`},{stage:'Classify and apply policy',detail:`${r.originalCategory} → ${primary}; compliance takes precedence.`},{stage:'Prepare permitted output',detail:r.draft?'Sourced routine draft.':'Internal assistance; no member draft.'},{stage:'Human review',detail:'Classification, output, then separate action confirmation.'}];
 return r;
}
function current(r,c,k,opts){if(r.caseFingerprint!==base.fingerprint(c,k))throw Error('Case or evidence changed. Refresh and review again.');if(r.operatingFingerprint!==stamp(optionsOf(opts)))throw Error('Operating conditions changed. Refresh and review again.');}
function reviewed(r,c,k,opts){current(r,c,k,opts);if(!['accepted','assigned'].includes(r.classification.status))throw Error('Assign a category before approving this response.');if(r.execution)throw Error('An action is already recorded. Reconcile it before continuing.');}
function executionGate(r,c,k,opts,ledger){reviewed(r,c,k,opts);const o=optionsOf(opts);if(o.paused||o.shadow)throw Error('Execution is disabled while paused or in shadow mode.');if(o.failure!=='none'&&o.failure!=='history')throw Error('Dependency unavailable. Keep human ownership.');if(o.low)throw Error('Unresolved classification requires manual assessment.');const key=`${c.id}:v${c.case_version}`;if(ledger?.has(key))throw Error('This case version already has an action receipt or unknown outcome. Reconcile before retrying.');return key;}
export function acceptClassification(r,c,k,opts,reviewer,{category=r.primaryCategory,priority=r.classification.proposedPriority,reason=''}={}){
 current(r,c,k,opts);if(r.execution)throw Error('Cannot revise an executed decision.');if(!categories[category]||!['P1','P2','P3'].includes(priority))throw Error('Choose a valid category and priority.');
 const changed=category!==r.primaryCategory||priority!==r.classification.proposedPriority;
 if(changed&&!reason.trim())throw Error('Record why the classification or priority was corrected.');
 if(r.compliance&&category!=='compliance')throw Error('A compliance flag cannot be removed through a category correction.');
 if(category==='unknown'||optionsOf(opts).low||optionsOf(opts).failure==='model')throw Error('Classification is unresolved. Send this case for manual assessment.');
 let n={...r,classification:{...r.classification,status:'accepted',review:{reviewer,category,priority,reason:redact(reason),corrected:changed,at:now(),elapsedSeconds:(Date.now()-r.reviewStartedAt)/1000}},approval:null,summaryApproval:null,outputRevision:r.outputRevision+(changed?1:0)};
 if(category!==r.primaryCategory){
  n={...n,primaryCategory:category,category,compliance:r.compliance||category==='compliance',label:categories[category],draft:null,source:null,similar:[],action:category==='general_qa'?'escalate':'route',destination:category==='compliance'?'Compliance / Legal':category==='product_feedback'?'Product':'Customer Support',preparedState:category==='general_qa'?'manual':'awaiting_handoff',reason:'HUMAN_CORRECTED_CLASSIFICATION',steps:[{id:'review-policy',text:'Review the corrected classification and current recipient policy before confirming any handoff.',policy:category==='compliance'?'POL-02':category==='product_feedback'?'POL-01':'POL-03'}]};
  const policyId=category==='compliance'?'POL-02':category==='product_feedback'?'POL-01':'POL-03';const policy=k.find(s=>s.id===policyId&&s.status==='approved');if(!policy)throw Error('Current category policy is unavailable. Use manual assessment.');n.sources=[...n.sources.filter(s=>s.id!==policyId),{id:policy.id,title:policy.title,version:policy.version}];if(n.compliance)n.classification={...n.classification,riskFlags:[...new Set([...n.classification.riskFlags,'human_compliance_flag'])]};n.internalSummary=internalSummary(c,n);n.handoff={case_ref:c.id,category,reason_code:n.reason,priority,...(category==='product_feedback'?{product_area:c.product_area,summary:'Product feedback identified by human review; consult the authorized case.'}:{context:'Review original under existing case permissions.'})};
 }
 n.state=n.draft?'awaiting_approval':n.action==='route'?'awaiting_summary_review':'manual';
 n.handoff={...n.handoff,priority};return n;
}
export function rejectClassification(r,c,k,opts,reason,reviewer){current(r,c,k,opts);if(!reason.trim())throw Error('Add a reason for manual assessment.');if(r.execution)throw Error('An action is already recorded.');return {...r,classification:{...r.classification,status:'rejected',review:{reviewer,reason:redact(reason),at:now()}},draft:null,approval:null,summaryApproval:null,state:'manual',action:'escalate',destination:r.compliance?'Compliance / Legal':'Customer Support'};}
export function reopenClassification(r){if(r.execution)throw Error('Cannot reopen a decision with an action receipt.');return {...r,state:'awaiting_classification',classification:{...r.classification,status:'pending'},approval:null,summaryApproval:null,outputRevision:r.outputRevision+1};}
export function approveDraft(r,c,k,opts,text,reviewer){reviewed(r,c,k,opts);if(!r.draft||r.primaryCategory!=='general_qa'||r.compliance||optionsOf(opts).responseLow)throw Error('No supported member draft is eligible.');const accepted=base.approveDraft({...r,state:'awaiting_approval',fingerprint:base.fingerprint(c,k)},c,k,{...optionsOf(opts),shadow:false},text,reviewer);return {...accepted,approval:{...accepted.approval,outputRevision:r.outputRevision,elapsedSeconds:(Date.now()-r.reviewStartedAt)/1000}};}
export function editOutput(r){if(r.execution)throw Error('An action is already recorded.');return {...r,approval:null,summaryApproval:null,outputRevision:r.outputRevision+1,state:r.draft?'awaiting_approval':r.action==='route'?'awaiting_summary_review':'manual'};}
export function approveSummary(r,c,k,opts,summary,reviewer){reviewed(r,c,k,opts);if(r.draft)throw Error('Review the member draft instead.');const keys=['issue','context','unknowns','nextSteps'];if(keys.some(x=>!String(summary[x]||'').trim()))throw Error('Complete the issue, context, unknowns, and next steps.');if(base.sensitive(JSON.stringify(summary)))throw Error('Remove recognizable identifiers before approving internal assistance.');const selected=Object.fromEntries([...keys,...['concern','whyFlagged','team','productFeedback','productType','channel','productTeam'].filter(x=>summary[x])].map(x=>[x,String(summary[x]).trim()]));return {...r,internalSummary:selected,summaryApproval:{reviewer,exactSummary:JSON.stringify(selected),outputRevision:r.outputRevision,at:now(),elapsedSeconds:(Date.now()-r.reviewStartedAt)/1000},state:r.action==='route'?'awaiting_handoff':'manual_reviewed'};}
export function deliver(r,c,k,opts,{outcome='acknowledged',ledger}={}){const key=executionGate(r,c,k,opts,ledger);if(r.compliance||!r.approval||r.approval.outputRevision!==r.outputRevision)throw Error('Exact, current member-response approval required.');const n=base.deliver({...r,fingerprint:base.fingerprint(c,k)},c,k,optionsOf(opts),{outcome});ledger?.set(key,n.execution);return n;}
export function confirmHandoff(r,c,k,opts,{ledger}={}){const key=executionGate(r,c,k,opts,ledger);if(!r.summaryApproval||r.summaryApproval.exactSummary!==JSON.stringify(r.internalSummary)||r.summaryApproval.outputRevision!==r.outputRevision)throw Error('Review and approve this exact internal summary before confirming the handoff.');const n=base.confirmHandoff({...r,fingerprint:base.fingerprint(c,k)},c,k,optionsOf(opts));ledger?.set(key,n.execution);return {...n,routedTeam:r.primaryCategory==='product_feedback'&&!r.compliance?productDetails(c).team:r.destination};}
export function safeAudit(r,event,reviewer){return {event,caseId:r.caseId,caseVersion:r.version,engineVersion,policyVersion,primaryCategory:r.primaryCategory,originalCategory:r.originalCategory,riskFlags:r.classification.riskFlags,classificationStatus:r.classification.status,state:r.state,outputRevision:r.outputRevision,routedTeam:r.routedTeam||null,sourceSnapshot:r.sourceSnapshot,sources:r.sources,reviewer,approvalAt:r.approval?.at||r.summaryApproval?.at||null,actionId:r.execution?.actionId||null,outcome:r.execution?.status||null,at:now()};}
export function adaptDevelopmentCase(c){return {id:c.case_id,case_version:c.case_version,status:'open',priority:c.existing_priority,created_at:c.intake_at,updated_at:c.as_of,as_of:c.as_of,product_area:c.product_area,channel:c.channel,conversation:c.conversation,access_context:c.access_context,internal_notes:[],timeline:[],member:{display_name:'Synthetic member',permitted_profile:{member_ref:'DEVELOPMENT'}},owner:{name:'Alex Morgan',team:'Customer Support'},retrieval_fixture:{candidate_source_ids:c.retrieval_fixture.source_ids},dependencies:c.dependencies,historyCandidateIds:c.retrieval_fixture.history_candidate_ids};}
export function developmentOptions(c){const d=c.dependencies;return optionsOf({failure:['model','knowledge','profile','ticketing','history'].find(k=>d[k]==='unavailable')||'none',shadow:c.operating_mode==='shadow'});}
export function outputType(r){return r.draft?'member_draft':r.action==='route'&&r.primaryCategory==='product_feedback'?'product_summary':r.action==='route'&&r.primaryCategory==='compliance'?'compliance_summary':'manual_assessment';}

// Current demo: automatic classification, human output approval. The legacy
// acceptance functions remain available to exercise the earlier RFC workflow.
export function assignAutomatically(r,opts={}){
 const unresolved=r.primaryCategory==='unknown'||opts.low||opts.failure==='model';
 return {...r,classificationRequired:false,classification:{...r.classification,status:unresolved?'unassigned':'assigned',assignedBy:'AI simulation',assignedAt:now(),review:null},state:unresolved?'manual':r.draft?'awaiting_approval':r.action==='route'?'awaiting_summary_review':'manual',draft:unresolved?null:r.draft,trace:[...r.trace.filter(t=>t.stage!=='Human review'),{stage:'Automatic assignment',detail:unresolved?'Unassigned; manual category selection is available.':'Category assigned by the simulated classifier. No agent approval requested.'},{stage:'Human output review',detail:'Approve the exact output, then separately confirm any simulated send or handoff.'}]};
}
export function routeManually(r,c,k,opts,reviewer,category,reason){
 current(r,c,k,opts);
 if(r.execution)throw Error('This version already has an action receipt. Add new case context before rerouting.');
 if(!categories[category])throw Error('Choose a valid category.');
 if(!reason.trim())throw Error('Add a short reason for changing the route.');
 if(r.compliance&&category!=='compliance')throw Error('This case has a compliance flag. Routing remains restricted to Compliance / Legal; report the classification if it is incorrect.');
 const changed=category!==r.primaryCategory,compliance=r.compliance||category==='compliance';
 const destination=compliance?'Compliance / Legal':category==='product_feedback'?'Product':'Customer Support';
 const draft=changed||category==='unknown'?null:r.draft;
 const policyId=compliance?'POL-02':category==='product_feedback'?'POL-01':'POL-03';
 const policy=permittedKnowledge(c,k).find(s=>s.id===policyId&&s.status==='approved');
 const sources=opts.failure==='knowledge'?[]:[...r.sources.filter(s=>s.id!==policyId),...(policy?[{id:policy.id,title:policy.title,version:policy.version}]:[])];
 const n={...r,primaryCategory:category,category,label:categories[category],compliance,destination,draft,source:draft?r.source:null,sources,similar:changed?[]:r.similar,approval:null,summaryApproval:null,outputRevision:r.outputRevision+1,action:draft?'draft':['compliance','product_feedback'].includes(category)?'route':'escalate',reason:'MANUALLY_ROUTED',classificationRequired:false,classification:{...r.classification,status:category==='unknown'?'unassigned':'accepted',assignedBy:reviewer,riskFlags:[...new Set([...r.classification.riskFlags,...(compliance?['human_compliance_flag']:[])])],review:{reviewer,category,reason:redact(reason),priority:c.priority,corrected:changed,at:now()}},steps:[{id:'manual-route',text:category==='unknown'?'Investigate the original conversation and assign a category.':`Review the original conversation and current guidance with ${destination}.`,policy:policyId}]};
 n.internalSummary=internalSummary(c,n);n.state=draft?'awaiting_approval':n.action==='route'?'awaiting_summary_review':'manual';
 n.handoff={case_ref:c.id,category,reason_code:'MANUALLY_ROUTED',priority:c.priority,context:'Review the original under existing case permissions.'};
 return n;
}
export function summaryText(summary){if(summary.text!==undefined)return summary.text;if(summary.productFeedback)return `Summary of Product Feedback\n${summary.productFeedback}\n\nProduct type\n${summary.productType}\n\nIntake channel\n${summary.channel}\n\nProduct team\n${summary.productTeam} (demo ownership)\n\nNext steps\nReview the feedback and route to the ${summary.productTeam} team for product assessment. No delivery date or feature commitment has been made.`;return `${summary.concern?`Compliance concern\n${summary.concern}\n\nWhy flagged\n${summary.whyFlagged}\n\nTeam to involve\n${summary.team}\n\n`:''}Reported issue\n${summary.issue}\n\nRelevant context\n${summary.context}\n\nEvidence gaps\n${summary.unknowns}\n\nNext steps\n${summary.nextSteps}`;}
export function approveSummaryText(r,c,k,opts,text,reviewer){
 current(r,c,k,opts);if(r.execution)throw Error('An action is already recorded.');if(r.draft)throw Error('Review the member response instead.');
 if(!text.trim())throw Error('Add a summary before approving.');if(base.sensitive(text))throw Error('Remove recognizable identifiers before approving internal assistance.');
 const summary={text:text.trim()};return {...r,internalSummary:summary,summaryApproval:{reviewer,exactSummary:JSON.stringify(summary),outputRevision:r.outputRevision,at:now(),elapsedSeconds:(Date.now()-r.reviewStartedAt)/1000},state:r.action==='route'?'awaiting_handoff':'manual_reviewed'};
}
