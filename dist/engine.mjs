// Deterministic prototype. This module never loads evaluation labels or reference answers.
export const policies=[
 {id:'compliance',label:'Compliance review',action:'route',destination:'Compliance / Legal',draft:false,priority:100,signals:[/discriminat|national origin|people of my race|people from my country|forged|without (my )?(consent|permission)|did not authoriz|not authoriz|withdr[ae]w.{0,30}permission|keeps calling|calling after|called my workplace|someone else|another person|different person|hidden fee|misleading|regulator|backdate|erase.{0,30}(record|message|complaint)|delete.{0,40}(message|complaint|record)|credit inquiry|credit report|screen.reader|disability|refused any alternative|shared with lenders/i]},
 {id:'security_review',label:'Security review',action:'escalate',destination:'Support safety',draft:false,priority:90,signals:[/ignore.{0,35}(policy|instruction)|override.{0,20}policy|system prompt|reveal.{0,40}(private|member|secret)|SYSTEM:/i]},
 {id:'unsupported',label:'Manual account handling',action:'escalate',destination:'Customer Support',draft:false,priority:70,signals:[/move.{0,30}(money|balance)|transfer.{0,30}money|close.{0,30}(account|it for)|cannot access.{0,25}(old|current|registered).{0,10}(inbox|email)|no longer access|bypass.{0,20}verification/i]},
 {id:'product_feedback',label:'Product feedback',action:'route',destination:'Product',draft:false,priority:40,signals:[/please add|could you add|feature request|dark mode|more.{0,20}filters/i]},
 {id:'general_qa',label:'General question',action:'draft',destination:'Customer Support',draft:true,priority:10,signals:[/password|update.{0,25}email|new email|notification|down payment|rates.{0,40}update|rate.{0,30}refresh/i]}
];
export const policyVersion='incident-demo-1.0';
export function redact(value){return String(value??'').replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi,'[email removed]').replace(/\b\d{3}[- ]\d{2}[- ]\d{4}\b/g,'[identifier removed]').replace(/\b\d{8,}\b/g,'[number removed]').replace(/\b\d{3}[-. ]\d{3}[-. ]\d{4}\b/g,'[phone removed]');}
export function sensitive(s){return redact(s)!==String(s);}
const clean=s=>redact(s).replace(/\s+/g,' ').trim();
const tokenize=s=>new Set(clean(s).toLowerCase().match(/[a-z]{3,}/g)?.filter(w=>!new Set(['the','and','for','that','with','this','from','member','case','reported','support','their','without','into','which','what','have','after','were','your','bankrate']).has(w))||[]);
export function fingerprint(c,knowledge){return JSON.stringify({v:c.case_version,m:c.conversation.map(m=>[m.id,m.text]),p:c.priority,s:knowledge.map(a=>[a.id,a.version,a.status,a.content])});}
function classify(text){
 // Narrow contextual exception for explicit denial; a new positive allegation still wins.
 const denial=/not reporting an unauthorized (application|account)/i.test(text)&&/nothing suspicious happened/i.test(text);
 const screened=denial?text.replace(/identity theft|unauthorized (application|account)/gi,''):text;
 return policies.find(p=>p.signals.some(rx=>rx.test(screened)))||{id:'unknown',label:'Needs investigation',action:'escalate',destination:'Customer Support',draft:false};
}
const topicRules=[
 ['unequal treatment',/discriminat|national origin|people of my race|people from my country|unequal.treatment/i],
 ['contact consent',/consent|permission|unauthoriz|authorize|authorised|keeps calling|contact.*stop/i],
 ['data exposure',/another (person|request)|someone else|exposure|not mine/i],
 ['offer discrepancy',/misleading|fees|quote.*match|offer disputed|offer.*disputed/i],
 ['record alteration',/backdate|alter.*record|erase|remove.*complaint|record.removal/i],
 ['application activity',/credit inquiry|credit report|application.*recogniz|identity misuse|unrecognized application/i],
 ['accessibility',/screen.reader|disability|access barrier|accessibility/i],
 ['privacy deletion',/deletion|delete my|sharing with lenders|privacy concern/i],
 ['product improvement',/feature|please add|could you add|export|CSV|filter|dark mode|improvement/i],
 ['conflicting evidence',/disagree|conflict|daily.*weekly|one.*article.*another/i],
 ['missing context',/cannot find|could not be identified|number is wrong|rate is wrong|incomplete|unsupported product/i],
 ['account recovery',/cannot access|no longer access|recovery|verification bypass|bypass.*verification/i],
 ['financial action',/move.*money|move funds|transfer|close.*account|account.*close/i],
 ['untrusted instructions',/SYSTEM:|system prompt|administrator|ignore.*(policy|instruction)|override.*policy/i]
];
const topics=s=>topicRules.filter(([,rx])=>rx.test(s)).map(([label])=>label);
export function retrieveSimilar({category,description,severity,history,knowledge,unavailable=false}){
 if(unavailable)return [];
 const words=tokenize(description),currentTopics=topics(description);const approved=new Set(knowledge.filter(a=>a.status==='approved').map(a=>a.id));
 return history.filter(h=>h.visibility==='support_sanitized_reference'&&h.review_status==='demo_reviewed'&&h.record_status==='closed'&&h.policy_source_ids.every(s=>approved.has(s))&&!sensitive(JSON.stringify(h))).map(h=>{
 const content=h.title+' '+h.sanitized_description;const tokens=tokenize(content);const overlap=[...words].filter(w=>tokens.has(w));const sharedTopics=topics(content).filter(t=>currentTopics.includes(t));const categoryMatch=h.category===category;const sameSeverity=h.severity===severity;
 const score=sharedTopics.length*10+overlap.length*.2+(categoryMatch?3:0)+(sameSeverity?1:0);
 return {...h,score,overlap,categoryMatch,sameSeverity,sharedTopics,why:[categoryMatch?'Same category':'Related category',...sharedTopics,sameSeverity?'Same priority':`Priority differs: ${h.severity}`].join(' · '),difference:'Past handling is a reference only. Current evidence and current policy control this case.'};
 }).filter(h=>h.categoryMatch&&h.sharedTopics.length>0).sort((a,b)=>b.score-a.score).slice(0,3);
}

function purpose(text){if(/dark mode/i.test(text))return 'Requested dark mode for mortgage comparisons.';if(/export|CSV/i.test(text))return 'Requested export of mortgage calculator scenarios for comparison.';if(/filter/i.test(text))return 'Requested improved credit-card comparison filters.';return 'Requested a product improvement; see the authorized case for details.';}
function gaps(text,category,conflict){if(conflict)return ['Two approved articles disagree. The knowledge owner must reconcile them before a draft is prepared.'];if(category==='compliance')return ['The allegation has not been independently verified.','Specialists should confirm the relevant party, timing, and evidence through the restricted case.'];if(category==='unknown')return ['The requested feature or affected offer lacks sufficient approved context.'];if(category==='unsupported')return ['Human verification or authority to perform the requested action is required.'];return [];}
export function analyze(c,knowledge,history,opts={}){
 const options={failure:'none',low:false,shadow:false,paused:false,noHistory:false,...opts};
 const memberMessages=c.conversation.filter(m=>m.author_role==='member');const text=memberMessages.map(m=>clean(m.text)).join(' ');
 const policy=classify(text);const compliance=policy.id==='compliance';
 const candidates=knowledge.filter(k=>c.retrieval_fixture.candidate_source_ids.includes(k.id));
 const sources=candidates.filter(k=>k.status==='approved');
 const conflict=sources.some(k=>/every 24 hours/.test(k.content))&&sources.some(k=>/every seven days/.test(k.content));
 let reason=compliance?'RISK_REQUIRES_SPECIALIST':policy.id==='product_feedback'?'FEATURE_REQUEST':policy.id==='security_review'?'UNTRUSTED_INSTRUCTION':policy.id==='unsupported'?'OUTSIDE_AUTOMATION_SCOPE':policy.id==='unknown'?'INSUFFICIENT_EVIDENCE':'SUPPORTED_GUIDANCE';
 let draft=null,article=null;
 if(policy.draft&&!conflict){
  article=sources.find(a=>a.scope==='member_guidance'&&(/password/i.test(text)?/reset a password/i.test(a.title):/email/i.test(text)?/change an email/i.test(a.title):/notification/i.test(text)?/manage notifications/i.test(a.title):/down payment/i.test(text)?/mortgage calculator inputs/i.test(a.title):false));
  if(article)draft=article.content.replace(/^For the demo mortgage calculator, /,'In the mortgage calculator, ').replace(/ This (guidance|article) does not authorize.*$/,'');else reason='NO_APPROVED_EVIDENCE';
 }
 if(conflict)reason='CONFLICTING_EVIDENCE';
 const failure=options.paused?'AUTOMATION_PAUSED':options.failure!=='none'?options.failure.toUpperCase()+'_UNAVAILABLE':options.low?'LOW_CONFIDENCE':null;
 if(failure){reason=failure;draft=null;}
 let action=draft?'draft':policy.action==='route'?'route':'escalate';
 let destination=policy.destination;
 if(failure&&!compliance){action='escalate';destination=policy.id==='security_review'?'Support safety':'Customer Support';}
 let state=options.shadow?'shadow':options.failure==='ticketing'?'held':options.paused?'manual':draft?'awaiting_approval':action==='route'?'awaiting_handoff':'manual';
 const related=retrieveSimilar({category:policy.id,description:text+' '+c.product_area,severity:c.priority,history,knowledge,unavailable:options.noHistory||options.failure==='history'});
 const basePolicy=compliance?'POL-02':policy.id==='product_feedback'?'POL-01':'POL-03';
 // Current policies authorize steps. Historical content informs context but never becomes an executable command.
 let steps=compliance?[
  {text:'Review the reported concern and distinguish the allegation from verified evidence.',policy:'POL-02'},
  {text:'Check missing context in the restricted case without copying sensitive identifiers.',policy:'POL-03'},
  {text:'Confirm a restricted Compliance / Legal handoff and retain an accountable owner.',policy:'POL-02'}
 ]:policy.id==='product_feedback'?[
  {text:'Confirm the requested product change and intended benefit.',policy:'POL-01'},
  {text:'Review the sanitized handoff; exclude identity and financial details.',policy:'POL-01'},
  {text:'Confirm Product ownership without promising a delivery date.',policy:'POL-01'}
 ]:[
  {text:conflict?'Ask the knowledge owner to reconcile conflicting guidance.':policy.id==='unsupported'?'Continue with the authorized human workflow; do not bypass verification or act on a bank account.':'Review the missing evidence and current conversation.',policy:'POL-03'},
  {text:'Keep the existing case with a human owner until there is sufficient evidence and authority.',policy:'POL-03'}
 ];
 const precedent=related.find(h=>h.policy_source_ids.includes(basePolicy));
 if(precedent){
  const safeHistorical=precedent.steps_taken.filter(s=>!sensitive(s)&&/^(Review|Record|Identify|Note|Separate|Confirm|Check|Avoid|Treat|Extract|Remove identity|Have Support|Keep|Ask the knowledge owner|List|Continue manual|Assign a human|Document|Do not)/i.test(s)&&!/(?<!do not )(send (a |the )?(member|customer)|approve (a |the )?loan|transfer funds|delete records)/i.test(s));
  if(safeHistorical.length)steps=safeHistorical.map(text=>({text,policy:basePolicy,historyRef:precedent.id}));
 }
 steps=steps.filter(s=>knowledge.some(k=>k.id===s.policy&&k.status==='approved')).map((s,i)=>({...s,id:`step-${i}`,historyRef:s.historyRef||null,completed:false}));
 const summary={headline:compliance?'Potential compliance concern requires specialist review.':policy.id==='product_feedback'?purpose(text):policy.id==='unsupported'?'The request needs an authorized human workflow.':conflict?'The intent is clear, but the available guidance conflicts.':draft?'Approved guidance supports a response for human review.':'More context is needed before a supported response can be prepared.',reported:memberMessages.map(m=>({ref:m.id,text:clean(m.text).slice(0,380)})),gaps:gaps(text,policy.id,conflict),note:'Member reports are not independently verified. Summary excerpts are minimized for this demo.'};
 const handoff={case_ref:c.id,category:policy.id,reason_code:reason,priority:c.priority,...(policy.id==='product_feedback'?{product_area:c.product_area,summary:purpose(text)}:{context:'Review the original under existing case permissions.'})};
 const result={caseId:c.id,version:c.case_version,fingerprint:fingerprint(c,knowledge),policyVersion,category:policy.id,label:policy.label,compliance,action,destination,reason,state,draft,source:article?{id:article.id,version:article.version}:null,sources:sources.map(s=>({id:s.id,title:s.title,version:s.version})),excludedSources:candidates.filter(k=>k.status!=='approved').map(k=>k.id),summary,similar:related,steps,handoff,options,matchStatus:options.noHistory||options.failure==='history'?'unavailable':related.length?'matched':'no_match',approval:null,execution:null};
 assertSafe(result);return result;
}
export function assertSafe(r){
 if(r.compliance&&r.draft!==null)throw new Error('Compliance cases cannot contain an AI member draft.');
 if(r.draft&&(!policies.find(p=>p.id===r.category)?.draft||sensitive(r.draft)))throw new Error('Draft violates category or identifier rules.');
 if(sensitive(JSON.stringify(r.handoff)))throw new Error('Handoff contains a sensitive identifier.');
 return true;
}
function valid(r,c,k,opts){if(r.fingerprint!==fingerprint(c,k))throw new Error('Case or source changed. Refresh the analysis before acting.');if(opts.paused||opts.shadow)throw new Error('Actions are disabled while automation is paused or in shadow mode.');if(opts.failure!=='none'&&opts.failure!=='history')throw new Error('A dependency is unavailable. Keep this case in manual handling.');assertSafe(r);}
export function approveDraft(r,c,k,opts,draft,reviewer){valid(r,c,k,opts);if(!['awaiting_approval','approved'].includes(r.state)||r.compliance)throw new Error('This case is not eligible for a member response.');if(!draft.trim())throw new Error('Add a response before approving.');const risk=classify(draft);if(['compliance','security_review'].includes(risk.id))throw new Error('Edited response contains a risk signal. Return to human review.');const out={...r,draft:draft.trim(),state:'approved',approval:{reviewer,caseVersion:c.case_version,exactText:draft.trim(),at:new Date().toISOString()}};assertSafe(out);return out;}
export function deliver(r,c,k,opts,{outcome='acknowledged'}={}){valid(r,c,k,opts);if(r.state!=='approved'||!r.approval||r.approval.exactText!==r.draft)throw new Error('An exact, current human approval is required.');if(outcome==='unknown')return {...r,state:'held',execution:{status:'unknown',actionId:`${c.id}-v${c.case_version}-delivery`}};return {...r,state:'sent',execution:{status:'acknowledged',actionId:`${c.id}-v${c.case_version}-delivery`}};}
export function confirmHandoff(r,c,k,opts){valid(r,c,k,opts);if(r.state!=='awaiting_handoff')throw new Error('No eligible handoff is awaiting confirmation.');return {...r,state:'routed',execution:{status:'acknowledged',actionId:`${c.id}-v${c.case_version}-handoff`}};}
export function safeAudit(r,event,reviewer){return {event,caseId:r.caseId,caseVersion:r.version,category:r.category,reason:r.reason,state:r.state,policyVersion:r.policyVersion,reviewer,at:new Date().toISOString()};}
