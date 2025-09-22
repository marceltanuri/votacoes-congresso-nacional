const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const API_BASE = 'https://dadosabertos.camara.leg.br/api/v2';

// Lê ?v=ID; se não vier, usa a votação da PEC 3/2021 (2º turno)
const url = new URL(location.href);
const VOT_ID = url.searchParams.get('v') || '2270800-160';
const API_URL = `${API_BASE}/votacoes/${encodeURIComponent(VOT_ID)}/votos`;

let votosRaw = [], votosView = [], sortKey='nome', sortDir='asc';

function setStatus(msg, loading=false){ const el=$('#status'); el.textContent=msg; el.classList.toggle('loading',!!loading); }
function escapeHtml(s){ return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c])); }

async function fetchAllPages(url){
  const all=[]; let next=url; let safety=0;
  while(next && safety++<50){
    const r=await fetch(next,{headers:{'Accept':'application/json'}});
    if(!r.ok) throw new Error('Erro '+r.status);
    const j=await r.json();
    all.push(...(j.dados||[]));
    next=(j.links||[]).find(l=>l.rel==='next')?.href||null;
  }
  return all;
}

function normalize(d){ const dep=d.deputado_||{}; return { nome:dep.nome||'', siglaPartido:dep.siglaPartido||'', siglaUf:dep.siglaUf||'', tipoVoto:d.tipoVoto||'' }; }
function uniqueSorted(a){ return [...new Set(a.filter(Boolean))].sort((x,y)=>x.localeCompare(y,'pt-BR')); }
function populateFilters(data){
  uniqueSorted(data.map(x=>x.siglaPartido)).forEach(p=>$('#fPartido').append(new Option(p,p)));
  uniqueSorted(data.map(x=>x.siglaUf)).forEach(uf=>$('#fUF').append(new Option(uf,uf)));
}
function applyFilters(){
  const p=$('#fPartido').value, uf=$('#fUF').value, v=$('#fVoto').value, n=$('#fNome').value.toLowerCase();
  votosView=votosRaw.filter(r=>(!p||r.siglaPartido===p)&&(!uf||r.siglaUf===uf)&&(!v||r.tipoVoto===v)&&(!n||r.nome.toLowerCase().includes(n)));
  sortAndRender(); updateResumo();
}
function sortAndRender(){ const dir=sortDir==='asc'?1:-1; votosView.sort((a,b)=> (a[sortKey]||'').localeCompare(b[sortKey]||'', 'pt-BR')*dir); renderTable(); }
function renderTable(){ $('#tabela tbody').innerHTML = votosView.map(r=>`<tr><td>${escapeHtml(r.nome)}</td><td><span class="pill">${escapeHtml(r.siglaPartido)}</span></td><td><span class="pill">${escapeHtml(r.siglaUf)}</span></td><td><span class="pill vote-${escapeHtml(r.tipoVoto)}">${escapeHtml(r.tipoVoto)}</span></td></tr>`).join(''); }
function updateResumo(){ const total=votosRaw.length, vis=votosView.length, por=votosView.reduce((a,r)=>{a[r.tipoVoto]=(a[r.tipoVoto]||0)+1;return a;},{}); const resumo=Object.entries(por).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k}: ${v}`).join(' · '); $('#resumo').textContent = `${vis} de ${total} registros · ${resumo}`; }
function resetFilters(){ ['fPartido','fUF','fVoto','fNome'].forEach(id=>$('#'+id).value=''); applyFilters(); }
function exportCSV(){ const csv=[["Nome","Partido","UF","Voto"],...votosView.map(r=>[r.nome,r.siglaPartido,r.siglaUf,r.tipoVoto])].map(l=>l.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join(''); const blob=new Blob(["\uFEFF"+csv],{type:'text/csv;charset=utf-8;'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`votos-${VOT_ID}.csv`; a.click(); }

async function init(){
  $('#votacaoId').textContent = `(ID: ${VOT_ID})`;
  $('#apiLink').href = API_URL; $('#apiLink').textContent = API_URL;
  try{ setStatus('Carregando votos…', true);
    votosRaw=(await fetchAllPages(API_URL)).map(normalize); votosView=[...votosRaw]; populateFilters(votosRaw); sortAndRender(); updateResumo(); setStatus('Dados carregados.');
  }catch(e){ console.error(e); setStatus('Falha ao carregar: '+e.message); }
}

['fPartido','fUF','fVoto','fNome'].forEach(id=>document.addEventListener('input',ev=>{ if(ev.target && ev.target.id===id) applyFilters(); }));
['fPartido','fUF','fVoto','fNome'].forEach(id=>document.addEventListener('change',ev=>{ if(ev.target && ev.target.id===id) applyFilters(); }));
$$('#tabela thead th').forEach(th=>th.addEventListener('click',()=>{ const k=th.dataset.k; if(!k) return; if(sortKey===k) sortDir = (sortDir==='asc'?'desc':'asc'); else { sortKey=k; sortDir='asc'; } sortAndRender(); }));
$('#btnLimpar').addEventListener('click', resetFilters);
$('#btnCSV').addEventListener('click', exportCSV);

init();