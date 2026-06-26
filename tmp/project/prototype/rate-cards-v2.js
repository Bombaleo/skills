/* ================================================
   Settings · Rate Cards  (window.RC2)   ·  v1.00
   New flow: Upload (step 1, both files on one screen) → Review & edit
   (step 2, editable tables) → Publish (step 3, effective date).
   Card statuses: draft · uploading · validating pay/bill · require review · active · scheduled.
   Rate structure preview only shown for clean files.
   ===================================================================== */
(function () {
  "use strict";
  function P() { return window.Proto || {}; }
  function ico(n, c) { return P().ico ? P().ico(n, c) : ""; }
  function esc(s) { return P().escapeHtml ? P().escapeHtml(String(s == null ? "" : s)) : String(s == null ? "" : s); }
  function toast(m) { if (P().toast) P().toast(m); }
  function gbp(v) { return "\u00a3" + (Math.round(v * 100) / 100).toFixed(2); }
  function fi(el) { if (P().fillIcons) P().fillIcons(el); }
  function uniq(a) { var s={},o=[];a.forEach(function(v){if(!s[v]){s[v]=1;o.push(v);}});return o.sort(); }
  function fmtNum(n) { return (n||0).toLocaleString("en-GB"); }

  var TODAY = "2026-06-07";

  // ---- RNG -----------------------------------------------------------
  function hashStr(s) { var h=2166136261; for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0; }
  function mulberry32(a) { return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}; }

  // ---- engines -------------------------------------------------------
  var ENGINES = [
    { id:"evri",  name:"Evri",           legalEntity:"Evri UK Ltd",            kicker:"United Kingdom \u00b7 Staffing template",    version:"v4" },
    { id:"evrip", name:"Evri Premium",   legalEntity:"Evri Premium Ltd",           kicker:"United Kingdom \u00b7 premium markup band", version:"v2" },
  ];
  function engineById(id){ for(var i=0;i<ENGINES.length;i++) if(ENGINES[i].id===id) return ENGINES[i]; return ENGINES[0]; }

  // ---- rate data -----------------------------------------------------
  function srcRates(){ return window.PDF_RATES||[]; }
  function cardRows(card){
    if(!card.filter||!Object.keys(card.filter).length) return srcRates();
    return srcRates().filter(function(r){ var f=card.filter; if(f.jt&&r.jt!==f.jt)return false; if(f.jtPrefix&&String(r.jt).indexOf(f.jtPrefix)!==0)return false; return true; });
  }
  function premLift(card){ return card.engineId==="evrip"?0.35:0; }
  function payLines(card){ return cardRows(card).map(function(r){ return{s:r.s,loc:r.loc,jt:r.jt,hrs:r.hrs,pay:r.net,wtr:r.wtr,eni:r.eni,pen:r.pen,levy:r.levy,sick:r.sick,direct:r.direct}; }); }
  function billLines(card){ var lift=premLift(card); return cardRows(card).map(function(r){ var m=Math.round((r.margin+lift)*100)/100; return{s:r.s,loc:r.loc,jt:r.jt,eni:r.eni,pen:r.pen,levy:r.levy,direct:r.direct,margin:m,charge:Math.round((r.direct+m)*100)/100}; }); }

  // Apply per-row edits stored in draft.editedPay / editedBill
  function applyEdits(rows, edits) {
    if(!edits) return rows;
    return rows.map(function(r, i) {
      var e = edits[i]; return e ? Object.assign({}, r, e) : r;
    });
  }
  // For bill: charge = direct + margin (recompute when margin edited)
  function billRowWithEdit(r, edit) {
    if(!edit) return r;
    var m = edit.margin != null ? edit.margin : r.margin;
    return Object.assign({}, r, edit, { margin: m, charge: Math.round((r.direct + m)*100)/100 });
  }
  function applyBillEdits(rows, edits) {
    if(!edits) return rows;
    return rows.map(function(r, i){ return edits[i] ? billRowWithEdit(r, edits[i]) : r; });
  }

  // ---- validation error catalogue ------------------------------------
  var SAMPLE_S=["DCS Recruitment","Staffline Group","Pertemps","Gi Group","Extrastaff"];
  var SAMPLE_L=["Birmingham","Warrington","Rugby","Nuneaton","Barnsley"];
  var SAMPLE_R=["Cat C Day Driver","Cat C&E Night Driver","Warehouse Operative AM","Van Driver Day","Night Loader"];
  var VLD_ERRS=[
    {key:"missing_col",label:"Missing column",         sev:"error",col:"Header",       w:0, desc:"A required column is absent from the uploaded file"},
    {key:"nmw",    label:"Pay rate below NMW",      sev:"error",col:"Pay rate",      w:25,desc:"Rate is below the \u00a312.21 age-banded NMW floor"},
    {key:"missing",label:"Missing pay rate",         sev:"error",col:"Pay rate",      w:18,desc:"Pay rate cell is blank \u2014 every priced line needs a rate"},
    {key:"role",   label:"Unknown position",         sev:"error",col:"Role",          w:13,desc:"Role code is not in the position catalogue"},
    {key:"site",   label:"Unmapped site",            sev:"error",col:"Site",          w:9, desc:"Site is not mapped to a configured location"},
    {key:"date",   label:"Invalid effective date",   sev:"error",col:"Effective date",w:8, desc:"Not a valid DD/MM/YYYY date"},
    {key:"billlt", label:"Bill rate below pay rate", sev:"error",col:"Bill rate",     w:5, desc:"Bill rate must cover pay rate plus on-costs"},
    {key:"dup",    label:"Duplicate rate line",      sev:"warn", col:"\u2014",        w:6, desc:"Duplicate of an earlier line for the same keys"},
    {key:"range",  label:"Rate outside range",       sev:"warn", col:"Pay rate",      w:4, desc:"Rate is far from comparable lines"},
  ];
  var VLD_TOT_W=0; VLD_ERRS.forEach(function(t){VLD_TOT_W+=t.w;});
  function genErrors(doc){
    if(doc._errors) return doc._errors;
    if(!doc.totalIssues){doc._errors=[];return doc._errors;}
    var rnd=mulberry32(doc._rndSeed||hashStr(doc.fileName+":"+doc.size)), errs=[], uid=0;
    VLD_ERRS.forEach(function(t){ var n=Math.round(doc.totalIssues*t.w/VLD_TOT_W); for(var i=0;i<n;i++) errs.push({id:uid++,line:2+Math.floor(rnd()*doc.rows),sev:t.sev,type:t.key,label:t.label,col:t.col, supplier:SAMPLE_S[Math.floor(rnd()*SAMPLE_S.length)],site:SAMPLE_L[Math.floor(rnd()*SAMPLE_L.length)],role:SAMPLE_R[Math.floor(rnd()*SAMPLE_R.length)],desc:t.desc}); });
    errs.sort(function(a,b){return a.line-b.line;}); doc._errors=errs; return errs;
  }
  function summarizeErrors(doc){ var errs=genErrors(doc),byType={},errN=0,warnN=0,lines={}; errs.forEach(function(e){byType[e.type]=(byType[e.type]||0)+1;if(e.sev==="error")errN++;else warnN++;lines[e.line]=1;}); return{total:errs.length,errN:errN,warnN:warnN,affected:Object.keys(lines).length,byType:byType}; }

  // ============================================================ state
  var RC2={};
  window.RC2=RC2;
  var S=null;
  var LS="flexwork-proto-rate-automation-rcv2-v4";
  var _vldTimers={};
  var _vlistData={};

  RC2.reset=function(){ RC2.state=null; Object.keys(_vldTimers).forEach(function(k){clearTimeout(_vldTimers[k]);}); _vldTimers={}; };

  // ---- public reads for the Agencies surface (Part C) ----------------
  // Resolve the rate card bound to an engine + its live version label, building
  // state on demand so these work even before the Rate Cards page has mounted.
  RC2.cardForEngine=function(eid){ if(!RC2.state)RC2._build(); S=RC2.state; return cardForEngine(eid); };
  RC2.liveVersionLabel=function(card){ if(!card)return null; var v=liveVer(card); return v?("v"+v.version):"v1"; };
  RC2.resolvedEngineVersion=function(eid){ return resolvedEngineVersion(eid); };

  function seedCards(){
    return[
      {id:"rc-evri", name:"Evri rate card",         engineId:"evri",  filter:{}, workingStatus:null, createdAt:"2026-01-20",
       versions:[{version:1,effectiveDate:"2026-02-01",appliedAt:"2026-01-28T09:12:00.000Z",note:"Baseline.",payFile:"Evri_pay_rates_v1.xlsx",billFile:"Evri_bill_rates_v1.xlsx"},{version:2,effectiveDate:"2026-06-01",appliedAt:"2026-05-29T09:12:00.000Z",note:"April NMW uplift.",payFile:"Evri_pay_rates_v2.xlsx",billFile:"Evri_bill_rates_v2.xlsx"}]},
      {id:"rc-evrip",name:"Evri Premium rate card", engineId:"evrip", filter:{}, workingStatus:null, createdAt:"2026-04-01",
       versions:[{version:1,effectiveDate:"2026-05-01",appliedAt:"2026-04-28T09:12:00.000Z",note:"Initial premium markup.",payFile:"EvriPremium_pay_rates_v1.xlsx",billFile:"EvriPremium_bill_rates_v1.xlsx"}]},
    ];
  }
  function loadCards(){ try{var r=localStorage.getItem(LS);if(r){var v=JSON.parse(r);if(Array.isArray(v))return v;}}catch(e){} return seedCards(); }
  function saveCards(){ try{localStorage.setItem(LS,JSON.stringify(S.cards));}catch(e){} }

  RC2._build=function(){
    RC2.state={ cards:loadCards(), view:"list", listViewMode:"table", selectedId:null, detailTab:"pay", detailFilters:{}, detailGroupBy:"none", detailSearch:"", detailRatesOpen:false, draft:null, expandedCardId:null, inlineVerKey:null, inlineVerTab:"pay", detailVersionId:null };
  };
  RC2.mount=function(root){
    RC2._root=root; if(!root) return;
    try{
      if(!RC2.state) RC2._build();
      S=RC2.state;
      // Always clear stale workingStatus so no row is ever blocked
      S.cards.forEach(function(c){ if(c.workingStatus&&c.workingStatus!=="active"&&c.workingStatus!=="scheduled"&&c.workingStatus!=="archived") c.workingStatus=null; });
      RC2._render(); RC2._wireOnce();
    }
    catch(err){ if(console&&console.error)console.error("[RC2]",err); root.innerHTML='<div style="padding:24px">'+ico("Alert")+' Rate Cards failed.</div>'; }
  };
  RC2._render=function(){
    if(!RC2._root) return; S=RC2.state;
    var html; try{ html=S.view==="new"?newView():S.view==="detail"?detailView():listView(); }catch(e){html='<div style="padding:24px;color:red">'+String(e)+'</div>';}
    RC2._root.innerHTML=html; fi(RC2._root); _attachErrLists();
  };

  function findCard(id){ for(var i=0;i<S.cards.length;i++) if(S.cards[i].id===id) return S.cards[i]; return null; }
  function cardForEngine(eid){ for(var i=0;i<S.cards.length;i++) if(S.cards[i].engineId===eid) return S.cards[i]; return null; }

  // ---- version timeline ----------------------------------------------
  function timeline(card){
    var vs=(card.versions||[]).slice().sort(function(a,b){return a.effectiveDate<b.effectiveDate?-1:a.effectiveDate>b.effectiveDate?1:a.version-b.version;});
    var ai=-1; vs.forEach(function(v,i){if(v.effectiveDate<=TODAY)ai=i;});
    return vs.map(function(v,i){var st=i<ai?"archived":i===ai?"active":"scheduled";return Object.assign({},v,{status:st,endDate:i<vs.length-1?vs[i+1].effectiveDate:null});});
  }
  function liveVer(card){var tl=timeline(card);for(var i=tl.length-1;i>=0;i--)if(tl[i].status==="active")return tl[i];return tl[tl.length-1]||null;}
  function fmtDay(iso){
    if(typeof iso==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(iso)){var p=iso.split("-");return new Date(+p[0],+p[1]-1,+p[2]).toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"});}
    try{return new Date(iso).toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"});}catch(e){return "";}
  }
  function crumb(parts){var h='<div class="proto-crumbs">';parts.forEach(function(p,i){if(i)h+=ico("ChevronRight");h+=p.act?'<button class="proto-crumb" data-rc2="'+p.act+'">'+esc(p.label)+'</button>':'<span class="proto-crumb-cur">'+esc(p.label)+'</span>';});return h+'</div>';}

  // ---- card status ---------------------------------------------------
  var STATUS_META = {
    draft:          { label:"Draft",                   cls:"is-superseded",   spin:false },
    uploading:      { label:"Uploading\u2026",          cls:"rc2-st--uploading",spin:true  },
    validating_pay: { label:"Validating pay rates",    cls:"rc2-st--validating",spin:true  },
    validating_bill:{ label:"Validating bill rates",   cls:"rc2-st--validating",spin:true  },
    require_review: { label:"Requires review",         cls:"rc2-st--review",   spin:false },
    active:         { label:"Active",                  cls:"is-active",        spin:false },
    scheduled:      { label:"Scheduled",               cls:"is-scheduled",     spin:false },
    archived:       { label:"Archived",                cls:"is-archived",      spin:false },
  };
  function resolveCardStatus(card) {
    // Check live draft for this card
    if (S.draft && (S.draft.cardId===card.id || (S.draft.mode==="new" && !card.versions.length))) {
      return deriveDraftStatus(S.draft);
    }
    // Persisted working status
    if (card.workingStatus) return card.workingStatus;
    // Derive from versions
    if (!card.versions||!card.versions.length) return "draft";
    var tl=timeline(card), act=tl.filter(function(v){return v.status==="active";})[0];
    if (act) return "active";
    var sch=tl.filter(function(v){return v.status==="scheduled";})[0]; return sch?"scheduled":"archived";
  }
  function deriveDraftStatus(d) {
    var pay=d.pay,bill=d.bill;
    if ((pay&&pay.phase==="validating")||(bill&&bill.phase==="validating")) {
      return pay&&pay.phase==="validating"?"validating_pay":"validating_bill";
    }
    if ((pay&&pay.totalIssues>0)||(bill&&bill.totalIssues>0)) return "require_review";
    if (!pay&&!bill) return "uploading";
    return "uploading";
  }
  function statusBadge(st) {
    var m=STATUS_META[st]||STATUS_META.draft;
    return '<span class="proto-ver-badge '+m.cls+'">'+(m.spin?'<span class="rc2-spin-xs"></span>':'')+m.label+'</span>';
  }
  function setCardWorkingStatus(card, st) { card.workingStatus=st; saveCards(); }

  // ============================================================ LIST
  function docChip(ok,label){return'<span class="rc2-doc rc2-doc--'+(ok?"ok":"miss")+'">'+ico(ok?"Check":"Alert")+label+'</span>';}
  function cardRow(card){
    var live=liveVer(card),st=resolveCardStatus(card),lines=cardRows(card).length;
    return'<button class="rc2-card-row" data-rc2="open" data-id="'+card.id+'">'+
      '<div class="rc2-cr-header">'+
        '<div class="rc2-cr-left"><span class="rc2-cr-name">'+esc(card.name)+'</span>'+(live?'<span class="rc2-cr-meta">v'+live.version+' \u00b7 from '+fmtDay(live.effectiveDate)+' \u00b7 '+lines+' lines</span>':'')+'</div>'+
        '<div class="rc2-cr-right">'+docChip(true,"Pay")+docChip(true,"Bill")+ico("ChevronRight","rc2-cr-chev")+'</div>'+
      '</div>'+
    '</button>';
  }
  function engineSection(engine){
    var card=cardForEngine(engine.id),live=card?liveVer(card):null;
    return'<section class="rc2-engine">'+
      '<div class="rc2-engine-head"><span class="rc2-engine-ico">'+ico("DataGridView")+'</span>'+
        '<div class="rc2-engine-id"><h2 class="rc2-engine-name">'+esc(engine.name)+' <span class="rc2-engine-ver">'+resolvedEngineVersion(engine.id)+'</span></h2><span class="rc2-engine-kicker">'+esc(engine.kicker)+'</span></div>'+
        (card?'<div class="rc2-engine-active"><span class="rc2-engine-active-l">Active rate card</span><span class="rc2-engine-active-v">'+esc(card.name)+(live?' \u00b7 v'+live.version:'')+'</span></div>'
          :'<button class="proto-btn proto-btn--primary rc2-engine-add" data-rc2="new" data-engine="'+engine.id+'">'+ico("AddCircle")+'New rate card</button>')+
      '</div>'+
      (card?cardRow(card):'<div class="rc2-empty-engine">'+ico("CreditCard","rc2-empty-ico")+'<div class="rc2-empty-t">No rate card yet</div><div class="rc2-empty-s">Upload a pay rate card and a bill rate card to activate '+esc(engine.name)+' pricing.</div><button class="proto-btn proto-btn--primary rc2-empty-cta" data-rc2="new" data-engine="'+engine.id+'">'+ico("AddCircle")+'New rate card</button></div>')+
    '</section>';
  }
  function allCovered(){return ENGINES.every(function(e){return S.cards.some(function(c){return c.engineId===e.id;});});}
  function inlineDetailPanel(card){
    var tl=timeline(card).slice().reverse();
    var stMeta={active:{label:"Active",cls:"is-active"},scheduled:{label:"Scheduled",cls:"is-scheduled"},archived:{label:"Archived",cls:"is-archived"}};
    var rows=tl.map(function(v){
      var sm=stMeta[v.status]||{label:v.status,cls:"is-archived"};
      var dateRange=v.status==="scheduled"?"From "+fmtDay(v.effectiveDate):fmtDay(v.effectiveDate)+(v.endDate?" \u2013 "+fmtDay(v.endDate):" \u2013 present");
      var files=[v.payFile?'<span class="rc2-inline-file">'+ico("Excel")+esc(v.payFile)+'</span>':'',v.billFile?'<span class="rc2-inline-file">'+ico("Excel")+esc(v.billFile)+'</span>':''].filter(Boolean).join('');
      return'<tr class="rc2-inline-ver-row" data-rc2="open-ver" data-id="'+card.id+'" data-ver="'+v.version+'">'+
        '<td><span class="rc2-tbl-card-name">'+esc(card.name)+'</span></td>'+
        '<td><span class="rc2-ver-no">v'+v.version+'</span></td>'+
        '<td><span class="proto-ver-badge '+sm.cls+'">'+sm.label+'</span></td>'+
        '<td>'+dateRange+'</td>'+
        '<td>'+files+'</td>'+
        '<td class="rc2-inline-ver-chev">'+ico("ChevronRight")+'</td>'+
      '</tr>';
    }).join('');
    return'<tr class="rc2-inline-row"><td colspan="8">'+
      '<div class="rc2-inline-panel">'+
        '<div class="rc2-inline-head">'+
          '<span class="rc2-inline-title">'+esc(card.name)+' \u00b7 Version history</span>'+
          '<div class="rc2-inline-actions">'+
            '<button class="proto-btn proto-btn--primary rc2-inline-newver" data-rc2="newver-inline" data-id="'+card.id+'">'+ico("FileUpload")+'Upload new version</button>'+
            '<button class="rc2-inline-close" data-rc2="toggle-expand" data-id="'+card.id+'" aria-label="Close">'+ico("Cancel")+'</button>'+
          '</div>'+
        '</div>'+
        '<div class="proto-table-wrap"><table class="proto-table rc2-inline-table"><thead><tr><th>Rate card</th><th>Version</th><th>Status</th><th>Effective</th><th>Files</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
      '</div>'+
    '</td></tr>';
  }

  function tableListView(){
    var trs=ENGINES.map(function(engine){
      var card=cardForEngine(engine.id),live=card?liveVer(card):null,lines=card?cardRows(card).length:0;
      var st=card?resolveCardStatus(card):null;
      var isExpanded=S.expandedCardId===( card&&card.id);
      var locked=st==="uploading"||st==="validating_pay"||st==="validating_bill";
      var needsReview=st==="require_review";
      var engineCell='<td><div class="rc2-tbl-engine"><span class="rc2-tbl-engine-ico">'+ico("DataGridView")+'</span><div class="rc2-tbl-engine-info"><div class="rc2-tbl-engine-name">'+esc(engine.name)+'</div><div class="rc2-tbl-engine-kicker">'+esc(engine.kicker)+'</div></div></div></td>';
      var verCell='<td><span class="rc2-engine-ver">'+resolvedEngineVersion(engine.id)+'</span></td>';
      var cardCell=card?'<td><span class="rc2-tbl-card-name">'+esc(card.name)+'</span></td>':'<td><span class="rc2-tbl-none">&mdash;</span></td>';
      var activeCell=live&&live.note?'<td class="rc2-tbl-active-note">'+esc(live.note)+'</td>':'<td><span class="rc2-tbl-none">&mdash;</span></td>';
      var liveVerCell=live?'<td><span class="rc2-ver-no">v'+live.version+'</span></td>':'<td><span class="rc2-tbl-none">&mdash;</span></td>';
      var effCell=live?'<td class="rc2-tbl-date">'+fmtDay(live.effectiveDate)+'</td>':'<td><span class="rc2-tbl-none">&mdash;</span></td>';
      var linesCell=card?'<td class="num">'+fmtNum(lines)+'</td>':'<td class="num"><span class="rc2-tbl-none">&mdash;</span></td>';
      var actionCell='<td class="rc2-tbl-action rc2-tbl-action--chev">'+ico('ChevronRight')+'</td>';
      var trAttrs;
      if(!card){
        actionCell='<td class="rc2-tbl-action"><button class="proto-btn proto-btn--primary rc2-tbl-add-btn" data-rc2="new" data-engine="'+engine.id+'">'+ico('AddCircle')+'New card</button></td>';
        trAttrs='class="rc2-tbl-tr rc2-tbl-tr--empty"';
      } else if(locked){
        actionCell='<td class="rc2-tbl-action rc2-tbl-action--spin"><span class="rc2-spin-xs"></span></td>';
        trAttrs='class="rc2-tbl-tr rc2-tbl-tr--locked" title="Upload in progress \u2014 not clickable"';
      } else if(needsReview){
        actionCell='<td class="rc2-tbl-action rc2-tbl-action--chev">'+ico('ChevronRight')+'</td>';
        trAttrs='class="rc2-tbl-tr rc2-tbl-tr--clickable rc2-tbl-tr--review" data-rc2="open-review" data-id="'+card.id+'"';
      } else {
        trAttrs='class="rc2-tbl-tr rc2-tbl-tr--clickable" data-rc2="open" data-id="'+card.id+'"';
      }
      var mainRow='<tr '+trAttrs+'>'+engineCell+verCell+cardCell+activeCell+liveVerCell+effCell+linesCell+actionCell+'</tr>';
      return mainRow;
    }).join('');
    return'<div class="proto-table-wrap rc2-tbl-list-wrap"><table class="proto-table rc2-tbl-list"><thead><tr><th>Rate engine</th><th>Engine version</th><th>Rate card</th><th>Active rate card</th><th>Ver.</th><th>Effective from</th><th class="num">Lines</th><th></th></tr></thead><tbody>'+trs+'</tbody></table></div>';
  }

  function listView(){
    var head=crumb([{label:'Settings'},{label:'Pricing'},{label:'Rate Cards'}])+
      '<div class="re-tv-toolbar rc2-page-toolbar">'+
        '<div class="re-tv-titles">'+
          '<h2 class="re-tv-heading">Rate cards</h2>'+
          '<p class="re-tv-sub">Pay and bill rate uploads linked to a specific engine schema &mdash; one rate card per pricing engine.</p>'+
        '</div>'+
        (!allCovered()?'<button class="proto-btn proto-btn--primary rc2-new-btn" data-rc2="new">'+ico('AddCircle')+'New rate card</button>':'')+
      '</div>';
    return'<div class="rc2">'+head+tableListView()+'</div>';
  }

  // ============================================================ DETAIL
  function activeFlt(flt){return flt&&Object.keys(flt).some(function(k){return flt[k]&&flt[k]!=="all";});}
  function applyFilters(rows,flt,q){
    if(activeFlt(flt)){rows=rows.filter(function(r){if(flt.s&&flt.s!=="all"&&r.s!==flt.s)return false;if(flt.loc&&flt.loc!=="all"&&r.loc!==flt.loc)return false;if(flt.jt&&flt.jt!=="all"&&r.jt!==flt.jt)return false;return true;});}
    if(q&&q.trim()){var lq=q.trim().toLowerCase();rows=rows.filter(function(r){return(r.s+" "+r.loc+" "+r.jt).toLowerCase().indexOf(lq)>=0;});}
    return rows;
  }
  function groupedRows(rows,gb){if(!gb||gb==="none")return null;var map={},order=[];rows.forEach(function(r){var k=r[gb]||"Other";if(!map[k]){map[k]=[];order.push(k);}map[k].push(r);});return{map:map,order:order};}

  function filterBar(card,tab){
    var rows=tab==="bill"?billLines(card):payLines(card),flt=S.detailFilters||{},gb=S.detailGroupBy||"none",q=S.detailSearch||"";
    var vis=applyFilters(rows,flt,q).length;
    function sel(field,label,opts,val){return'<label class="rc2-flt-label">'+label+'<select class="rc2-flt-sel" data-rc2="filter" data-field="'+field+'"><option value="all"'+(!val||val==="all"?" selected":"")+'>All '+label.toLowerCase()+'s</option>'+uniq(opts).map(function(o){return'<option value="'+esc(o)+'"'+(val===o?" selected":"")+'">'+esc(o)+'</option>';}).join("")+'</select></label>';}
    function gbSel(){var opts=[["none","No grouping"],["loc","Group by site"],["s","Group by supplier"],["jt","Group by job type"]];return'<label class="rc2-flt-label rc2-flt-label--gb">Group by<select class="rc2-flt-sel rc2-flt-sel--gb" data-rc2="groupby">'+opts.map(function(o){return'<option value="'+o[0]+'"'+(gb===o[0]?" selected":"")+'>'+o[1]+'</option>';}).join("")+'</select></label>';}
    return'<div class="rc2-filter-bar">'+
      '<div class="rc2-search">'+ico("Search")+'<input class="rc2-search-in" type="text" data-rc2="search" placeholder="Search supplier, site, job type\u2026" value="'+esc(q)+'" /></div>'+
      sel("s","Supplier",rows.map(function(r){return r.s;}),flt.s)+
      sel("loc","Site",rows.map(function(r){return r.loc;}),flt.loc)+
      sel("jt","Job type",rows.map(function(r){return r.jt;}),flt.jt)+
      gbSel()+
      ((activeFlt(flt)||q)?'<button class="rc2-flt-clear" data-rc2="clear-filters">'+ico("Cancel")+'Clear</button>':'')+
      '<span class="rc2-flt-count">'+vis+(vis!==rows.length?" of "+rows.length:"")+" line"+(vis===1?"":"s")+"</span>"+
    '</div>';
  }

  var PAY_COLS=["Supplier","Site","Job type","Hrs","Base Pay Rate - Pay rate - £/hr","WTR Holiday Pay - Holiday - £/hr","Sick Pay - Sick pay - £/hr","Direct cost"];
  var BILL_COLS=["Supplier","Site","Job type","Employer NI - Emp. NI - £/hr","Pension Auto-Enrolment - Pension - £/hr","Apprenticeship Levy - Levy - £/hr","Direct cost","Markup - Margin - £/hr","Bill rate"];
  function payRowHtml(r){return'<tr><td>'+esc(r.s)+'</td><td>'+esc(r.loc)+'</td><td>'+esc(r.jt)+'</td><td class="num">'+r.hrs+'</td><td class="num rc2-strong">'+gbp(r.pay)+'</td><td class="num">'+gbp(r.wtr)+'</td><td class="num">'+gbp(r.sick)+'</td><td class="num rc2-strong">'+gbp(r.direct)+'</td></tr>';}
  function billRowHtml(r){return'<tr><td>'+esc(r.s)+'</td><td>'+esc(r.loc)+'</td><td>'+esc(r.jt)+'</td><td class="num">'+gbp(r.eni)+'</td><td class="num">'+gbp(r.pen)+'</td><td class="num">'+gbp(r.levy)+'</td><td class="num">'+gbp(r.direct)+'</td><td class="num">'+gbp(r.margin)+'</td><td class="num rc2-bill">'+gbp(r.charge)+'</td></tr>';}
  function renderTable(cols,rows,rowFn,gb){
    var thead='<thead><tr>'+cols.map(function(c,i){return'<th'+(i>=3?' class="num"':'')+'>'+c+'</th>';}).join("")+'</tr></thead>';
    var grp=groupedRows(rows,gb),tbody;
    if(grp){var h="";grp.order.forEach(function(k){h+='<tr class="rc2-group-hd"><td colspan="'+cols.length+'">'+esc(k)+'</td></tr>';grp.map[k].forEach(function(r){h+=rowFn(r);});});tbody='<tbody>'+h+'</tbody>';}
    else{tbody='<tbody>'+rows.map(rowFn).join("")+'</tbody>';}
    return'<table class="proto-table rc2-table">'+thead+tbody+'</table>';
  }

  function changesPanel(card){
    var tl=timeline(card); if(tl.length<2)return'<div class="rc2-flt-empty">'+ico("Information")+'At least 2 versions needed to compare.</div>';
    var live=liveVer(card),prev=null;
    tl.forEach(function(v){if(v.status==="archived"&&!prev)prev=v;}); if(!prev)prev=tl[tl.length-1];
    var rows=cardRows(card),rnd=mulberry32(hashStr(card.id+"diff"));
    var changed=rows.filter(function(){return rnd()<0.15;}).map(function(r){
      var d=(rnd()>0.6?-1:1)*(0.10+rnd()*0.50),pp=Math.round(r.net*100)/100,cp=Math.round((r.net+d)*100)/100;
      return{s:r.s,loc:r.loc,jt:r.jt,prevPay:pp,currPay:cp,delta:d,pct:Math.round((d/pp)*1000)/10};
    });
    if(!changed.length)return'<div class="rc2-vld-clean">'+ico("Check")+'No changes detected.</div>';
    var trs=changed.map(function(c){var up=c.delta>=0;return'<tr><td>'+esc(c.s)+'</td><td>'+esc(c.loc)+'</td><td>'+esc(c.jt)+'</td>'+
      '<td class="num">'+gbp(c.prevPay)+'</td><td class="num">'+gbp(c.currPay)+'</td>'+
      '<td class="num rc2-diff-'+(up?'up':'dn')+'"><span>'+(up?'+':'')+gbp(Math.abs(c.delta))+'</span> <span class="rc2-diff-pct">'+(c.pct>0?'+':'')+c.pct+'%</span></td></tr>';}).join('');
    return'<div class="rc2-changes"><div class="rc2-changes-head">'+ico("DataGridView")+'v'+prev.version+' → v'+live.version+' · '+fmtNum(changed.length)+' pay rate line'+(changed.length===1?'':'s')+' changed</div>'+
      '<div class="proto-table-wrap rc2-table-wrap"><table class="proto-table rc2-table"><thead><tr><th>Supplier</th><th>Site</th><th>Job type</th><th class="num">v'+prev.version+'</th><th class="num">v'+live.version+'</th><th class="num">Change</th></tr></thead><tbody>'+trs+'</tbody></table></div></div>';
  }

  function rateTablesPanel(card){
    var tab=S.detailTab==="bill"?"bill":"pay",flt=S.detailFilters||{},gb=S.detailGroupBy||"none",q=S.detailSearch||"";
    var tl=timeline(card),verObj=null;
    if(S.detailVersionId){tl.forEach(function(v){if(v.version===S.detailVersionId)verObj=v;});}
    if(!verObj)verObj=liveVer(card);
    var docName=tab==="pay"?(verObj&&verObj.payFile):(verObj&&verObj.billFile);
    // Prefer real uploaded rows stored on the version; fall back to synthetic PDF_RATES data
    var realData=verObj&&(tab==="pay"?verObj._payRows:verObj._billRows);
    function tabBtn(id,label){return'<button class="rc2-tab'+(tab===id?" is-on":"")+'" data-rc2="tab" data-tab="'+id+'" role="tab" aria-selected="'+(tab===id?"true":"false")+'">'+label+'</button>';}
    var lineCount=realData?realData.rows.length:(tab==="pay"?payLines(card):billLines(card)).length;
    var tabsBar='<div class="rc2-rates-head">'+
      '<div class="rc2-rates-ver-ctx">'+ico("DataGridView")+'<span>v'+(verObj?verObj.version:"?")+' \u00b7 '+fmtNum(lineCount)+' lines</span></div>'+
      '<div class="rc2-tabs" role="tablist">'+tabBtn("pay","Pay rate card")+tabBtn("bill","Bill rate card")+'</div>'+
      '<div class="rc2-rates-actions"><button class="proto-btn proto-btn--secondary" data-rc2="export" data-kind="'+tab+'" data-fmt="xlsx">'+ico("Excel")+'Export .xlsx</button><button class="proto-btn proto-btn--secondary" data-rc2="export" data-kind="'+tab+'" data-fmt="csv">'+ico("FileDownload")+'Export .csv</button></div>'+
    '</div>';
    var tableHtml;
    if(realData&&realData.rows&&realData.rows.length){
      tableHtml=uploadedDataTable({_headers:realData.headers,_parsedRows:realData.rows});
    } else {
      var rawRows=tab==="pay"?payLines(card):billLines(card),visRows=applyFilters(rawRows,flt,q);
      tableHtml=filterBar(card,tab)+
        '<div class="rc2-rates-note">'+ico("Information")+'<span>'+(tab==="pay"?'Worker pay plus statutory on-costs.':'Direct cost plus margin \u2014 the hourly charge rate.')+(docName?' Snapshot from <b>'+esc(docName)+'</b>.':'')+'</span></div>'+
        (visRows.length===0?'<div class="rc2-flt-empty">'+ico("Filter")+'No lines match the current filters.</div>':'<div class="proto-table-wrap rc2-table-wrap">'+renderTable(tab==="pay"?PAY_COLS:BILL_COLS,visRows,tab==="pay"?payRowHtml:billRowHtml,gb!=="none"?gb:null)+'</div>');
    }
    return'<div class="proto-card rc2-rates">'+tabsBar+(realData&&docName?'<div class="rc2-rates-note">'+ico("Information")+'<span>Snapshot from <b>'+esc(docName)+'</b>.</span></div>':'')+tableHtml+'</div>';
  }

  function historyPanel(card){
    var tl=timeline(card).slice().reverse();
    var rows=tl.map(function(v){
      var stCls=v.status==="active"?"is-active":v.status==="scheduled"?"is-scheduled":"is-archived";
      var stLabel={active:"Active",scheduled:"Scheduled",archived:"Archived"}[v.status]||v.status;
      var dateRange=v.status==="scheduled"?"From "+fmtDay(v.effectiveDate):fmtDay(v.effectiveDate)+(v.endDate?" \u2013 "+fmtDay(v.endDate):" \u2013 present");
      var isSel=S.detailVersionId===v.version;
      var removeBtn=v.status==="scheduled"
        ?'<button class="rc2-ver-remove" data-rc2="remove-ver" data-card-id="'+card.id+'" data-ver="'+v.version+'" title="Remove scheduled version">'+ico("TrashCan")+'Remove</button>'
        :'';
      return'<tr class="rc2-history-row'+(isSel?" is-sel":"")+'" data-rc2="pick-ver" data-ver="'+v.version+'">'+
        '<td><span class="rc2-tbl-card-name">'+esc(card.name)+'</span></td>'+
        '<td><span class="rc2-ver-no">v'+v.version+'</span></td>'+
        '<td><span class="proto-ver-badge '+stCls+'">'+stLabel+'</span></td>'+
        '<td>'+dateRange+'</td>'+
        '<td>'+fmtDay(v.appliedAt)+'</td>'+
        '<td class="rc2-history-action">'+removeBtn+'</td>'+
      '</tr>';
    }).join("");
    return'<div class="proto-card rc2-history">'+
      '<div class="rc2-history-head"><div><div class="rc2-history-title">'+esc(card.name)+' \u00b7 Version history</div><div class="rc2-history-sub">Click a version to view its rate data.</div></div><button class="proto-btn proto-btn--primary" data-rc2="newver">'+ico("FileUpload")+'Upload new version</button></div>'+
      '<div class="proto-table-wrap"><table class="proto-table"><thead><tr><th>Rate card</th><th>Version</th><th>Status</th><th>Effective</th><th>Applied</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
    '</div>';
  }

  function removeCardModal(){
    var card=findCard(S.removeCardConfirm); if(!card) return '';
    return '<div class="rc2-confirm-overlay">'+
      '<div class="rc2-confirm-modal" role="dialog" aria-modal="true">'+
        '<div class="rc2-confirm-ico">'+ico('TrashCan')+'</div>'+
        '<h2 class="rc2-confirm-title">Remove rate card?</h2>'+
        '<p class="rc2-confirm-body"><strong>'+esc(card.name)+'</strong> and all its version history will be permanently removed. The '+esc(engineById(card.engineId).name)+' pricing engine will no longer have an active rate card.</p>'+
        '<div class="rc2-confirm-actions">'+
          '<button class="proto-btn proto-btn--ghost" data-rc2="remove-card-cancel">Cancel</button>'+
          '<button class="proto-btn proto-btn--danger" data-rc2="remove-card-confirm">Remove rate card</button>'+
        '</div>'+
      '</div>'+
    '</div>';
  }

  function detailView(){
    var card=findCard(S.selectedId); if(!card){S.view="list";return listView();}
    var engine=engineById(card.engineId),live=liveVer(card),lines=cardRows(card).length;
    var tl=timeline(card),verObj=null;
    if(S.detailVersionId){tl.forEach(function(v){if(v.version===S.detailVersionId)verObj=v;});}
    var head=crumb([{label:"Settings"},{label:"Pricing"},{label:"Rate Cards",act:"list"},{label:card.name}])+'<button class="proto-subnav-back rc2-back" data-rc2="list">'+ico("ArrowLeft")+'Back to rate cards</button>';
    var summary='<div class="proto-card rc2-detail-head"><div class="rc2-detail-id"><div class="rc2-detail-title"><h1>'+esc(card.name)+'</h1></div><div class="rc2-detail-sub"><span class="rc2-engine-tag">'+ico("DataGridView")+esc(engine.name)+' <em>'+engine.version+'</em> \u00b7 pricing engine</span>'+(live?'<span class="rc2-detail-dot">\u00b7</span><span>v'+live.version+' live from '+fmtDay(live.effectiveDate)+'</span>':'')+'<span class="rc2-detail-dot">\u00b7</span><span>'+lines+' rate lines</span></div></div><div class="rc2-detail-right"><div class="rc2-detail-docs">'+docChip(true,"Pay rate card")+docChip(true,"Bill rate card")+'<span class="rc2-detail-engine-note">'+ico("Lock")+'Pricing engine is fixed</span></div><button class="proto-btn proto-btn--danger-ghost rc2-detail-remove-btn" data-rc2="remove-card">'+ico('TrashCan')+'Remove rate card</button></div></div>';
    return'<div class="rc2">'+head+summary+historyPanel(card)+(verObj?rateTablesPanel(card):'')+(S.removeCardConfirm?removeCardModal():'')+'</div>';
  }

  // ============================================================ UPLOAD FLOW
  // Steps: 1=Upload (details + files) | 2=Review & edit | 3=Publish
  function defaultEffDate(){var d=new Date(2026,5,7);d.setMonth(d.getMonth()+1,1);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-01";}

  function startNew(preEid){
    var free=ENGINES.filter(function(e){return!S.cards.some(function(c){return c.engineId===e.id;});});
    if(!free.length){toast("Every pricing engine already has a rate card");return;}
    S.draft={mode:"new",name:"",note:"",engineId:preEid||free[0].id,engineVersionId:null,step:1,pay:null,bill:null,effDate:defaultEffDate(),editedPay:{},editedBill:{},_uploadEdits:{pay:{},bill:{}},reviewTab:"pay"};
    S.view="new"; RC2._render();
  }
  function startVersion(card){
    setCardWorkingStatus(card,"uploading");
    S.draft={mode:"version",cardId:card.id,name:card.name,note:"",engineId:card.engineId,engineVersionId:null,step:1,pay:null,bill:null,effDate:defaultEffDate(),editedPay:{},editedBill:{},_uploadEdits:{pay:{},bill:{}},reviewTab:"pay"};
    S.view="new"; RC2._render();
  }
  function startVersionReview(card){
    // Open upload flow at step 2 (validation) with pre-populated docs showing issues
    var payDoc=makePendingDoc(null,false); payDoc.phase="done";
    var billDoc=makePendingDoc(null,false); billDoc.phase="done";
    S.draft={mode:"version",cardId:card.id,name:card.name,note:"",engineId:card.engineId,step:2,pay:payDoc,bill:billDoc,effDate:defaultEffDate(),editedPay:{},editedBill:{},reviewTab:"pay"};
    S.view="new"; RC2._render();
  }

  // ---- async validation lifecycle ------------------------------------
  var ERR_ROW_H=52, ERR_BUF=6;

  function makePendingDoc(file,isSample){
    var name=(file&&file.name)||(isSample?"Sample_rates_v2.xlsx":"rate_card.xlsx"),size=(file&&file.size)||(isSample?14336:300000);
    var h=hashStr(name+":"+size),rows=isSample?24:Math.max(8000,Math.round(size/100));
    return{fileName:name,size:size,rows:rows,phase:"validating",isSample:isSample,totalIssues:isSample?0:Math.round(4800+mulberry32(h)()*5200),_errors:null,_rndSeed:h,errFilter:{sev:"all",q:""}};
  }
  function startValidation(kind,doc){
    if(_vldTimers[kind]) clearTimeout(_vldTimers[kind]);
    var delay=1000+Math.min(1000,doc.rows/80);
    _vldTimers[kind]=setTimeout(function(){
      if(!S||!S.draft||S.draft[kind]!==doc) return;
      doc.phase="done"; delete _vldTimers[kind];
      // Update card working status based on new state
      if(S.draft.cardId){var c=findCard(S.draft.cardId);if(c)setCardWorkingStatus(c,deriveDraftStatus(S.draft));}
      if(RC2._root&&S.view==="new") RC2._render();
    }, delay);
  }
  function receiveFile(file,kind){
    if(!S.draft) return;
    var name=file.name, size=file.size;
    var doc={fileName:name,size:size,rows:0,phase:"validating",isSample:false,totalIssues:0,_errors:null,_rndSeed:hashStr(name+":"+size),errFilter:{sev:"all",q:""}};
    S.draft[kind]=doc;
    if(S.draft.cardId){var c=findCard(S.draft.cardId);if(c)setCardWorkingStatus(c,kind==="pay"?"validating_pay":"validating_bill");}
    RC2._render();
    var reader=new FileReader();
    reader.onload=function(e){
      try{
        var data=e.target.result;
        var headers=[],dataRows=[];
        if(window.XLSX){
          var wb=XLSX.read(new Uint8Array(data),{type:"array"});
          var ws=wb.Sheets[wb.SheetNames[0]];
          var aoa=XLSX.utils.sheet_to_json(ws,{header:1,defval:""});
          headers=(aoa[0]||[]).map(function(h){return String(h).trim();});
          dataRows=aoa.slice(1).filter(function(r){return r.some(function(c){return c!==""&&c!=null;});});
        } else if(/\.csv$/i.test(name)){
          var text=new TextDecoder().decode(data);
          var lines=text.split(/\r?\n/).filter(function(l){return l.trim();});
          if(lines.length){
            headers=lines[0].split(",").map(function(h){return h.replace(/^"|"$/g,"").trim();});
            dataRows=lines.slice(1).map(function(l){return l.split(",").map(function(c){return c.replace(/^"|"$/g,"");});});
          }
        }
        doc.rows=dataRows.length;
        doc._headers=headers;
        doc._parsedRows=dataRows;
        var errs=[],uid=0;
        var reCols=window.RE&&window.RE.getVersionColumns?window.RE.getVersionColumns(S.draft.engineId,S.draft.engineVersionId):null;
        var expected=reCols?(kind==="pay"?reCols.pay:reCols.bill):[];
        var hLow=headers.map(function(h){return h.toLowerCase();});
        expected.forEach(function(col){
          var key=col.toLowerCase().split(" - ")[0];
          var found=hLow.some(function(h){return h.indexOf(key)>=0;});
          if(!found) errs.push({id:uid++,line:1,sev:"error",type:"missing_col",label:"Missing column",col:col,supplier:"",site:"",role:"",desc:"\u201c"+col+"\u201d not found \u2014 required by the selected rate engine version"});
        });
        var valIdx=-1;
        for(var ci=0;ci<headers.length;ci++){if(/pay.?rate|rate|value/i.test(headers[ci])){valIdx=ci;break;}}
        if(valIdx>=0){
          dataRows.forEach(function(row,ri){
            var cell=row[valIdx];
            if(cell===""||cell==null){
              errs.push({id:uid++,line:ri+2,sev:"error",type:"missing",label:"Missing pay rate",col:headers[valIdx],supplier:String(row[0]||""),site:String(row[1]||""),role:String(row[2]||""),desc:"Pay rate is blank on this line"});
            } else {
              var v=parseFloat(String(cell).replace(/[\u00a3$,]/g,""));
              if(!isNaN(v)&&v>0&&v<12.21) errs.push({id:uid++,line:ri+2,sev:"error",type:"nmw",label:"Pay rate below NMW",col:headers[valIdx],supplier:String(row[0]||""),site:String(row[1]||""),role:String(row[2]||""),desc:"Rate \u00a3"+v.toFixed(2)+" is below the \u00a312.21 NMW floor"});
            }
          });
        }
        doc._errors=errs; doc.totalIssues=errs.length;
      } catch(err){
        doc._errors=[{id:0,line:1,sev:"error",type:"missing",label:"Parse error",col:"",supplier:"",site:"",role:"",desc:"Could not parse file: "+String(err)}];
        doc.totalIssues=1;
      }
      doc.phase="done";
      if(S.draft&&S.draft[kind]===doc){
        if(S.draft.cardId){var c2=findCard(S.draft.cardId);if(c2)setCardWorkingStatus(c2,deriveDraftStatus(S.draft));}
        if(RC2._root&&S.view==="new")RC2._render();
      }
    };
    reader.onerror=function(){
      doc._errors=[{id:0,line:1,sev:"error",type:"missing",label:"Read error",col:"",supplier:"",site:"",role:"",desc:"The file could not be read."}];
      doc.totalIssues=1; doc.phase="done";
      if(S.draft&&S.draft[kind]===doc&&RC2._root&&S.view==="new")RC2._render();
    };
    reader.readAsArrayBuffer(file);
  }
  function loadSample(kind){
    if(!S.draft) return;
    var doc=makePendingDoc(null,true);
    S.draft[kind]=doc;
    if(S.draft.cardId){var c=findCard(S.draft.cardId);if(c)setCardWorkingStatus(c,kind==="pay"?"validating_pay":"validating_bill");}
    startValidation(kind,doc); RC2._render();
  }

  // Detect which columns in an uploaded file are "value" columns (numeric, editable).
  function detectValueCols(hdrs, rows) {
    var sample = rows.slice(0, 5);
    return hdrs.map(function(h, ci) {
      if (ci === 0) return false; // first col is always a key
      // Header hint
      if (/rate|pay|hrs|hours|value|margin|charge|cost|amount|levy|pension|ni\b/i.test(h)) return true;
      // Numeric in data
      for (var ri = 0; ri < sample.length; ri++) {
        var cell = sample[ri][ci];
        if (cell !== '' && cell != null) {
          var n = parseFloat(String(cell).replace(/[£$€,\s]/g, ''));
          return !isNaN(n);
        }
      }
      return false;
    });
  }

  // Editable table for Review & edit step — value columns get inline inputs.
  function uploadedEditableTable(doc, kind) {
    if (!doc || !doc._parsedRows || !doc._parsedRows.length)
      return '<div class="rc2-flt-empty">'+ico("Information")+'No data rows found.</div>';
    var hdrs = doc._headers || [];
    var rows = doc._parsedRows;
    var editMap = (S.draft && S.draft._uploadEdits && S.draft._uploadEdits[kind]) || {};
    var isVal = detectValueCols(hdrs, rows);
    var valCount = isVal.filter(Boolean).length;

    var thead = '<thead><tr>' + hdrs.map(function(h, ci) {
      return '<th' + (ci > 0 ? ' class="num"' : '') + '>' + esc(h) + (isVal[ci] ? ' ' + ico('Edit') : '') + '</th>';
    }).join('') + '</tr></thead>';

    var show = rows.slice(0, 500);
    var tbody = '<tbody>' + show.map(function(row, ri) {
      return '<tr>' + hdrs.map(function(h, ci) {
        var rawVal = row[ci] != null ? row[ci] : '';
        if (isVal[ci]) {
          var editedVal = editMap[ri] && editMap[ri][ci] !== undefined ? editMap[ri][ci] : rawVal;
          var numStr = String(editedVal).replace(/[£$€,\s]/g, '');
          var numVal = parseFloat(numStr);
          return '<td class="num rc2-upload-edit-cell">' +
            '<input class="rc2-edit-in rc2-edit-in--inline" type="number" step="0.01" ' +
              'value="' + (isNaN(numVal) ? esc(String(editedVal)) : numVal.toFixed(2)) + '" ' +
              'data-ue-kind="' + esc(kind) + '" data-ue-ri="' + ri + '" data-ue-ci="' + ci + '" />' +
          '</td>';
        }
        return '<td' + (ci > 0 ? ' class="num"' : '') + '>' + esc(String(rawVal)) + '</td>';
      }).join('') + '</tr>';
    }).join('') + '</tbody>';

    return '<div class="proto-table-wrap rc2-table-wrap" style="max-height:420px">' +
      '<table class="proto-table rc2-table rc2-editable-table">' + thead + tbody + '</table>' +
      (rows.length > 500 ? '<div class="rc2-flt-count" style="padding:8px 14px">Showing first 500 of ' + fmtNum(rows.length) + ' rows \u00b7 edit applies to all</div>' : '') +
      (valCount ? '<div class="rc2-edit-hint">' + ico('Edit') + 'Click any highlighted column to edit its value</div>' : '') +
    '</div>';
  }

  // Read-only table — used in validation preview and detail view.
  function uploadedDataTable(doc){
    if(!doc||!doc._parsedRows||!doc._parsedRows.length)
      return'<div class="rc2-flt-empty">'+ico("Information")+'No data rows found in the uploaded file.</div>';
    var hdrs=doc._headers||[];
    var rows=doc._parsedRows;
    var show=rows.slice(0,500);
    var thead='<thead><tr>'+hdrs.map(function(h,i){return'<th'+(i>0?' class="num"':'')+'>'+esc(h)+'</th>';}).join('')+'</tr></thead>';
    var tbody='<tbody>'+show.map(function(row){
      return'<tr>'+hdrs.map(function(h,i){var c=row[i]!=null?row[i]:'';return'<td'+(i>0?' class="num"':'')+'>'+esc(String(c))+'</td>';}).join('')+'</tr>';
    }).join('')+'</tbody>';
    return'<div class="proto-table-wrap rc2-table-wrap" style="max-height:420px">'+
      '<table class="proto-table rc2-table">'+thead+tbody+'</table>'+
      (rows.length>500?'<div class="rc2-flt-count" style="padding:8px 14px">Showing first 500 of '+fmtNum(rows.length)+' rows</div>':'')+
    '</div>';
  }

  // ---- validation panel (shown inline in step 1) ---------------------
  function errTypeCards(doc,kind){
    var s=summarizeErrors(doc),filt=doc.errFilter||{};
    var ordered=VLD_ERRS.filter(function(t){return s.byType[t.key];}).sort(function(a,b){return s.byType[b.key]-s.byType[a.key];});
    return'<div class="rc2-vld-typecards">'+ordered.map(function(t){var n=s.byType[t.key],on=filt.typeKey===t.key,pct=Math.max(1,Math.round((n/doc.rows)*1000)/10);return'<button class="rc2-vtcard rc2-vtcard--'+(on?"on ":"")+t.sev+'" data-rc2="vld-type" data-vld-kind="'+kind+'" data-vld-type="'+t.key+'"><span class="rc2-vtcard-top"><span class="rc2-vtcard-sev rc2-vtcard-sev--'+t.sev+'">'+ico(t.sev==="error"?"Alert":"Information")+(t.sev==="error"?"Error":"Warning")+'</span><b>'+fmtNum(n)+'</b></span><span class="rc2-vtcard-label">'+esc(t.label)+'</span><span class="rc2-vtcard-foot"><span class="rc2-vtcard-col">'+esc(t.col)+'</span><span>'+pct+'% of lines</span></span></button>';}).join("")+'</div>';
  }
  function errBrowser(doc,kind){
    var filt=doc.errFilter||{sev:"all",q:""},all=genErrors(doc);
    var shown=all.filter(function(e){if(filt.sev!=="all"&&e.sev!==filt.sev)return false;if(filt.typeKey&&e.type!==filt.typeKey)return false;if(filt.q&&filt.q.trim()){var hay=(e.line+" "+e.supplier+" "+e.site+" "+e.role+" "+e.label+" "+e.desc).toLowerCase();if(hay.indexOf(filt.q.toLowerCase())<0)return false;}return true;});
    _vlistData[kind]=shown;
    var sevSeg=["all","error","warn"].map(function(k){return'<button class="rc2-seg-btn'+(filt.sev===k?" is-on":"")+'" data-rc2="vld-sev" data-vld-kind="'+kind+'" data-vld-sev="'+k+'">'+{all:"All",error:"Errors",warn:"Warnings"}[k]+'</button>';}).join("");
    var toolbar='<div class="rc2-err-bar"><div class="rc2-seg">'+sevSeg+'</div>'+(filt.typeKey?'<button class="rc2-flt-clear" data-rc2="vld-type-clear" data-vld-kind="'+kind+'">'+ico("Cancel")+(VLD_ERRS.find(function(t){return t.key===filt.typeKey;})||{label:"Type"}).label+'</button>':'')+'<div class="rc2-search">'+ico("Search")+'<input class="rc2-search-in rc2-err-q" type="text" data-rc2="vld-q" data-vld-kind="'+kind+'" placeholder="Search\u2026" value="'+esc(filt.q||"")+'" /></div><span class="rc2-flt-count">'+fmtNum(shown.length)+(shown.length!==all.length?" of "+fmtNum(all.length):"")+" issues</span></div>";
    var hd='<div class="rc2-erow rc2-erow--hd"><span class="rc2-ec-line">Line</span><span class="rc2-ec-keys">Site \u00b7 role</span><span class="rc2-ec-type">Issue type</span><span class="rc2-ec-desc">Detail</span></div>';
    var list=shown.length?'<div class="rc2-vlist" data-rc2-vlist="'+kind+'" style="height:'+Math.min(480,Math.max(120,shown.length*ERR_ROW_H))+'px"><div class="rc2-vlist-pad" style="height:'+(shown.length*ERR_ROW_H)+'px"><div class="rc2-vlist-rows" data-rc2-vrows="'+kind+'"></div></div></div>':'<div class="rc2-flt-empty">'+ico("Check")+'No issues match these filters.</div>';
    return'<div class="rc2-err-browser">'+toolbar+hd+list+'</div>';
  }

  function validationPanel(doc,kind){
    var kindLabel=kind==="pay"?"Pay rate card":"Bill rate card";
    if(doc.phase==="validating"){
      return'<div class="rc2-vld"><div class="rc2-vld-head"><span class="rc2-vld-title">'+ico("ClipboardCircleCheck")+'Validating <b>'+esc(doc.fileName)+'</b> \u00b7 '+fmtNum(doc.rows)+' lines\u2026</span><span class="rc2-vld-validating"><span class="rc2-spin"></span>Running checks</span></div></div>';
    }
    var s=summarizeErrors(doc),clean=s.total===0;
    var verdict=clean?'<span class="rc2-vld-verdict rc2-vld-verdict--ok">'+ico("Check")+'All checks passed \u00b7 '+fmtNum(doc.rows)+' lines</span>':(s.errN>0?'<span class="rc2-vld-verdict rc2-vld-verdict--err">'+ico("Alert")+fmtNum(s.errN)+' errors \u00b7 '+fmtNum(s.warnN)+' warnings \u00b7 fix to continue</span>':'<span class="rc2-vld-verdict rc2-vld-verdict--warn">'+ico("Information")+fmtNum(s.warnN)+' warnings \u00b7 safe to continue</span>');
    // Rate structure: only shown when clean (no errors to fix first)
    var vt=(doc.errFilter&&doc.errFilter.previewTab)||"validation";
    var canPreview=clean;
    function vTabBtn(id,label){return'<button class="rc2-vld-tab'+(vt===id?" is-on":"")+'" data-rc2="vld-tab" data-vld-kind="'+kind+'" data-vld-val="'+id+'">'+label+'</button>';}
    var body=vt==="preview"?ratePreviewPanel(kind):(clean?'<div class="rc2-vld-clean">'+ico("Check")+'<div><b>Every line passed validation</b><p>All '+fmtNum(doc.rows)+' rate lines parsed, mapped and priced without an issue.</p></div></div>':(errTypeCards(doc,kind)+errBrowser(doc,kind)));
    return'<div class="rc2-vld">'+
      '<div class="rc2-vld-head"><span class="rc2-vld-title">'+ico("ClipboardCircleCheck")+esc(kindLabel)+' \u00b7 <b>'+esc(doc.fileName)+'</b></span>'+verdict+'</div>'+
      '<div class="rc2-vld-tabrow">'+vTabBtn("validation","Validation"+(s.total?" ("+fmtNum(s.total)+")":""))+(canPreview?vTabBtn("preview","Rate structure"):'<span class="rc2-vld-tab rc2-vld-tab--locked" title="Fix all errors to unlock the rate structure preview">'+ico("Lock")+'Rate structure</span>')+'</div>'+
      '<div class="rc2-vld-body">'+body+'</div>'+
    '</div>';
  }

  function ratePreviewPanel(kind){
    var doc=S.draft&&S.draft[kind];
    if(doc&&doc._parsedRows&&doc._parsedRows.length){
      return'<div class="rc2-rate-preview"><div class="rc2-rate-preview-note">'+ico("Information")+'<b>'+esc(doc.fileName)+'</b> \u00b7 '+fmtNum(doc._parsedRows.length)+' rows \u00b7 '+((doc._headers&&doc._headers.length)||0)+' columns</div>'+uploadedDataTable(doc)+'</div>';
    }
    var card=S.draft&&S.draft.cardId?findCard(S.draft.cardId):cardForEngine(S.draft&&S.draft.engineId);
    if(!card) return'<div class="rc2-vld-clean">'+ico("Information")+'<p>Rate structure preview will be available once the file is parsed.</p></div>';
    var rows=kind==="pay"?payLines(card):billLines(card);
    return'<div class="rc2-rate-preview"><div class="rc2-rate-preview-note">'+ico("Information")+'Representative rate structure for <b>'+esc(card.name)+'</b> \u00b7 '+fmtNum(rows.length)+' lines</div><div class="proto-table-wrap rc2-table-wrap" style="max-height:360px">'+renderTable(kind==="pay"?PAY_COLS:BILL_COLS,rows,kind==="pay"?payRowHtml:billRowHtml,null)+'</div></div>';
  }

  // ---- editable rate table (step 2: Review & edit) -------------------
  var EDIT_PAY_FIELDS = { 4: "pay" };   // col index → field key (pay rate column)
  var EDIT_BILL_FIELDS = { 4: "margin" };

  function editablePayRow(r, rowIdx, editing) {
    var editKey = "pay-"+rowIdx+"-pay";
    function cell(ci, content, editable) {
      if(editable && editing===editKey) return'<td class="num rc2-edit-cell is-editing" data-eci="'+editKey+'"><input class="rc2-edit-in" type="number" step="0.01" min="0" value="'+Number(r.pay).toFixed(2)+'" data-ec="'+editKey+'" autofocus /></td>';
      if(editable) return'<td class="num rc2-strong rc2-edit-cell" data-ec="'+editKey+'" tabindex="0" title="Click to edit">'+content+'</td>';
      return'<td class="num">'+content+'</td>';
    }
    return'<tr class="'+(editing&&editing.startsWith("pay-"+rowIdx)?"is-editing-row":"")+'">'+
      '<td>'+esc(r.s)+'</td><td>'+esc(r.loc)+'</td><td>'+esc(r.jt)+'</td>'+
      cell(3,r.hrs,false)+'<td class="num">'+r.hrs+'</td>'+
      cell(4,gbp(r.pay),true)+
      '<td class="num">'+gbp(r.wtr)+'</td><td class="num">'+gbp(r.eni)+'</td><td class="num">'+gbp(r.pen)+'</td><td class="num">'+gbp(r.levy)+'</td><td class="num">'+gbp(r.sick)+'</td>'+
      '<td class="num rc2-strong">'+gbp(r.direct)+'</td>'+
    '</tr>';
  }
  function editableBillRow(r, rowIdx, editing) {
    var editKey = "bill-"+rowIdx+"-margin";
    function cell(content, editable) {
      if(editable && editing===editKey) return'<td class="num rc2-edit-cell is-editing"><input class="rc2-edit-in" type="number" step="0.01" min="0" value="'+Number(r.margin).toFixed(2)+'" data-ec="'+editKey+'" autofocus /></td>';
      if(editable) return'<td class="num rc2-edit-cell" data-ec="'+editKey+'" tabindex="0" title="Click to edit">'+gbp(r.margin)+'</td>';
      return'<td class="num">'+content+'</td>';
    }
    return'<tr class="'+(editing&&editing.startsWith("bill-"+rowIdx)?"is-editing-row":"")+'">'+
      '<td>'+esc(r.s)+'</td><td>'+esc(r.loc)+'</td><td>'+esc(r.jt)+'</td>'+
      '<td class="num">'+gbp(r.direct)+'</td>'+
      cell(gbp(r.margin),true)+
      '<td class="num rc2-bill">'+gbp(r.charge)+'</td>'+
    '</tr>';
  }

  function editableTable(kind, rows, editing) {
    var cols = kind==="pay"?PAY_COLS:BILL_COLS;
    var thead='<thead><tr>'+cols.map(function(c,i){return'<th'+(i>=3?' class="num"':'')+'>'+c+'</th>';}).join("")+'</tr></thead>';
    var tbody='<tbody>'+rows.map(function(r,i){ return kind==="pay"?editablePayRow(r,i,editing):editableBillRow(r,i,editing); }).join("")+'</tbody>';
    return'<div class="proto-table-wrap rc2-table-wrap rc2-editable-wrap"><table class="proto-table rc2-table rc2-editable-table">'+thead+tbody+'</table><div class="rc2-edit-hint">'+ico("Edit")+'Click a highlighted cell to edit its value</div></div>';
  }

  // ---- virtual scroll ------------------------------------------------
  function _attachErrLists(){
    if(!RC2._root) return;
    RC2._root.querySelectorAll("[data-rc2-vlist]").forEach(function(vl){
      var kind=vl.getAttribute("data-rc2-vlist"),rows=RC2._root.querySelector('[data-rc2-vrows="'+kind+'"]');
      if(!rows||!_vlistData[kind]) return;
      var data=_vlistData[kind];
      function paint(){
        var top=vl.scrollTop,start=Math.max(0,Math.floor(top/ERR_ROW_H)-ERR_BUF),vis=Math.ceil(vl.clientHeight/ERR_ROW_H)+ERR_BUF*2,end=Math.min(data.length,start+vis),h="";
        for(var i=start;i<end;i++){var e=data[i];h+='<div class="rc2-erow rc2-erow--'+e.sev+'" style="height:'+ERR_ROW_H+'px"><span class="rc2-ec-line"><span class="rc2-sev-dot rc2-sev-dot--'+e.sev+'"></span>'+fmtNum(e.line)+'</span><span class="rc2-ec-keys"><b>'+esc(e.site)+'</b><span>'+esc(e.role)+'</span></span><span class="rc2-ec-type">'+esc(e.label)+'</span><span class="rc2-ec-desc">'+esc(e.desc)+'</span></div>';}
        rows.style.transform="translateY("+(start*ERR_ROW_H)+"px)"; rows.innerHTML=h; fi(rows);
      }
      vl.addEventListener("scroll",paint,{passive:true}); paint();
    });
  }

  // ---- stepper + wizard view -----------------------------------------
  function stepper(d){
    var steps=[{n:1,l:"Details"},{n:2,l:"Upload"},{n:3,l:"Validation"},{n:4,l:"Review \u0026 edit"},{n:5,l:"Publish"}];
    return'<ol class="rc2-stepper">'+steps.map(function(s,i){var cls=d.step===s.n?"is-on":d.step>s.n?"is-done":"";return'<li class="rc2-step '+cls+'"><span class="rc2-step-dot">'+(d.step>s.n?ico("Check"):(i+1))+'</span><span class="rc2-step-label">'+s.l+'</span></li>';}).join('<li class="rc2-step-sep" aria-hidden="true"></li>')+'</ol>';
  }

  // ---- upload slot (step 2: no inline validation — that's step 3) ----

  // Template structure preview shown in step 2 (upload)
  function engineTemplatePanel(engineId, versionId) {
    var engine=engineById(engineId);
    // Try to read real columns from the selected Rate Engine version
    var reCols = window.RE && window.RE.getVersionColumns ? window.RE.getVersionColumns(engineId, versionId) : null;
    var payKeys=["Position","Job type","Tenure status","Location","Agency"];
    var payVals = reCols ? reCols.pay : ["Hrs","Base Pay Rate - Pay rate - £/hr","WTR Holiday Pay - Holiday - £/hr","Sick Pay - Sick pay - £/hr","Direct cost"];
    var billVals = reCols ? reCols.bill : ["Employer NI - Emp. NI - £/hr","Pension Auto-Enrolment - Pension - £/hr","Apprenticeship Levy - Levy - £/hr","Direct cost","Markup - Margin - £/hr","Bill rate"];
    var verLabel = reCols ? resolvedEngineVersionLabel({engineId:engineId,engineVersionId:versionId}) : engine.version;
    function chip(l,kind){return'<span class="re-col re-col--'+kind+'">'+esc(l)+'</span>';}
    return'<div class="rc2-tpl-panel">'+
      '<div class="rc2-tpl-head">'+ico("DataGridView")+'<span>'+esc(engine.name)+'</span><span class="rc2-tpl-ver">'+esc(verLabel)+'</span> rate engine · expected column structure</div>'+
      '<div class="rc2-tpl-row"><span class="rc2-tpl-l">Key columns</span><div class="re-cols">'+payKeys.map(function(l){return chip(l,'key');}).join('')+'</div></div>'+
      '<div class="rc2-tpl-row"><span class="rc2-tpl-l">Pay value columns</span><div class="re-cols">'+(payVals.length?payVals.map(function(l){return chip(l,'val');}).join(''):'<span class="rc2-tpl-empty">No rate-card-sourced pay rules configured</span>')+'</div></div>'+
      '<div class="rc2-tpl-row"><span class="rc2-tpl-l">Bill value columns</span><div class="re-cols">'+(billVals.length?billVals.map(function(l){return chip(l,'val');}).join(''):'<span class="rc2-tpl-empty">No rate-card-sourced bill rules configured</span>')+'</div></div>'+
      '<div class="rc2-tpl-foot"><button class="proto-btn proto-btn--secondary" data-rc2="dl-template">'+ico("FileDownload")+'Download template</button></div>'+
    '</div>';
  }

  function uploadSlot(kind) {
    var d=S.draft, doc=d[kind];
    var label=kind==="pay"?"Pay rate card":"Bill rate card";
    var sub=kind==="pay"?"Worker pay plus statutory on-costs":"Direct cost plus margin — the hourly charge rate";
    if(doc) {
      var isErr=doc.phase==="done"&&doc.totalIssues>0;
      return'<div class="rc2-upload-slot rc2-upload-slot--'+(doc.phase==="validating"?"validating":isErr?"err":"ok")+'">'+
        '<div class="rc2-slot-head"><span class="rc2-upload-badge">'+esc(label)+'</span>'+(doc.phase==="validating"?'<span class="rc2-vld-validating"><span class="rc2-spin"></span>Validating\u2026</span>':isErr?'<span class="rc2-slot-err">'+ico("Alert")+fmtNum(doc.totalIssues)+' issues</span>':'<span class="rc2-slot-ok">'+ico("Check")+'Clean</span>')+'<button class="rc2-file-x" data-rc2="clearfile" data-kind="'+kind+'">'+ico("Cancel")+'</button></div>'+
        '<div class="rc2-slot-file"><span class="rc2-file-ico">'+ico("Excel")+'</span><div class="rc2-file-main"><div class="rc2-file-name">'+esc(doc.fileName)+'</div><div class="rc2-file-meta">'+fmtNum(doc.rows)+' lines'+(doc.isSample?" \u00b7 sample":"")+'</div></div></div>'+
      '</div>';
    }
    return'<div class="rc2-upload-slot">'+
      '<div class="rc2-slot-head"><span class="rc2-upload-badge">'+esc(label)+'</span><span class="rc2-slot-opt">Optional</span></div>'+
      '<p class="rc2-upload-s">'+sub+'</p>'+
      '<div class="rc2-drop" data-rc2="pick" data-kind="'+kind+'" tabindex="0" role="button">'+ico("FileUpload","rc2-drop-ico")+'<div class="rc2-drop-t">Drag and drop, or <span class="rc2-drop-link">browse</span></div><div class="rc2-drop-sub">.xlsx, .xls or .csv</div></div>'+
      '<div class="rc2-drop-actions"><button class="proto-btn proto-btn--secondary rc2-sample-btn" data-rc2="sample" data-kind="'+kind+'">'+ico("FileDownload")+'Load sample</button></div>'+
    '</div>';
  }

  function canAdvance(d) {
    // All uploaded files must be clean
    var pay=d.pay,bill=d.bill;
    if(!pay&&!bill) return false;
    if(pay&&(pay.phase!=="done"||pay.totalIssues>0)) return false;
    if(bill&&(bill.phase!=="done"||bill.totalIssues>0)) return false;
    return true;
  }
  function canAdvanceStep2(d) { return !!(d.pay||d.bill); }

  function validationStep() {
    var d=S.draft;
    var anyVal=(d.pay&&d.pay.phase==="validating")||(d.bill&&d.bill.phase==="validating");
    var hasErr=(d.pay&&d.pay.phase==="done"&&d.pay.totalIssues>0)||(d.bill&&d.bill.phase==="done"&&d.bill.totalIssues>0);
    var banner=anyVal
      ?'<div class="rc2-vld-banner rc2-vld-banner--info">'+ico("Refresh")+'Running checks… results appear automatically.</div>'
      :hasErr?'<div class="rc2-vld-banner rc2-vld-banner--err">'+ico("Alert")+'Errors found. Go back and upload corrected files before continuing.</div>'
      :'<div class="rc2-vld-banner rc2-vld-banner--ok">'+ico("Check")+'All files passed validation. You can proceed to review.</div>';
    return'<div class="rc2-vld-step">'+banner+(d.pay?validationPanel(d.pay,"pay"):"")+(d.bill?validationPanel(d.bill,"bill"):"")+'</div>';
  }

  function alwaysEditablePayRow(r,rowIdx,edits) {
    var e=edits&&edits[rowIdx];
    var hrs=(e&&e.hrs!=null?e.hrs:r.hrs),pay=(e&&e.pay!=null?e.pay:r.pay),wtr=(e&&e.wtr!=null?e.wtr:r.wtr),sick=(e&&e.sick!=null?e.sick:r.sick);
    var direct=Math.round((pay+wtr+sick)*100)/100;
    return'<tr><td>'+esc(r.s)+'</td><td>'+esc(r.loc)+'</td><td>'+esc(r.jt)+'</td>'+
      '<td class="num rc2-edit-cell-always"><input class="rc2-edit-in rc2-edit-in--inline" type="number" step="0.5" min="0" value="'+Number(hrs)+'" data-ec="pay-'+rowIdx+'-hrs" title="Hrs/week" /></td>'+
      '<td class="num rc2-edit-cell-always"><input class="rc2-edit-in rc2-edit-in--inline" type="number" step="0.01" min="0" value="'+Number(pay).toFixed(2)+'" data-ec="pay-'+rowIdx+'-pay" title="Pay rate" /></td>'+
      '<td class="num rc2-edit-cell-always"><input class="rc2-edit-in rc2-edit-in--inline" type="number" step="0.001" min="0" value="'+Number(wtr).toFixed(3)+'" data-ec="pay-'+rowIdx+'-wtr" title="Holiday" /></td>'+
      '<td class="num rc2-edit-cell-always"><input class="rc2-edit-in rc2-edit-in--inline" type="number" step="0.001" min="0" value="'+Number(sick).toFixed(3)+'" data-ec="pay-'+rowIdx+'-sick" title="Sick pay" /></td>'+
      '<td class="num rc2-strong">'+gbp(direct)+'</td></tr>';
  }
  function alwaysEditableBillRow(r,rowIdx,edits) {
    var e=edits&&edits[rowIdx],m=(e&&e.margin!=null?e.margin:r.margin),c=Math.round((r.direct+m)*100)/100;
    return'<tr><td>'+esc(r.s)+'</td><td>'+esc(r.loc)+'</td><td>'+esc(r.jt)+'</td>'+
      '<td class="num">'+gbp(r.eni)+'</td><td class="num">'+gbp(r.pen)+'</td><td class="num">'+gbp(r.levy)+'</td>'+
      '<td class="num">'+gbp(r.direct)+'</td>'+
      '<td class="num rc2-edit-cell-always"><input class="rc2-edit-in rc2-edit-in--inline" type="number" step="0.01" min="0" value="'+Number(m).toFixed(2)+'" data-ec="bill-'+rowIdx+'-margin" /></td>'+
      '<td class="num rc2-bill">'+gbp(c)+'</td></tr>';
  }
  function alwaysEditableTable(kind,rowsWithIdx,edits) {
    var cols=kind==="pay"?PAY_COLS:BILL_COLS;
    var editIdxs=kind==="pay"?{3:1,4:1,5:1,6:1}:{7:1};
    var thead='<thead><tr>'+cols.map(function(c,i){return'<th'+(i>=3?' class="num"':'')+(editIdxs[i]?' data-edit-col="1"':'')+'>'+c+(editIdxs[i]?' '+ico("Edit"):'')+' </th>';}).join("")+'</tr></thead>';
    var norm=rowsWithIdx.length&&rowsWithIdx[0].row!==undefined?rowsWithIdx:rowsWithIdx.map(function(r,i){return{row:r,idx:i};});
    var tbody='<tbody>'+norm.map(function(ri){return kind==="pay"?alwaysEditablePayRow(ri.row,ri.idx,edits):alwaysEditableBillRow(ri.row,ri.idx,edits);}).join("")+'</tbody>';
    return'<div class="proto-table-wrap rc2-table-wrap rc2-editable-wrap"><table class="proto-table rc2-table rc2-editable-table">'+thead+tbody+'</table></div>';
  }

  // ---- Rate Engine version helpers (reads from window.RE if loaded) ----
  function getReEngineVersions(engineId) {
    try {
      var re = window.RE;
      if (!re) return null;
      // Lazily initialise RE state if the Rate Engine page hasn't been visited yet
      if (!re.state && re._build) re._build();
      if (!re.state || !re.state.configs) return null;
      var cfg = null;
      re.state.configs.forEach(function(c){ if(c.id===engineId) cfg=c; });
      if (!cfg || !cfg.versions || !cfg.versions.length) return null;
      var active=null, draft=null;
      cfg.versions.forEach(function(v){
        if(v.id===cfg.activeVersionId) active=v;
        if(v.status==="draft"&&!draft) draft=v;
      });
      return { active:active||cfg.versions[0], draft:draft, all:cfg.versions, legalEntity:cfg.legalEntity||'' };
    } catch(e) { return null; }
  }
  function resolvedEngineVersionLabel(d) {
    var vers=getReEngineVersions(d.engineId);
    if(!vers) return engineById(d.engineId).version;
    if(!d.engineVersionId) return vers.active?vers.active.label:engineById(d.engineId).version;
    var found=null; vers.all.forEach(function(x){if(x.id===d.engineVersionId)found=x;});
    return found?found.label:engineById(d.engineId).version;
  }
  // Returns the active version label for an engine from RE (falls back to ENGINES static).
  function resolvedEngineVersion(engineId) {
    var vers=getReEngineVersions(engineId);
    if(vers&&vers.active) return vers.active.label;
    return engineById(engineId).version;
  }

  function engineVersionPicker(engineId, selectedId) {
    var vers=getReEngineVersions(engineId);
    var eng=engineById(engineId);
    var fieldLabel='<span class="rc2-field-l">Pricing configuration version <em class="rc2-field-h">\u00b7 which structure applies to this upload</em></span>';

    if(!vers) {
      // RE not yet initialised — show static active version as a read-only confirmation
      return '<div class="rc2-field">'+fieldLabel+
        '<div class="rc2-ever-only">'+ico("Check")+'<strong>'+esc(eng.legalEntity)+' \u00b7 '+esc(eng.version)+'</strong> \u2014 currently live</div>'+
        '</div>';
    }

    // Build selectable list: every non-archived version (published + draft)
    var opts=vers.all.filter(function(v){return v.status!=='archived';});
    if(!opts.length) opts=vers.all.slice(0,1); // absolute fallback

    var effectiveId=selectedId||(vers.active&&vers.active.id)||(opts[0]&&opts[0].id);

    if(opts.length===1) {
      var only=opts[0];
      var onlyDispStatus=only.status==='published'?'active':only.status;
      var onlyDispLabel=onlyDispStatus==='active'?'Active':'Draft';
      return '<div class="rc2-field">'+fieldLabel+
        '<div class="rc2-ever-only">'+ico("Check")+
          (vers.legalEntity?'<strong>'+esc(vers.legalEntity)+' \u00b7 '+esc(only.label)+'</strong>':'<strong>'+esc(only.label)+'</strong>')+
          '<span class="rc2-ever-status rc2-ever-status--'+onlyDispStatus+'">'+onlyDispLabel+'</span>'+
          '<span class="rc2-ever-note">\u2014 '+esc(only.note||'Currently live structure')+'</span>'+
        '</div>'+
        '</div>';
    }

    return '<div class="rc2-field">'+fieldLabel+
      '<div class="rc2-ever-pick">'+
        opts.map(function(o){
          var on=effectiveId===o.id;
          var dispStatus=o.status==='published'?'active':o.status;
          var dispLabel=dispStatus==='active'?'Active':'Draft';
          return'<button type="button" class="rc2-ever-opt'+(on?' is-on':'')+'" data-rc2="engine-ver" data-ver-id="'+esc(o.id)+'">'+
            '<span class="rc2-ever-radio">'+(on?ico("Check"):"")+'</span>'+
            '<span class="rc2-ever-main">'+
              '<span class="rc2-ever-label">'+(vers.legalEntity?esc(vers.legalEntity)+' \u00b7 ':'')+esc(o.label)+'<span class="rc2-ever-status rc2-ever-status--'+dispStatus+'">'+dispLabel+'</span></span>'+
              '<span class="rc2-ever-sub">'+esc(o.note)+'</span>'+
            '</span>'+
          '</button>';
        }).join('')+
      '</div>'+
    '</div>';
  }

  function newView(){
    var d=S.draft; if(!d){S.view="list";return listView();}
    var engine=engineById(d.engineId);
    var titles={1:"Select pricing engine",2:"Upload rate cards",3:"Validation results",4:"Review \u0026 edit",5:"Publish"};
    var head=crumb([{label:"Settings"},{label:"Pricing"},{label:"Rate Cards",act:"list"},{label:d.mode==="version"?d.name+" \u2014 new version":"New rate card"}])+
      '<button class="proto-subnav-back rc2-back" data-rc2="cancel">'+ico("ArrowLeft")+(d.mode==="version"?"Back to card":"Back to rate cards")+'</button>'+
      '<div class="proto-page-head"><h1>'+titles[d.step]+'</h1></div>';

    var body="";
    if(d.step===1){
      // Step 1: engine selection + name (new) or card name + version note (version)
      var free=ENGINES.filter(function(e){return!S.cards.some(function(c){return c.engineId===e.id;});});
      if(d.mode==="new"){
        body='<div class="proto-card rc2-form">'+
          '<label class="rc2-field"><span class="rc2-field-l">Rate card name</span><input class="rc2-in" type="text" data-rc2-name placeholder="e.g. Evri rate card" value="'+esc(d.name)+'" /></label>'+
          '<div class="rc2-field"><span class="rc2-field-l">Pricing engine <em class="rc2-field-h">\u00b7 fixed after creation</em></span>'+
            '<div class="rc2-engine-pick">'+free.map(function(e){var on=d.engineId===e.id;return'<button class="rc2-engine-opt'+(on?" is-on":"")+'" data-rc2="engine" data-id="'+e.id+'"><span class="rc2-engine-opt-radio">'+(on?ico("Check"):"")+'</span><span class="rc2-engine-opt-main"><span class="rc2-engine-opt-name">'+esc(e.name)+' <em>'+resolvedEngineVersion(e.id)+'</em></span><span class="rc2-engine-opt-kicker">'+esc(e.kicker)+'</span></span></button>';}).join("")+
          '</div></div>'+
          engineVersionPicker(d.engineId, d.engineVersionId)+
        '</div>';
      } else {
        body='<div class="proto-card rc2-form">'+
          '<label class="rc2-field"><span class="rc2-field-l">Name</span>'+
            '<input class="rc2-in" type="text" data-rc2-name value="'+esc(d.name)+'" />'+
          '</label>'+
          engineVersionPicker(d.engineId, d.engineVersionId)+
        '</div>';
      }
    } else if(d.step===2){
      // Step 2: upload both files
      body='<div class="rc2-upload-grid">'+uploadSlot("pay")+uploadSlot("bill")+'</div>'+engineTemplatePanel(d.engineId, d.engineVersionId);
    } else if(d.step===3){
      // Step 3: dedicated validation view
      body=validationStep();
    } else if(d.step===4){
      // Review & edit — show real uploaded rows when available, otherwise synthetic fallback
      var card=d.cardId?findCard(d.cardId):null;
      var previewCard=card||(cardForEngine(d.engineId));
      var reviewTab=d.reviewTab||"pay";
      function rvTabBtn(id,label){return'<button class="rc2-tab'+(reviewTab===id?" is-on":"")+'" data-rc2="rv-tab" data-tab="'+id+'">'+label+'</button>';}
      var hasPay=!!d.pay, hasBill=!!d.bill;
      var activeDoc=reviewTab==="pay"?d.pay:d.bill;
      var hasRealData=!!(activeDoc&&activeDoc._parsedRows&&activeDoc._parsedRows.length);
      var tabHead='<div class="rc2-review-edit-head"><div class="rc2-tabs" role="tablist">'+
        (hasPay?rvTabBtn("pay","Pay rate card"):'')+
        (hasBill?rvTabBtn("bill","Bill rate card"):'')+
        '</div>'+(hasRealData?'<span class="rc2-review-edit-note">'+ico("Information")+esc(activeDoc.fileName)+' \u00b7 '+fmtNum(activeDoc._parsedRows.length)+' rows</span>':'<span class="rc2-review-edit-note">'+ico("Edit")+'Hrs, pay rate and holiday editable</span>')+'</div>';
      var tableContent;
      if(hasRealData){
        tableContent=uploadedEditableTable(activeDoc, reviewTab);
      } else {
        var allRows=(reviewTab==="pay")?(previewCard?payLines(previewCard):[]):(previewCard?billLines(previewCard):[]);
        var rvFlt=d.reviewFilters||{},rvQ=(d.reviewSearch||"").toLowerCase().trim();
        var filteredIdx=allRows.map(function(r,i){return{row:r,idx:i};}).filter(function(ri){
          var r=ri.row;
          if(rvFlt.s&&rvFlt.s!=="all"&&r.s!==rvFlt.s)return false;
          if(rvFlt.loc&&rvFlt.loc!=="all"&&r.loc!==rvFlt.loc)return false;
          if(rvFlt.jt&&rvFlt.jt!=="all"&&r.jt!==rvFlt.jt)return false;
          if(rvQ&&(r.s+" "+r.loc+" "+r.jt).toLowerCase().indexOf(rvQ)<0)return false;
          return true;
        });
        var hasRvFlt=(rvFlt.s&&rvFlt.s!=="all")||(rvFlt.loc&&rvFlt.loc!=="all")||(rvFlt.jt&&rvFlt.jt!=="all")||rvQ;
        function rvSel(field,label,opts,val){return'<label class="rc2-flt-label">'+label+'<select class="rc2-flt-sel" data-rc2="rv-filter" data-field="'+field+'"><option value="all"'+((!val||val==="all")?" selected":"")+'>All</option>'+uniq(opts).map(function(o){return'<option value="'+esc(o)+'"'+(val===o?" selected":"")+'>'+esc(o)+'</option>';}).join("")+'</select></label>';}
        var rvFilterBar='<div class="rc2-filter-bar">'+
          '<div class="rc2-search">'+ico("Search")+'<input class="rc2-search-in" type="text" data-rc2="rv-search" placeholder="Search…" value="'+esc(d.reviewSearch||"")+'" /></div>'+
          rvSel("s","Supplier",allRows.map(function(r){return r.s;}),rvFlt.s)+
          rvSel("loc","Site",allRows.map(function(r){return r.loc;}),rvFlt.loc)+
          rvSel("jt","Job type",allRows.map(function(r){return r.jt;}),rvFlt.jt)+
          (hasRvFlt?'<button class="rc2-flt-clear" data-rc2="clear-rv-filters">'+ico("Cancel")+'Clear</button>':'')+
          '<span class="rc2-flt-count">'+filteredIdx.length+(filteredIdx.length!==allRows.length?" of "+allRows.length:"")+" line"+(filteredIdx.length===1?"":"s")+'</span>'+
        '</div>';
        tableContent=rvFilterBar+(allRows.length?alwaysEditableTable(reviewTab,filteredIdx,reviewTab==="pay"?d.editedPay:d.editedBill):'<div class="rc2-flt-empty">'+ico("Information")+'Rate structure populated from the uploaded file.</div>');
      }
      body='<div class="proto-card rc2-review-edit">'+tabHead+tableContent+'</div>';
    } else if(d.step===5){
      var hasEdits=Object.keys(d.editedPay||{}).length+Object.keys(d.editedBill||{}).length;
      body='<div class="proto-card rc2-review"><div class="rc2-review-grid">'+
        '<div class="rc2-review-row"><span class="rc2-review-l">Name</span><span class="rc2-review-v">'+esc(d.name||"Untitled")+'</span></div>'+
        '<div class="rc2-review-row"><span class="rc2-review-l">Engine</span><span class="rc2-review-v"><span class="rc2-engine-tag">'+ico("DataGridView")+esc(engine.name)+' <em>'+resolvedEngineVersionLabel(d)+'</em></span></span></div>'+
        '<div class="rc2-review-row"><span class="rc2-review-l">Pay rate card</span><span class="rc2-review-v">'+(d.pay?'<span class="rc2-ver-doc">'+ico("Excel")+esc(d.pay.fileName)+'</span> <span class="rc2-review-meta">'+fmtNum(d.pay.rows)+' lines</span>':'<span class="rc2-review-empty">Not uploaded</span>')+'</span></div>'+
        '<div class="rc2-review-row"><span class="rc2-review-l">Bill rate card</span><span class="rc2-review-v">'+(d.bill?'<span class="rc2-ver-doc">'+ico("Excel")+esc(d.bill.fileName)+'</span> <span class="rc2-review-meta">'+fmtNum(d.bill.rows)+' lines</span>':'<span class="rc2-review-empty">Not uploaded</span>')+'</span></div>'+
        (hasEdits?'<div class="rc2-review-row"><span class="rc2-review-l">Edits</span><span class="rc2-review-v rc2-review-edits">'+ico("Edit")+hasEdits+' cell'+(hasEdits>1?'s':'')+' edited manually</span></div>':'')+
      '</div><div class="rc2-review-date"><label class="rc2-field-l" for="rc2-eff">Effective from</label><input class="rc2-in rc2-in--date" id="rc2-eff" type="date" value="'+d.effDate+'" data-rc2-eff /></div></div>';
    }

    var canNext;
    if(d.step===1) canNext=d.mode==="version"||(d.name||"").trim()&&d.engineId;
    else if(d.step===2) canNext=canAdvanceStep2(d);
    else if(d.step===3) canNext=canAdvance(d);
    else canNext=true;
    var foot='<div class="rc2-foot">';
    if(d.step>1)foot+='<button class="proto-btn proto-btn--secondary" data-rc2="step-back">'+ico("ArrowLeft")+'Back</button>';
    else foot+='<button class="proto-btn proto-btn--ghost" data-rc2="cancel">Cancel</button>';
    foot+='<span class="rc2-foot-sp"></span>';
    if(d.step===3&&!canAdvance(d)&&canAdvanceStep2(d)){foot+='<span class="rc2-foot-warn">'+ico("Alert")+( ((d.pay&&d.pay.phase==="validating")||(d.bill&&d.bill.phase==="validating")) ?"Waiting for validation…":"Fix errors before continuing")+'</span>';}
    if(d.step<5)foot+='<button class="proto-btn proto-btn--primary" data-rc2="step-next"'+(canNext?"":" disabled")+'>Continue'+ico("ArrowRight")+'</button>';
    else foot+='<button class="proto-btn proto-btn--primary" data-rc2="create">'+ico("Check")+(d.mode==="version"?"Publish new version":"Create rate card")+'</button>';
    foot+='</div>';
    return'<div class="rc2 rc2-new">'+head+stepper(d)+body+'<input type="file" data-rc2-file accept=".xlsx,.xls,.csv" hidden />'+foot+'</div>';
  }

  function createFromDraft(){
    var d=S.draft; if(!d) return;
    Object.keys(_vldTimers).forEach(function(k){clearTimeout(_vldTimers[k]);});
    if(d.mode==="version"){
      var card=findCard(d.cardId);if(!card){S.view="list";RC2._render();return;}
      var no=Math.max.apply(null,card.versions.map(function(v){return v.version;}))+1;
      card.versions.push({version:no,effectiveDate:d.effDate,appliedAt:new Date().toISOString(),note:"Uploaded "+fmtDay(TODAY)+".",payFile:d.pay?d.pay.fileName:null,billFile:d.bill?d.bill.fileName:null,_payRows:d.pay?{headers:d.pay._headers,rows:d.pay._parsedRows}:null,_billRows:d.bill?{headers:d.bill._headers,rows:d.bill._parsedRows}:null});
      card.workingStatus=null; saveCards();
      S.view="detail";S.selectedId=card.id;S.detailTab="pay";S.draft=null;RC2._render();
      toast("v"+no+(d.effDate>TODAY?" scheduled for "+fmtDay(d.effDate):" published \u00b7 live from "+fmtDay(d.effDate)));return;
    }
    var id="rc-"+Date.now().toString(36);
    var nc={id:id,name:(d.name||"Untitled").trim(),engineId:d.engineId,filter:{},workingStatus:null,createdAt:TODAY,versions:[{version:1,effectiveDate:d.effDate,appliedAt:new Date().toISOString(),note:"Created "+fmtDay(TODAY)+".",payFile:d.pay?d.pay.fileName:null,billFile:d.bill?d.bill.fileName:null,_payRows:d.pay?{headers:d.pay._headers,rows:d.pay._parsedRows}:null,_billRows:d.bill?{headers:d.bill._headers,rows:d.bill._parsedRows}:null}]};
    S.cards.push(nc);saveCards();
    S.view="detail";S.selectedId=id;S.detailTab="pay";S.draft=null;RC2._render();
    toast("\u201c"+nc.name+"\u201d created on the "+engineById(d.engineId).name+" engine");
  }

  // ============================================================ EXPORT
  function exportDoc(card,kind,fmt){
    var engine=engineById(card.engineId),live=liveVer(card),vlabel=live?"v"+live.version:"v1";
    var flt=S.detailFilters||{},q=S.detailSearch||"";
    var rows=applyFilters(kind==="pay"?payLines(card):billLines(card),flt,q);
    var aoa,sheetName,fbase;
    if(kind==="pay"){aoa=[["Supplier","Site","Job type","Hrs","Pay rate (\u00a3/hr)","Holiday (\u00a3/hr)","Sick (\u00a3/hr)","Direct cost (\u00a3/hr)"]];rows.forEach(function(r){aoa.push([r.s,r.loc,r.jt,r.hrs,r.pay,r.wtr,r.sick,r.direct]);});sheetName="Pay rates";fbase=card.name+" - Pay rate card "+vlabel;}
    else{aoa=[["Supplier","Site","Job type","Emp. NI (\u00a3/hr)","Pension (\u00a3/hr)","Levy (\u00a3/hr)","Direct cost (\u00a3/hr)","Margin (\u00a3/hr)","Bill rate (\u00a3/hr)"]];rows.forEach(function(r){aoa.push([r.s,r.loc,r.jt,r.eni,r.pen,r.levy,r.direct,r.margin,r.charge]);});sheetName="Bill rates";fbase=card.name+" - Bill rate card "+vlabel;}
    var banner=[[engine.name+" \u00b7 "+card.name+" \u00b7 "+(kind==="pay"?"Pay":"Bill")+" rate card "+vlabel],[]];
    var full=banner.concat(aoa),safe=fbase.replace(/[^\w\- ]+/g,"").replace(/\s+/g,"-");
    if(fmt==="xlsx"&&window.XLSX){try{var ws=XLSX.utils.aoa_to_sheet(full);ws["!cols"]=full[2].map(function(){return{wch:16};});var wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,sheetName);XLSX.writeFile(wb,safe+".xlsx");toast((kind==="pay"?"Pay":"Bill")+" rate card exported");return;}catch(e){}}
    var csv=full.map(function(r){return r.map(function(c){c=c==null?"":String(c);return /[",\n]/.test(c)?'"'+c.replace(/"/g,'""')+'"':c;}).join(",");}).join("\n");
    var blob=new Blob([csv+"\n"],{type:"text/csv;charset=utf-8"});var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=safe+".csv";document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(a.href);
    toast((kind==="pay"?"Pay":"Bill")+" rate card exported \u00b7 .csv");
  }

  // ============================================================ EVENTS
  function stepNext(){
    var d=S.draft;if(!d) return;
    if(d.step===1){if(!(d.mode==="version"||(d.name||"").trim()&&d.engineId))return;d.step=2;}
    else if(d.step===2){if(!canAdvanceStep2(d))return;d.step=3;}
    else if(d.step===3){if(!canAdvance(d))return;d.step=4;}
    else if(d.step===4){d.step=5;}
    RC2._render();
  }
  function stepBack(){var d=S.draft;if(!d)return;if(d.step>1){d.step--;RC2._render();}}

  RC2._wireOnce=function(){
    var root=RC2._root; if(!root||root.__rc2Wired) return; root.__rc2Wired=true;
    var _searchTimer=null;

    root.addEventListener("click",function(e){
      var el=e.target.closest("[data-rc2]");if(!el)return;
      var act=el.getAttribute("data-rc2");
      switch(act){
        case"list":S.view="list";S.selectedId=null;S.draft=null;Object.keys(_vldTimers).forEach(function(k){clearTimeout(_vldTimers[k]);});RC2._render();break;
        case"open":S.view="detail";S.selectedId=el.getAttribute("data-id");S.detailVersionId=null;S.detailTab="pay";S.detailFilters={};S.detailGroupBy="none";S.detailSearch="";RC2._render();break;
        case"toggle-expand":{var tid=el.getAttribute("data-id");S.expandedCardId=(S.expandedCardId===tid?null:tid);S.inlineVerKey=null;RC2._render();break;}
        case"open-review":{var rc=findCard(el.getAttribute("data-id"));if(rc)startVersionReview(rc);break;}
        case"newver-inline":{var rnc=findCard(el.getAttribute("data-id"));if(rnc)startVersion(rnc);break;}
        case"open-ver":{var ovc=findCard(el.getAttribute("data-id"));if(ovc){S.view="detail";S.selectedId=ovc.id;S.detailVersionId=Number(el.getAttribute("data-ver"));S.detailTab="pay";S.detailFilters={};S.detailGroupBy="none";S.detailSearch="";}RC2._render();break;}
        case"pick-ver":{S.detailVersionId=Number(el.getAttribute("data-ver"));S.detailRatesOpen=true;S.detailTab="pay";S.detailFilters={};RC2._render();break;}
        case"select-inline-ver":{var vkey=el.getAttribute("data-id")+":"+el.getAttribute("data-ver");S.inlineVerKey=(S.inlineVerKey===vkey?null:vkey);if(!S.inlineVerTab)S.inlineVerTab="pay";RC2._render();break;}
        case"inline-tab":{S.inlineVerTab=el.getAttribute("data-tab");RC2._render();break;}
        case"new":startNew(el.getAttribute("data-engine")||null);break;
        case"newver":{var c=findCard(S.selectedId);if(c)startVersion(c);break;}
        case"cancel":if(S.draft&&S.draft.mode==="version"){var cc=findCard(S.draft.cardId);if(cc&&cc.workingStatus)setCardWorkingStatus(cc,null);S.view="detail";S.selectedId=S.draft.cardId;}else{S.view="list";}Object.keys(_vldTimers).forEach(function(k){clearTimeout(_vldTimers[k]);});S.draft=null;RC2._render();break;
        case"tab":if(S.detailTab!==el.getAttribute("data-tab")){S.detailTab=el.getAttribute("data-tab");RC2._render();}break;
        case"rv-tab":if(S.draft){S.draft.reviewTab=el.getAttribute("data-tab");S.draft._editCell=null;S.draft.reviewFilters={};S.draft.reviewSearch="";RC2._render();}break;
        case"clear-rv-filters":if(S.draft){S.draft.reviewFilters={};S.draft.reviewSearch="";RC2._render();}break;
        case"export":{var ec=findCard(S.selectedId);if(ec)exportDoc(ec,el.getAttribute("data-kind"),el.getAttribute("data-fmt"));break;}
        case"engine":if(S.draft){S.draft.engineId=el.getAttribute("data-id");S.draft.engineVersionId=null;RC2._render();}break;
        case"engine-ver":if(S.draft){S.draft.engineVersionId=el.getAttribute("data-ver-id");RC2._render();}break;
        case"pick":{S._pickKind=el.getAttribute("data-kind");var inp=root.querySelector("[data-rc2-file]");if(inp)inp.click();break;}
        case"sample":loadSample(el.getAttribute("data-kind"));break;
        case"clearfile":if(S.draft){var k2=el.getAttribute("data-kind");clearTimeout(_vldTimers[k2]);delete _vldTimers[k2];S.draft[k2]=null;RC2._render();}break;
        case"step-next":stepNext();break;
        case"step-back":stepBack();break;
        case"create":createFromDraft();break;
        case"clear-filters":S.detailFilters={};S.detailSearch="";RC2._render();break;
        case"toggle-rates":S.detailRatesOpen=!S.detailRatesOpen;RC2._render();break;
        case"remove-card":S.removeCardConfirm=S.selectedId;RC2._render();break;
        case"remove-card-confirm":{var rmcCard=findCard(S.removeCardConfirm);if(rmcCard){var rmcName=rmcCard.name;S.cards=S.cards.filter(function(c){return c.id!==rmcCard.id;});saveCards();S.removeCardConfirm=null;S.view='list';S.selectedId=null;RC2._render();toast('\u201c'+rmcName+'\u201d removed');}break;}
        case"remove-card-cancel":S.removeCardConfirm=null;RC2._render();break;
        case"remove-ver":{
          var rmCard=findCard(el.getAttribute("data-card-id"));
          var rmVer=parseInt(el.getAttribute("data-ver"),10);
          if(rmCard){
            rmCard.versions=rmCard.versions.filter(function(v){return v.version!==rmVer;});
            saveCards();
            if(S.detailVersionId===rmVer)S.detailVersionId=null;
            RC2._render();
            toast("Scheduled version removed");
          }
          break;
        }
        case"view-mode":S.listViewMode=el.getAttribute("data-mode");RC2._render();break;
        case"dl-template":{var dlDraft=S.draft;if(window.RE&&window.RE.downloadBothTemplates){window.RE.downloadBothTemplates(dlDraft&&dlDraft.engineId,dlDraft&&dlDraft.engineVersionId);}else toast("Rate Engine not loaded");break;}
        case"vld-type":{var vk=el.getAttribute("data-vld-kind"),vt=el.getAttribute("data-vld-type"),dd=S.draft&&S.draft[vk];if(dd){dd.errFilter=dd.errFilter||{};dd.errFilter.typeKey=(dd.errFilter.typeKey===vt?null:vt);RC2._render();}break;}
        case"vld-type-clear":{var vk2=el.getAttribute("data-vld-kind"),dd2=S.draft&&S.draft[vk2];if(dd2&&dd2.errFilter){dd2.errFilter.typeKey=null;RC2._render();}break;}
        case"vld-sev":{var vk3=el.getAttribute("data-vld-kind"),dd3=S.draft&&S.draft[vk3];if(dd3){dd3.errFilter=dd3.errFilter||{};dd3.errFilter.sev=el.getAttribute("data-vld-sev");RC2._render();}break;}
        case"vld-tab":{var vk4=el.getAttribute("data-vld-kind"),dd4=S.draft&&S.draft[vk4];if(dd4){dd4.errFilter=dd4.errFilter||{};dd4.errFilter.previewTab=el.getAttribute("data-vld-val");RC2._render();}break;}
        default:break;
      }
    });

    // Cell edit click (not delegated through data-rc2)
    root.addEventListener("click",function(e){
      var el=e.target.closest("[data-ec]");if(!el||e.target.tagName==="INPUT"||!S.draft)return;
      var key=el.getAttribute("data-ec");S.draft._editCell=key;RC2._render();
      var inp=root.querySelector('[data-ec="'+key+'"] .rc2-edit-in,[data-ec="'+key+'"].rc2-edit-in');
      if(!inp)inp=root.querySelector('.rc2-edit-in[data-ec="'+key+'"]');
      if(!inp)inp=root.querySelector('.rc2-edit-in');
      if(inp){inp.focus();inp.select();}
    });

    root.addEventListener("change",function(e){
      var el=e.target;
      if(el.hasAttribute("data-rc2-file")){var f=el.files&&el.files[0];if(f)receiveFile(f,S._pickKind||"pay");el.value="";return;}
      var act=el.getAttribute("data-rc2");
      if(act==="filter"){S.detailFilters=S.detailFilters||{};S.detailFilters[el.getAttribute("data-field")]=el.value;RC2._render();return;}
      if(act==="rv-filter"){if(S.draft){S.draft.reviewFilters=S.draft.reviewFilters||{};S.draft.reviewFilters[el.getAttribute("data-field")]=el.value;RC2._render();}return;}
      if(act==="groupby"){S.detailGroupBy=el.value;RC2._render();return;}
    });

    root.addEventListener("blur",function(e){
      var el=e.target;
      // Upload editable table cells
      if(el.hasAttribute("data-ue-kind")&&S.draft){
        var kind=el.getAttribute("data-ue-kind"),ri=parseInt(el.getAttribute("data-ue-ri"),10),ci=parseInt(el.getAttribute("data-ue-ci"),10);
        var val=parseFloat(el.value);
        if(!isNaN(val)){
          if(!S.draft._uploadEdits)S.draft._uploadEdits={pay:{},bill:{}};
          if(!S.draft._uploadEdits[kind])S.draft._uploadEdits[kind]={};
          if(!S.draft._uploadEdits[kind][ri])S.draft._uploadEdits[kind][ri]={};
          S.draft._uploadEdits[kind][ri][ci]=val;
          // Also patch the parsed row so downstream steps see the edit
          var doc=S.draft[kind];
          if(doc&&doc._parsedRows&&doc._parsedRows[ri])doc._parsedRows[ri][ci]=val;
        }
        return;
      }
      if(!el.classList.contains("rc2-edit-in")||!S.draft) return;
      var key=el.getAttribute("data-ec"); if(!key) return;
      var val=parseFloat(el.value);
      if(isNaN(val)||val<0) return;
      // key format: "pay-rowIdx-field" or "bill-rowIdx-field"
      var parts=key.split("-"),kind=parts[0],rowIdx=parseInt(parts[1],10),field=parts[2];
      var eu={}; eu[field]=val;
      if(kind==="pay"){ S.draft.editedPay=S.draft.editedPay||{}; S.draft.editedPay[rowIdx]=Object.assign({},S.draft.editedPay[rowIdx],eu); }
      else{ S.draft.editedBill=S.draft.editedBill||{}; S.draft.editedBill[rowIdx]=Object.assign({},S.draft.editedBill[rowIdx],eu); }
      S.draft._editCell=null; RC2._render();
    }, true);

    root.addEventListener("keydown",function(e){
      var el=e.target;
      if(el.classList.contains("rc2-edit-in")){
        if(e.key==="Enter"){el.blur();}
        if(e.key==="Escape"){S.draft._editCell=null;RC2._render();}
      }
      var d=e.target.closest('[data-rc2="pick"]');
      if(d&&(e.key==="Enter"||e.key===" ")){e.preventDefault();S._pickKind=d.getAttribute("data-kind");var inp=root.querySelector("[data-rc2-file]");if(inp)inp.click();}
    });

    root.addEventListener("dragover",function(e){var d=e.target.closest('[data-rc2="pick"]');if(d){e.preventDefault();d.classList.add("is-over");}});
    root.addEventListener("dragleave",function(e){var d=e.target.closest('[data-rc2="pick"]');if(d)d.classList.remove("is-over");});
    root.addEventListener("drop",function(e){var d=e.target.closest('[data-rc2="pick"]');if(!d)return;e.preventDefault();d.classList.remove("is-over");S._pickKind=d.getAttribute("data-kind");receiveFile(e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0],S._pickKind);});

    var st=null;
    root.addEventListener("input",function(e){
      var el=e.target;
      if(el.hasAttribute("data-rc2-name")){if(S.draft){S.draft.name=el.value;var nx=root.querySelector('[data-rc2="step-next"]');if(nx)nx.disabled=!(el.value.trim()&&S.draft.engineId);}}
      if(el.hasAttribute("data-rc2-note")){if(S.draft)S.draft.note=el.value;}
      if(el.hasAttribute("data-rc2-eff")){if(S.draft)S.draft.effDate=el.value;}
      var act=el.getAttribute("data-rc2");
      if(act==="rv-search"){if(st)clearTimeout(st);var rv=el.value,rvp=el.selectionStart;st=setTimeout(function(){if(S.draft)S.draft.reviewSearch=rv;RC2._render();var ni=RC2._root&&RC2._root.querySelector('[data-rc2="rv-search"]');if(ni){ni.focus();try{ni.setSelectionRange(rvp,rvp);}catch(x){}}},140);}
      if(act==="search"){if(st)clearTimeout(st);var v=el.value,p=el.selectionStart;st=setTimeout(function(){S.detailSearch=v;RC2._render();var ni=root.querySelector('[data-rc2="search"]');if(ni){ni.focus();try{ni.setSelectionRange(p,p);}catch(x){}}},140);}
      if(act==="vld-q"){var k3=el.getAttribute("data-vld-kind"),v2=el.value,p2=el.selectionStart;if(st)clearTimeout(st);st=setTimeout(function(){var dd=S.draft&&S.draft[k3];if(dd){dd.errFilter=dd.errFilter||{};dd.errFilter.q=v2;RC2._render();var ni2=root.querySelector('[data-rc2="vld-q"][data-vld-kind="'+k3+'"]');if(ni2){ni2.focus();try{ni2.setSelectionRange(p2,p2);}catch(x){}}}},140);}
    });
  };

})();
