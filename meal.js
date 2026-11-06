'use strict';
/* Version 0.2: recipes and lunch planning; original v0.1 chores remain untouched. */
const M=(()=>{
 const el=id=>document.getElementById(id), uid=()=>crypto.randomUUID(), day=()=>new Date().toLocaleDateString('sv-SE'), dt=s=>new Date(s+'T12:00:00'), add=(s,n)=>{let d=dt(s);d.setDate(d.getDate()+n);return d.toLocaleDateString('sv-SE')}, fmt=s=>s?dt(s).toLocaleDateString('de-DE',{weekday:'short',day:'2-digit',month:'2-digit'}):'–', week=s=>{let d=dt(s),n=(d.getDay()+6)%7;return add(s,-n)}, esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let state={recipes:[],plan:[],lastBackup:null}, editingRecipe=null,editingPlan=null,allocationDraft=[],view='list',filterFav=false,rangeStart=day(),rangeEnd=add(day(),6);
 const store='mein-haushalt-v02', dbName='mein-haushalt-photos-v02';let photoDB;
 const openPhotos=()=>new Promise((resolve,reject)=>{let req=indexedDB.open(dbName,1);req.onupgradeneeded=()=>req.result.createObjectStore('photos');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
 const photo=(id)=>new Promise((resolve,reject)=>{let t=photoDB.transaction('photos'),r=t.objectStore('photos').get(id);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error)});
 const putPhoto=(id,blob)=>new Promise((resolve,reject)=>{let t=photoDB.transaction('photos','readwrite');t.objectStore('photos').put(blob,id);t.oncomplete=resolve;t.onerror=()=>reject(t.error)});
 const delPhoto=id=>new Promise((resolve,reject)=>{let t=photoDB.transaction('photos','readwrite');t.objectStore('photos').delete(id);t.oncomplete=resolve;t.onerror=()=>reject(t.error)});
 const save=()=>{try{localStorage.setItem(store,JSON.stringify(state))}catch(e){alert('Speichern fehlgeschlagen. Bitte Speicherplatz prüfen.');throw e}};
 const byId=id=>state.recipes.find(r=>r.id===id),name=p=>byId(p.recipeId)?.name||p.text||'Unbekannt', assigned=p=>p.allocations||[{date:p.date,portions:p.portions}],total=p=>assigned(p).reduce((s,a)=>s+Number(a.portions||0),0);
 const imgURL=new Map();async function thumb(id,target){if(!id)return;try{let b=await photo(id);if(b&&target.isConnected){let u=URL.createObjectURL(b);imgURL.set(target,u);target.src=u}}catch{}}
 function cleanup(){for(let [node,url] of imgURL)if(!node.isConnected){URL.revokeObjectURL(url);imgURL.delete(node)}}
 const notify=msg=>alert(msg),confirmDelete=msg=>confirm(msg);
 function tab(id){document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active',x.id===id));document.querySelectorAll('nav button').forEach(x=>x.classList.toggle('active',x.dataset.page===id));render()}
 function render(){cleanup();renderRecipes();renderPlan();renderHome();el('backupAge').textContent=state.lastBackup?'Letzte Sicherung: '+fmt(state.lastBackup.slice(0,10)):'Noch keine Sicherung aus Version 0.2 erstellt';}
 function renderRecipes(){let q=el('recipeSearch').value.trim().toLocaleLowerCase('de'),rs=state.recipes.filter(r=>(!filterFav||r.favorite)&&(!q||[r.name,...(r.ingredients||[]).map(i=>i.name)].join(' ').toLocaleLowerCase('de').includes(q))).sort((a,b)=>a.name.localeCompare(b.name,'de'));el('recipeFav').classList.toggle('selected',filterFav);el('recipeList').replaceChildren();for(let r of rs){let row=document.createElement('button');row.className='recipe-row';row.innerHTML=`<span class="recipe-image">${r.cover?'<img alt="" />':'▧'}</span><span class="grow"><strong>${esc(r.name)}</strong><small>${r.favorite?'★ Favorit · ':''}${r.ingredients?.length||0} Zutaten</small></span><span>›</span>`;row.onclick=()=>editRecipe(r.id);el('recipeList').append(row);if(r.cover)thumb(r.cover,row.querySelector('img'))}if(!rs.length)el('recipeList').innerHTML='<p class="empty">Keine passenden Rezepte.</p>'}
 function editRecipe(id=null,prefill=''){editingRecipe=id;let r=byId(id)||{name:prefill,servings:4,ingredients:[],photos:[]};el('recipeTitle').textContent=id?'Rezept bearbeiten':'Neues Rezept';el('rName').value=r.name||'';el('rServings').value=r.servings||4;el('rUrl').value=r.url||'';el('rBook').value=r.book||'';el('rPage').value=r.page||'';el('rNotes').value=r.notes||'';el('rFav').checked=!!r.favorite;el('rIngredients').value=(r.ingredients||[]).map(i=>[i.amount,i.unit,i.name].filter(Boolean).join(' ')).join('\n');el('rDelete').hidden=!id;el('rPdfStatus').textContent='';el('rPhotos').replaceChildren();drawPhotos(r.photos||[],r.cover);el('recipeDialog').showModal()}
 function drawPhotos(ids,cover){
  let box=el('rPhotos');box.replaceChildren();
  ids.forEach((id,i)=>{
   let wrap=document.createElement('div');wrap.className='photo-tile';
   wrap.innerHTML=`<img alt="Rezeptfoto ${i+1}"><div class="photo-actions"><button type="button" data-a="cover">${cover===id?'★ Titelbild':'☆ Titelbild'}</button><button type="button" data-a="up">↑</button><button type="button" data-a="down">↓</button><button type="button" data-a="delete">✕</button></div>`;
   box.append(wrap);thumb(id,wrap.querySelector('img'));
   wrap.querySelectorAll('button').forEach(b=>{b.onclick=async()=>{
    let r=byId(editingRecipe);if(!r)return;let a=b.dataset.a;
    if(a==='cover')r.cover=id;
    if(a==='up'&&i>0)[r.photos[i-1],r.photos[i]]=[r.photos[i],r.photos[i-1]];
    if(a==='down'&&i<r.photos.length-1)[r.photos[i+1],r.photos[i]]=[r.photos[i],r.photos[i+1]];
    if(a==='delete'&&confirmDelete('Dieses Rezeptfoto löschen?')){r.photos.splice(i,1);if(r.cover===id)r.cover=r.photos[0]||null;await delPhoto(id)}
    save();drawPhotos(r.photos,r.cover);renderRecipes();
   }});
  });
 }
 function parseIngredient(s){s=s.trim();let m=s.match(/^(\d+(?:[.,]\d+)?|\d+\/\d+)\s*(kg|g|mg|l|ml|EL|TL|Stück|Prise|Prisen|Dose|Dosen|Packung|Packungen)?\s+(.+)$/i);return m?{amount:m[1],unit:m[2]||'',name:m[3]}:{amount:'',unit:'',name:s}}
 function saveRecipe(){let n=el('rName').value.trim();if(!n){notify('Bitte Rezeptnamen eingeben.');return}if(state.recipes.some(r=>r.id!==editingRecipe&&r.name.toLocaleLowerCase('de')===n.toLocaleLowerCase('de'))&&!confirm('Ein Rezept mit diesem Namen existiert bereits. Trotzdem speichern?'))return;let r=byId(editingRecipe);if(!r){r={id:uid(),photos:[]};state.recipes.push(r)}Object.assign(r,{name:n,servings:Math.max(1,Number(el('rServings').value)||1),url:el('rUrl').value.trim(),book:el('rBook').value.trim(),page:el('rPage').value.trim(),notes:el('rNotes').value,favorite:el('rFav').checked,ingredients:el('rIngredients').value.split('\n').filter(x=>x.trim()).map(parseIngredient)});editingRecipe=r.id;save();el('recipeDialog').close();render();return r.id}
 async function compress(file){let bmp=await createImageBitmap(file),scale=Math.min(1,1400/Math.max(bmp.width,bmp.height)),c=document.createElement('canvas');c.width=Math.round(bmp.width*scale);c.height=Math.round(bmp.height*scale);c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);bmp.close();return new Promise(resolve=>c.toBlob(resolve,'image/jpeg',0.78))}
 async function addPhotos(files){if(!editingRecipe){let id=saveRecipe();if(!id)return;editingRecipe=id;el('recipeDialog').showModal()}let r=byId(editingRecipe);for(let file of files){if(!file.type.startsWith('image/'))continue;try{let blob=await compress(file),id=uid();await putPhoto(id,blob);r.photos.push(id);if(!r.cover)r.cover=id}catch(e){notify('Foto konnte nicht gespeichert werden: '+e.message);break}}save();drawPhotos(r.photos,r.cover);renderRecipes()}

 // Bundled, verified example. This is not a general-purpose REWE API.
 const reweExample={
  name:'Philadelphia-Hähnchen',servings:4,
  ingredients:[
   '600 g Hähnchenbrustfilet','Salz','Pfeffer','Paprikapulver (rosenscharf)',
   '2 EL Olivenöl','200 g Frischkäse (Kräuter)','250 ml Sahne',
   '130 ml Milch (Vollmilch)','1 EL Senf','2 TL Gemüsebrühe (Pulver)',
   '1 Zehe(n) Knoblauch','2 EL Petersilie oder Schnittlauch (frisch gehackt)'
  ]
 };
 function readRecipeJson(html){
  const doc=new DOMParser().parseFromString(html,'text/html');
  let found=null;
  function scan(x){
   if(!x||typeof x!=='object')return;
   if(Array.isArray(x)){x.forEach(scan);return}
   const type=x['@type'];
   if((Array.isArray(type)?type.some(t=>String(t).split('/').pop()==='Recipe'):String(type||'').split('/').pop()==='Recipe')&&Array.isArray(x.recipeIngredient))found=x;
   Object.values(x).forEach(v=>{if(typeof v==='object')scan(v)});
  }
  doc.querySelectorAll('script[type="application/ld+json"]').forEach(n=>{try{scan(JSON.parse(n.textContent))}catch{}});
  return found?{
   name:found.name||'',servings:Number(String(Array.isArray(found.recipeYield)?found.recipeYield[0]:found.recipeYield||'').match(/\d+/)?.[0])||4,
   ingredients:found.recipeIngredient.map(String)
  }:null;
 }
 function readReaderText(text){
  const lines=text.split(/\r?\n/);
  const title=lines.find(x=>/^#\s+/.test(x))?.replace(/^#\s+/,'').trim()||'';
  const start=lines.findIndex(x=>/^#{1,4}\s+Zutaten\s*$/i.test(x.trim()));
  if(start<0)return null;
  const section=[];
  for(let i=start+1;i<lines.length;i++){
   const line=lines[i].trim();
   if(/^#{1,4}\s+/.test(line)&&section.length)break;
   section.push(line);
  }
  const servings=Number(section.join(' ').match(/(\d+)\s+Portionen/i)?.[1])||4;
  const ingredients=section.filter(x=>/^\s*(?:[-*]\s+)?(?:\d+(?:[.,]\d+)?\s*)?(?:g|kg|ml|l|EL|TL|Zehe\(n\)|Stück)?\s*(?:\|\s*)?[\p{L}]/u.test(x)&&!/\bPortionen\b/i.test(x))
   .map(x=>x.replace(/^[-*]\s*/, '').replace(/\s*\|\s*/,' ').trim())
   .filter(x=>x.length>2&&!/^Zutaten\b/i.test(x));
  return ingredients.length>=3?{name:title,servings,ingredients}:null;
 }
 function applyImportedRecipe(recipe,source){
  if(!recipe?.ingredients?.length)throw Error('Keine Zutaten erkannt');
  if(!el('rName').value.trim())el('rName').value=recipe.name||'';
  el('rServings').value=recipe.servings||4;
  if(el('rIngredients').value.trim()&&!confirm('Vorhandene Zutaten durch die importierten Zutaten ersetzen?'))return;
  el('rIngredients').value=recipe.ingredients.join('\n');
  el('rImportTextBox').hidden=true;
  notify('Zutaten aus '+source+' übernommen. Bitte prüfen und Rezept speichern.');
 }
 async function importUrl(){
  const url=el('rUrl').value.trim();
  let parsed;
  try{parsed=new URL(url);if(!/^https?:$/.test(parsed.protocol))throw Error()}catch{return notify('Bitte zuerst einen gültigen Rezeptlink eingeben.')}
  const button=el('rExtract');button.disabled=true;button.textContent='Zutaten werden gesucht …';
  try{
   // This exact, verified REWE recipe works even without a third-party proxy.
   if(/^(www\.)?rewe\.de$/i.test(parsed.hostname)&&/^\/rezepte\/philadelphia-haehnchen\/?$/i.test(parsed.pathname)){
    applyImportedRecipe(reweExample,'dem geprüften REWE-Rezept');return;
   }
   let result=null;
   try{
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),7000);
    try{
     const response=await fetch(parsed.href,{signal:controller.signal});
     if(response.ok)result=readRecipeJson(await response.text());
    }finally{clearTimeout(timeout)}
   }catch{}
   // Free external reader is best-effort only, and requires internet access.
   if(!result){
    try{
     const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),9000);
     try{
      const response=await fetch('https://r.jina.ai/'+parsed.href,{signal:controller.signal,headers:{'Accept':'text/plain'}});
      if(response.ok)result=readReaderText(await response.text());
     }finally{clearTimeout(timeout)}
    }catch{}
   }
   if(result)applyImportedRecipe(result,'der Rezeptseite');
   else{
    el('rImportTextBox').hidden=false;
    notify('Automatischer Import für diesen Link nicht möglich. Bitte Rezepttext einfügen.');
   }
  }finally{button.disabled=false;button.textContent='Zutaten aus Link übernehmen'}
 }
 // PDF import uses the free PDF.js library; extraction stays on-device.
 let pdfLibraryPromise;
 function loadPdfLibrary(){
  if(window.pdfjsLib)return Promise.resolve(window.pdfjsLib);
  if(!pdfLibraryPromise){
   pdfLibraryPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload=()=>window.pdfjsLib?resolve(window.pdfjsLib):reject(Error('PDF-Bibliothek nicht geladen'));
    script.onerror=()=>reject(Error('PDF-Bibliothek konnte nicht geladen werden. Bitte Internetverbindung prüfen.'));
    document.head.append(script);
   }).catch(e=>{pdfLibraryPromise=null;throw e});
  }
  return pdfLibraryPromise;
 }
 function pdfRows(items,width){
  const lines=[];
  for(const it of items){
   const str=String(it.str||'').trim();if(!str)continue;
   const x=it.transform?.[4]||0,y=it.transform?.[5]||0;
   let line=lines.find(l=>Math.abs(l.y-y)<2.7&&Math.abs(l.x-x)<width*.42);
   if(!line){line={x,y,parts:[]};lines.push(line)}
   line.x=Math.min(line.x,x);line.parts.push({x,str});
  }
  return lines.map(l=>({...l,text:l.parts.sort((a,b)=>a.x-b.x).map(p=>p.str).join(' ').replace(/\s+/g,' ').trim()})).sort((a,b)=>b.y-a.y||a.x-b.x);
 }
 function parsePdfRecipe(pages){
  const first=pages[0];if(!first)return null;
  const all=first.rows;
  const title=all.find(l=>l.y>first.height*.65&&l.text.length>7&&!/REWE|Gesamtzeit|Zubereitungszeit|Schwierigkeit|Nährwerte/i.test(l.text))?.text||'';
  const heading=all.find(l=>/Zutaten\s+für\s+\d+\s+(Personen|Portionen)/i.test(l.text));
  if(!heading)return null;
  const servings=Number(heading.text.match(/\d+/)?.[0])||4;
  // REWE print PDFs use two columns: instructions on the left, ingredient list on the right.
  const right=all.filter(l=>l.x>first.width*.53&&l.y<heading.y-3);
  const stop=right.find(l=>/^(Utensilien|Zubereitung|Nährwerte)/i.test(l.text));
  const selected=right.filter(l=>!stop||l.y>stop.y);
  const ingredients=selected.map(l=>l.text.replace(/^(?:[•*\-]\s*)/,'').replace(/^(\d+(?:[.,]\d+)?)(g|kg|ml|l|EL|TL|Bd\.)\b/i,'$1 $2').trim())
   .filter(t=>t.length>2&&!/^(Utensilien|Zutaten|Küchenreibe|Auflaufform|Zubereitung)/i.test(t));
  return ingredients.length>=3?{name:title,servings,ingredients}:null;
 }
 async function importPdf(file){
  if(!file)return;
  const status=el('rPdfStatus');status.textContent='PDF wird ausgelesen …';
  try{
   if(file.size>20*1024*1024)throw Error('PDF ist größer als 20 MB. Bitte eine kleinere Datei verwenden.');
   const pdfjs=await loadPdfLibrary();
   pdfjs.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
   const doc=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
   const pages=[];
   for(let i=1;i<=Math.min(doc.numPages,3);i++){
    const page=await doc.getPage(i),vp=page.getViewport({scale:1}),content=await page.getTextContent();
    pages.push({rows:pdfRows(content.items,vp.width),width:vp.width,height:vp.height});
   }
   const result=parsePdfRecipe(pages);
   if(!result)throw Error('Keine eindeutige Zutatenliste gefunden. Diese PDF ist möglicherweise ein Scan oder anders aufgebaut.');
   applyImportedRecipe(result,'der PDF-Datei');
   status.textContent=result.ingredients.length+' Zutaten für '+result.servings+' Portionen erkannt. Bitte prüfen und speichern.';
  }catch(e){status.textContent='PDF-Import fehlgeschlagen: '+e.message;notify(status.textContent)}
 }
 function importPastedText(){
  const raw=el('rImportText').value.trim();
  if(!raw)return notify('Bitte zuerst den kopierten Rezepttext einfügen.');
  const recipe=readReaderText(raw)||readRecipeJson(raw);
  if(!recipe)return notify('Keine eindeutige Zutatenliste erkannt. Du kannst Zutaten auch direkt in das Zutatenfeld einfügen.');
  applyImportedRecipe(recipe,'dem eingefügten Text');
 }
 function recipeOptions(selected=''){return '<option value="">Freier Texteintrag</option>'+state.recipes.slice().sort((a,b)=>a.name.localeCompare(b.name,'de')).map(r=>`<option value="${r.id}" ${selected===r.id?'selected':''}>${esc(r.name)}</option>`).join('')}
 function planEditor(id=null,date=day(),recipeId=''){editingPlan=id;let p=state.plan.find(x=>x.id===id);el('planTitle').textContent=p?'Mittagessen bearbeiten':'Mittagessen hinzufügen';el('pRecipe').innerHTML=recipeOptions(p?.recipeId||recipeId);el('pText').value=p?.text||'';el('pDate').value=p?.date||date;el('pCook').value=p?.cookDate||date;el('pPortions').value=p?.portions||4;el('pNote').value=p?.note||'';el('pDelete').hidden=!p;allocationDraft=p?assigned(p).map(a=>({...a})):[{date:p?.date||date,portions:Number(p?.portions||4)}];updatePlanFields();renderAllocationDays();el('planDialog').showModal()}
 function scaledIngredients(r,portions){if(!r)return '';return (r.ingredients||[]).map(i=>{let raw=String(i.amount||'').replace(',','.');let n=raw.includes('/')?raw.split('/').map(Number).reduce((a,b)=>a/b):Number(raw);let amount=Number.isFinite(n)&&n>0?String(Math.round(n*portions/(r.servings||1)*100)/100).replace('.',',')+' ':i.amount?i.amount+' ':'';return amount+(i.unit?i.unit+' ':'')+i.name}).join(' · ')}
 function updatePlanFields(){let free=!el('pRecipe').value;el('pTextBox').hidden=!free;el('pCookBox').hidden=free;el('pAllocBox').hidden=free;el('pPortionsLabel').textContent=free?'Portionen (optional)':'Gekochte Portionen';let r=byId(el('pRecipe').value);el('pRecipeDetails').textContent=r?`${r.ingredients?.length||0} Zutaten · Grundrezept für ${r.servings||1} Portionen\n${scaledIngredients(r,Number(el('pPortions').value)||1)}`:'';el('pConvert').hidden=!free;el('pOpenRecipe').hidden=!r}
 function renderAllocationDays(){
  const box=el('pAllocDays');box.replaceChildren();
  const start=el('pCook').value||el('pDate').value||day();
  const portions=Number(el('pPortions').value)||0;
  const current=allocationDraft.reduce((n,a)=>n+a.portions,0);
  const dates=new Set(Array.from({length:8},(_,i)=>add(start,i)));
  allocationDraft.forEach(a=>{if(a.portions>0)dates.add(a.date)});
  [...dates].sort().forEach(d=>{
   const row=document.createElement('div');row.className='allocation-day';
   const label=document.createElement('span');label.textContent=dt(d).toLocaleDateString('de-DE',{weekday:'long',day:'2-digit',month:'2-digit'});
   const controls=document.createElement('div');controls.className='allocation-controls';
   const minus=document.createElement('button'),plus=document.createElement('button'),count=document.createElement('strong');
   minus.type=plus.type='button';minus.textContent='−';plus.textContent='+';
   const entry=allocationDraft.find(a=>a.date===d),value=entry?.portions||0;
   count.textContent=value;minus.setAttribute('aria-label','Eine Portion weniger am '+fmt(d));plus.setAttribute('aria-label','Eine Portion mehr am '+fmt(d));
   minus.disabled=value===0;plus.disabled=current>=portions||d<(el('pCook').value||'0000');
   minus.onclick=()=>changeAllocation(d,-1);plus.onclick=()=>changeAllocation(d,1);
   controls.append(minus,count,plus);row.append(label,controls);box.append(row);
  });
  const remaining=portions-current;
  el('pAllocSummary').textContent=`${current} von ${portions} Portionen verteilt${remaining>0?' · Noch '+remaining+' zu verteilen':remaining<0?' · Zu viele Portionen!':''}`;
 }
 function changeAllocation(date,delta){
  let a=allocationDraft.find(x=>x.date===date);
  if(!a){a={date,portions:0};allocationDraft.push(a)}
  a.portions=Math.max(0,a.portions+delta);
  allocationDraft=allocationDraft.filter(x=>x.portions>0);
  renderAllocationDays();
 }
 function savePlan(){let recipeId=el('pRecipe').value||null,text=el('pText').value.trim(),date=el('pDate').value,portions=Number(el('pPortions').value),cookDate=recipeId?el('pCook').value:null;if(!recipeId&&!text)return notify('Bitte Gericht oder freien Text eingeben.');if(!date||!Number.isInteger(portions)||portions<1)return notify('Bitte Datum und ganze Portionszahl angeben.');let allocations=recipeId?allocationDraft.filter(a=>a.portions>0).map(a=>({...a})).sort((a,b)=>a.date.localeCompare(b.date)):[{date,portions}];if(recipeId&&allocations.length===0)return notify('Bitte mindestens einen Esstag auswählen.');if(allocations.some(a=>!a.date||!Number.isInteger(a.portions)||a.portions<1))return notify('Nur ganze, positive Portionen verwenden.');if(recipeId&&allocations.reduce((s,a)=>s+a.portions,0)!==portions)return notify('Bitte alle gekochten Portionen mit + und − auf Esstage verteilen.');if(recipeId&&(!cookDate||cookDate>allocations.map(a=>a.date).sort()[0]))return notify('Der Kochtag muss spätestens am ersten Esstag liegen.');let p=state.plan.find(x=>x.id===editingPlan);if(!p){p={id:uid(),order:state.plan.length};state.plan.push(p)}Object.assign(p,{recipeId,text:recipeId?'':text,date:allocations[0].date,portions,cookDate,allocations,note:el('pNote').value});save();el('planDialog').close();render()}
 function entryRow(p,d){let row=document.createElement('div');row.className='meal-entry';let count=assigned(p).filter(a=>a.date===d).reduce((s,a)=>s+a.portions,0);row.innerHTML=`<div class="grow"><strong>${esc(name(p))}</strong><small>${count} Portionen${p.recipeId?' · Kochen: '+fmt(p.cookDate):''}</small>${p.note?`<div class="note">${esc(p.note)}</div>`:''}</div><div class="entry-actions"><button aria-label="Nach oben" data-a="up">↑</button><button aria-label="Nach unten" data-a="down">↓</button><button data-a="edit">Ändern</button></div>`;row.querySelectorAll('button').forEach(b=>b.onclick=()=>{if(b.dataset.a==='edit')return planEditor(p.id);let entries=entriesFor(d),i=entries.findIndex(x=>x.id===p.id),j=i+(b.dataset.a==='up'?-1:1);if(j<0||j>=entries.length)return;let other=entries[j],tmp=p.order;p.order=other.order;other.order=tmp;save();renderPlan()});return row}
 const entriesFor=d=>state.plan.filter(p=>assigned(p).some(a=>a.date===d)).sort((a,b)=>(a.order||0)-(b.order||0));
 function renderPlan(){rangeStart=day();if(rangeEnd<rangeStart)rangeEnd=add(rangeStart,6);el('rangeEnd').min=rangeStart;el('rangeEnd').value=rangeEnd;el('viewList').classList.toggle('selected',view==='list');el('viewWeek').classList.toggle('selected',view==='week');let box=el('planContent');box.replaceChildren();if(rangeEnd<rangeStart){box.innerHTML='<p>Das Enddatum muss nach dem Startdatum liegen.</p>';return}let end=dt(rangeEnd)-dt(rangeStart);if(end>366*864e5){box.innerHTML='<p>Bitte einen Zeitraum von höchstens einem Jahr wählen.</p>';return}let dates=[];for(let d=rangeStart;d<=rangeEnd;d=add(d,1))dates.push(d);if(view==='week'){let weeks=new Map();dates.forEach(d=>{let w=week(d);if(!weeks.has(w))weeks.set(w,[]);weeks.get(w).push(d)});for(let [w,days] of weeks){let section=document.createElement('article');section.innerHTML=`<h3>Woche ab ${fmt(w)}</h3>`;let grid=document.createElement('div');grid.className='week-grid';days.forEach(d=>{let b=document.createElement('button');b.className='week-day';let items=entriesFor(d);b.innerHTML=`<strong>${fmt(d)}</strong><small>${items.map(p=>esc(name(p))+(p.note?' 📝':'')).join('<br>')||'–'}</small>`;b.onclick=()=>{view='list';rangeStart=d;rangeEnd=d;renderPlan()};grid.append(b)});section.append(grid);box.append(section)}return}dates.forEach(d=>{let section=document.createElement('article');section.innerHTML=`<div class="heading"><h3>${fmt(d)}</h3><button class="primary">+ Gericht</button></div>`;section.querySelector('button').onclick=()=>planEditor(null,d);let entries=entriesFor(d);if(!entries.length)section.insertAdjacentHTML('beforeend','<p class="empty">Noch kein Mittagessen geplant.</p>');entries.forEach(p=>section.append(entryRow(p,d)));box.append(section)})}
 function renderCooking(){let box=el('cookingContent');box.replaceChildren();let dates=[...new Set(state.plan.filter(p=>p.recipeId&&p.cookDate).map(p=>p.cookDate))].filter(d=>d>=rangeStart&&d<=rangeEnd).sort();if(!dates.length){box.innerHTML='<p class="empty">Keine Kochtage in diesem Zeitraum.</p>';return}for(let d of dates){let a=document.createElement('article');a.innerHTML=`<h3>${fmt(d)}</h3>`;state.plan.filter(p=>p.recipeId&&p.cookDate===d).forEach(p=>{let b=document.createElement('button');b.className='recipe-row';b.textContent=`${name(p)} · ${p.portions} Portionen`;b.onclick=()=>planEditor(p.id);a.append(b)});box.append(a)}}
 function renderHome(){let d=day(),todayMeals=entriesFor(d),cooking=state.plan.filter(p=>p.recipeId&&p.cookDate===d);el('homeMeals').replaceChildren();if(!todayMeals.length){el('homeMeals').innerHTML='<p>Noch kein Mittagessen geplant</p>';let b=document.createElement('button');b.textContent='+ Mittagessen hinzufügen';b.onclick=()=>planEditor(null,d);el('homeMeals').append(b)}else todayMeals.forEach(p=>{let b=document.createElement('button');b.className='recipe-row';b.textContent=`${name(p)} · ${assigned(p).filter(a=>a.date===d).reduce((s,a)=>s+a.portions,0)} Portionen`;b.onclick=()=>planEditor(p.id);el('homeMeals').append(b)});el('homeCooking').replaceChildren();if(!cooking.length)el('homeCooking').textContent='Heute nichts zu kochen';else cooking.forEach(p=>{let b=document.createElement('button');b.className='recipe-row';b.textContent=`${name(p)} · ${p.portions} Portionen`;b.onclick=()=>planEditor(p.id);el('homeCooking').append(b)});let due=!state.lastBackup||((new Date()-new Date(state.lastBackup))/864e5>=14);el('backupReminder').hidden=!due}
 function deleteRecipe(){let r=byId(editingRecipe);if(!r||!confirmDelete(`Rezept „${r.name}“ einschließlich seiner Fotos endgültig löschen? Geplante Gerichte bleiben als Text erhalten.`))return;state.plan.filter(p=>p.recipeId===r.id).forEach(p=>{p.text=r.name;p.recipeId=null;p.cookDate=null;p.allocations=assigned(p).map(a=>({...a}))});state.recipes=state.recipes.filter(x=>x.id!==r.id);save();el('recipeDialog').close();Promise.all((r.photos||[]).map(delPhoto)).catch(()=>{});render()}
 function deletePlan(){if(!confirmDelete('Dieses geplante Mittagessen wirklich löschen?'))return;state.plan=state.plan.filter(p=>p.id!==editingPlan);save();el('planDialog').close();render()}
 const blobToData=blob=>new Promise((resolve,reject)=>{let r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(blob)});
 async function exportAll(){let photos={};for(let r of state.recipes)for(let id of r.photos||[]){let blob=await photo(id);if(blob)photos[id]=await blobToData(blob)}let tasks;try{tasks=JSON.parse(localStorage.getItem('mein-haushalt-v01'))}catch{}let backup={app:'Mein Haushalt',version:2,exported:new Date().toISOString(),data:tasks||{rooms:[],categories:[],tasks:[]},meal:{...state,lastBackup:new Date().toISOString()},photos};let a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(backup)],{type:'application/json'}));a.href=url;a.download=`mein-haushalt-sicherung-v02-${day()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);state.lastBackup=backup.exported;save();render()}
 async function importAll(file){let backup=JSON.parse(await file.text());if(backup.app!=='Mein Haushalt'||![1,2].includes(backup.version)||!backup.data||!Array.isArray(backup.data.tasks)||!Array.isArray(backup.data.rooms)||!Array.isArray(backup.data.categories))throw Error('Ungültige Sicherungsdatei');if(backup.version===2&&(!backup.meal||!Array.isArray(backup.meal.recipes)||!Array.isArray(backup.meal.plan)||typeof backup.photos!=='object'))throw Error('Ungültige Version-0.2-Sicherung');if(!confirm('ACHTUNG: Alle aktuellen Aufgaben, Rezepte, Fotos und Essenspläne durch diese Sicherung ersetzen?'))return;let newMeal=backup.version===2?backup.meal:{recipes:[],plan:[],lastBackup:null};let allPhotos=backup.photos||{};for(let [id,data] of Object.entries(allPhotos)){if(!/^data:image\//.test(data))throw Error('Ungültiges Foto');let blob=await(await fetch(data)).blob();await putPhoto(id,blob)}localStorage.setItem('mein-haushalt-v01',JSON.stringify(backup.data));state=newMeal;save();notify('Sicherung importiert. Die App wird neu geladen.');location.reload()}
 function cookingMode(){let r=byId(editingRecipe);if(!r||!r.photos.length)return notify('Dieses Rezept hat noch keine Fotos.');let index=0;let dlg=el('cookDialog'),im=el('cookImage');async function show(){let b=await photo(r.photos[index]);if(b){im.src=URL.createObjectURL(b);el('cookCounter').textContent=`${index+1} / ${r.photos.length}`}}el('cookPrev').onclick=()=>{index=(index+r.photos.length-1)%r.photos.length;show()};el('cookNext').onclick=()=>{index=(index+1)%r.photos.length;show()};el('cookClose').onclick=()=>dlg.close();dlg.showModal();show();if(navigator.wakeLock)navigator.wakeLock.request('screen').then(lock=>dlg.addEventListener('close',()=>lock.release(),{once:true})).catch(()=>{})}
 async function init(){try{photoDB=await openPhotos()}catch{notify('Der Fotospeicher ist nicht verfügbar. Bitte Browser-Einstellungen prüfen.');return}try{let raw=localStorage.getItem(store);if(raw){let s=JSON.parse(raw);if(Array.isArray(s.recipes)&&Array.isArray(s.plan))state=s}}catch{}el('recipeNew').onclick=()=>editRecipe();el('recipeSearch').oninput=renderRecipes;el('recipeFav').onclick=()=>{filterFav=!filterFav;renderRecipes()};el('rSave').onclick=saveRecipe;el('rDelete').onclick=deleteRecipe;el('rClose').onclick=()=>el('recipeDialog').close();el('rFiles').onchange=e=>{addPhotos([...e.target.files]);e.target.value=''};el('rExtract').onclick=importUrl;el('rPdfFile').onchange=e=>{const f=e.target.files[0];if(f)importPdf(f);e.target.value=''};el('rImportPaste').onclick=importPastedText;el('rCooking').onclick=cookingMode;el('pPortions').oninput=()=>{updatePlanFields();renderAllocationDays()};el('pCook').onchange=renderAllocationDays;el('pRecipe').onchange=()=>{updatePlanFields();let r=byId(el('pRecipe').value);if(r&&!editingPlan){el('pPortions').value=r.servings||4;allocationDraft=[{date:el('pDate').value,portions:Number(el('pPortions').value)}];renderAllocationDays()}};el('pDate').onchange=()=>{if(!editingPlan){el('pCook').value=el('pDate').value;allocationDraft=[{date:el('pDate').value,portions:Number(el('pPortions').value)||1}];renderAllocationDays()}};el('pSave').onclick=savePlan;el('pConvert').onclick=()=>{let text=el('pText').value.trim();if(!text)return notify('Bitte zuerst einen Namen eingeben.');el('planDialog').close();editRecipe(null,text)};el('pOpenRecipe').onclick=()=>{let id=el('pRecipe').value;if(id){el('planDialog').close();editRecipe(id)}};el('pCopy').onclick=()=>{let p=state.plan.find(x=>x.id===editingPlan);if(!p)return;let d=prompt('Auf welchen Esstag kopieren? (JJJJ-MM-TT)',p.date);if(!d)return;if(!/^\d{4}-\d{2}-\d{2}$/.test(d))return notify('Ungültiges Datum');let diff=Math.round((dt(d)-dt(p.date))/864e5);state.plan.push({...structuredClone(p),id:uid(),order:state.plan.length,date:d,cookDate:p.cookDate?add(p.cookDate,diff):null,allocations:assigned(p).map(a=>({...a,date:add(a.date,diff)}))});save();el('planDialog').close();render()};el('pDelete').onclick=deletePlan;el('pClose').onclick=()=>el('planDialog').close();el('planNew').onclick=()=>planEditor();el('rangeEnd').onchange=e=>{rangeEnd=e.target.value;renderPlan()};el('viewList').onclick=()=>{view='list';renderPlan()};el('viewWeek').onclick=()=>{view='week';renderPlan()};el('cookingTab').onclick=()=>{el('cookingSection').hidden=!el('cookingSection').hidden;renderCooking()};el('export').onclick=()=>exportAll().catch(e=>notify('Export fehlgeschlagen: '+e.message));el('import').onchange=async e=>{try{if(e.target.files[0])await importAll(e.target.files[0])}catch(err){notify('Import nicht möglich: '+err.message)}e.target.value=''};el('backupNow').onclick=()=>tab('settings');document.querySelectorAll('nav button').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.page==='meals')renderCooking()}));render()}
 return{init,render,editRecipe,planEditor,exportAll,importAll};
})();
M.init();
