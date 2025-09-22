const $ = (s) => document.querySelector(s);
const API_BASE = 'https://dadosabertos.camara.leg.br/api/v2';

document.getElementById('ano').max = new Date().getFullYear();

function setStatus(msg, loading=false){
  const el = $('#status');
  el.textContent = msg || '';
  el.classList.toggle('loading', !!loading);
}

async function fetchJson(url){
  const r = await fetch(url, { headers: { 'Accept': 'application/json' }});
  if(!r.ok) throw new Error('Erro '+r.status+' em '+url);
  return r.json();
}

async function buscarProposicoes(siglaTipo, numero, ano){
  const url = `${API_BASE}/proposicoes?siglaTipo=${encodeURIComponent(siglaTipo)}&numero=${encodeURIComponent(numero)}&ano=${encodeURIComponent(ano)}`;
  const j = await fetchJson(url);
  return j.dados || [];
}

async function listarVotacoes(proposicaoId){
  const url = `${API_BASE}/proposicoes/${proposicaoId}/votacoes`;
  const j = await fetchJson(url);
  return j.dados || [];
}

function cardProposicao(p){
  const div = document.createElement('div');
  div.className = 'proposicao card';
  div.innerHTML = `
    <div class="p-header"><strong>${p.siglaTipo || ''} ${p.numero || ''}/${p.ano || ''}</strong> <span class="muted">(ID: ${p.id})</span></div>
    <div class="p-body muted">${p.ementa || 'Sem ementa'}</div>
    <div class="p-actions"><button class="btnVotacoes" data-id="${p.id}">Ver votações</button></div>
    <div class="votacoes"></div>
  `;
  return div;
}

function listVotacoes(divVotacoes, votacoes){
  if(!votacoes.length){
    divVotacoes.innerHTML = '<div class="muted">Nenhuma votação encontrada.</div>';
    return;
  }
  const ul = document.createElement('ul');
  ul.className = 'links';
  votacoes.forEach(v => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = `votacao.html?v=${encodeURIComponent(v.id)}`;
    a.textContent = `${v.data} — ${v.descricao || 'Votação'}`;
    li.appendChild(a);
    ul.appendChild(li);
  });
  divVotacoes.replaceChildren(ul);
}

$('#formBusca').addEventListener('submit', async (ev)=>{
  ev.preventDefault();
  const tipo = $('#tipo').value.trim();
  const numero = $('#numero').value.trim();
  const ano = $('#ano').value.trim();
  const cont = $('#resultados');
  cont.innerHTML = '';
  setStatus('Buscando proposições…', true);
  try{
    const props = await buscarProposicoes(tipo, numero, ano);
    if(!props.length){
      cont.innerHTML = '<div class="muted">Nenhuma proposição encontrada.</div>';
    } else {
      props.forEach(p => cont.appendChild(cardProposicao(p)));
      // Bind de botões "Ver votações"
      cont.querySelectorAll('.btnVotacoes').forEach(btn => {
        btn.addEventListener('click', async ()=>{
          const id = btn.dataset.id;
          const box = btn.closest('.proposicao').querySelector('.votacoes');
          box.innerHTML = '<div class="muted">Carregando votações…</div>';
          try{
            const vs = await listarVotacoes(id);
            listVotacoes(box, vs);
          }catch(e){ box.innerHTML = '<div class="muted">Erro ao listar votações.</div>'; }
        });
      });
    }
    setStatus('');
  }catch(e){
    console.error(e);
    setStatus('Falha na busca: '+e.message);
  }
});

$('#btnLimpar').addEventListener('click', ()=>{
  $('#numero').value = '';
  $('#ano').value = '';
  $('#resultados').innerHTML = '';
  setStatus('');
});