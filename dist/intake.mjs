// Demo intake contains editable examples, never expected classification labels.
export const productAreas=['Mortgage calculator','Mortgage rate comparison','Lender contact request','Credit-card comparison','Bankrate member account','Other'];
export const intakeExamples=[
 {id:'calculator',label:'General FAQ · mortgage calculator help',name:'Maya Chen',title:'How do I change my down payment?',product:'Mortgage calculator',priority:'P3',message:'I am using the Bankrate mortgage calculator. How do I change the down payment to compare the estimated monthly payment? I only need help using the calculator.'},
 {id:'comparison',label:'Product feedback · comparison feature',name:'Jordan Lee',title:'Add dark mode to mortgage comparisons',product:'Mortgage rate comparison',priority:'P3',message:'Could you add dark mode to the mortgage rate comparison page? I compare options in the evening and would find a darker display easier to read.'},
 {id:'contact',label:'Compliance-sensitive · unwanted lender calls',name:'Samira Ellis',title:'Lender calls continued after I withdrew permission',product:'Lender contact request',priority:'P2',message:'A lender I contacted through Bankrate keeps calling after I asked them to stop. I withdrew my permission last week, but they called again today. Please review this complaint.'}
];
export function retrieveIntakeSources(message,knowledge){
 const queries=[[/password|reset|sign.in/i,/reset a password/i],[/email|inbox/i,/change an email/i],[/notification|marketing preferences/i,/manage notifications/i],[/down payment|mortgage calculator|payment estimate/i,/mortgage calculator inputs/i],[/savings.*rate|rates.*updat|rate.*refresh/i,/rate|refresh|savings/i]];
 return knowledge.filter(s=>s.scope!=='member_guidance'||queries.some(([query,title])=>query.test(message)&&title.test(s.title))).map(s=>s.id);
}
export function buildIntakeCase(fields,{id,knowledge,at=new Date().toISOString()}){
 const clean=key=>String(fields[key]??'').trim();const name=clean('name'),title=clean('title'),message=clean('message'),product=clean('product'),priority=clean('priority');
 if(!name||!title||!message)throw Error('Enter a member name, subject, and message.');
 if(name.length>80||title.length>120||message.length>4000)throw Error('Keep the name under 80, subject under 120, and message under 4,000 characters.');
 if(!productAreas.includes(product)||!['P1','P2','P3'].includes(priority))throw Error('Choose a product area and priority.');
 return {id,synthetic:true,createdInDemo:true,title,case_version:1,status:'open',priority,owner:{name:'Alex Morgan',team:'Customer Support'},channel:'demo_intake',product_area:product,created_at:at,updated_at:at,as_of:at,member:{display_name:name,permitted_profile:{member_ref:'DEMO-'+id,authenticated_upstream:true}},conversation:[{id:id+'-M1',at,author_role:'member',author_name:name,visibility:'restricted_case',text:message}],internal_notes:[],timeline:[{id:id+'-E1',at,type:'case_created',actor:'Demo intake'},{id:id+'-E2',at,type:'message_added',actor:'Member',message_ref:id+'-M1'}],retrieval_fixture:{candidate_source_ids:retrieveIntakeSources(message,knowledge),query_basis:'submitted_message',note:'Keyword retrieval over synthetic guidance; no preset category supplied.'}};
}
