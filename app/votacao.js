const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

// Lê ?v=ID da votação e ?p=ID da proposição na URL
const url = new URL(location.href);
const VOT_ID = url.searchParams.get('v') || '2270800-160';
const PROP_ID = url.searchParams.get('p') || 2270800; // Default PEC 3/2021

let votosRaw = [], votosView = [], sortKey = 'nome', sortDir = 'asc';

function setStatus(msg, loading = false) { const el = $('#status'); el.textContent = msg; el.classList.toggle('loading', !!loading); }
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c])); }

async function fetchAllPages(url) {
    const all = []; let next = url; let safety = 0;
    while (next && safety++ < 50) {
        const r = await fetch(next, { headers: { 'Accept': 'application/json' } });
        if (!r.ok) throw new Error('Erro ' + r.status);
        const j = await r.json();
        all.push(...(j.dados || []));
        next = (j.links || []).find(l => l.rel === 'next')?.href || null;
    }
    return all;
}

function normalize(d) {
    const dep = d.deputado_ || {};
    return {
        deputadoId: dep.id || null,
        nome: dep.nome || '',
        siglaPartido: dep.siglaPartido || '',
        siglaUf: dep.siglaUf || '',
        tipoVoto: d.tipoVoto || ''
    };
}


function uniqueSorted(a) { return [...new Set(a.filter(Boolean))].sort((x, y) => x.localeCompare(y, 'pt-BR')); }
function populateFilters(data) {
    uniqueSorted(data.map(x => x.siglaPartido)).forEach(p => $('#fPartido').append(new Option(p, p)));
    uniqueSorted(data.map(x => x.siglaUf)).forEach(uf => $('#fUF').append(new Option(uf, uf)));
}
function applyFilters() {
    const p = $('#fPartido').value, uf = $('#fUF').value, v = $('#fVoto').value, n = $('#fNome').value.toLowerCase();
    votosView = votosRaw.filter(r => (!p || r.siglaPartido === p) && (!uf || r.siglaUf === uf) && (!v || r.tipoVoto === v) && (!n || r.nome.toLowerCase().includes(n)));
    sortAndRender(); updateResumo();
}
function sortAndRender() { const dir = sortDir === 'asc' ? 1 : -1; votosView.sort((a, b) => (a[sortKey] || '').localeCompare(b[sortKey] || '', 'pt-BR') * dir); renderTable(); }

function renderTable() {
    const rows = votosView.map(r => {
        // tenta pegar o id do deputado em diferentes formatos de resposta
        const depId =
            r.deputadoId ??
            r.idDeputado ??
            r.id ??
            (r.deputado_ && r.deputado_.id) ??
            (r.deputado && r.deputado.id);

        const nomeLink = depId
            ? `<a href="deputado.html?id=${encodeURIComponent(depId)}" title="Ver perfil e votações de ${escapeHtml(r.nome)}">${escapeHtml(r.nome)}</a>`
            : `${escapeHtml(r.nome)}`;

        return `
      <tr>
        <td>${nomeLink}</td>
        <td><span class="pill">${escapeHtml(r.siglaPartido || '')}</span></td>
        <td><span class="pill">${escapeHtml(r.siglaUf || '')}</span></td>
        <td><span class="pill vote-${escapeHtml(r.tipoVoto || '')}">${escapeHtml(r.tipoVoto || '')}</span></td>
      </tr>
    `;
    }).join('');

    $('#tabela tbody').innerHTML = rows;
}


function updateResumo() { const total = votosRaw.length, vis = votosView.length, por = votosView.reduce((a, r) => { a[r.tipoVoto] = (a[r.tipoVoto] || 0) + 1; return a; }, {}); const resumo = Object.entries(por).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: ${v}`).join(' · '); $('#resumo').textContent = `${vis} de ${total} registros · ${resumo}`; }
function resetFilters() { ['fPartido', 'fUF', 'fVoto', 'fNome'].forEach(id => $('#' + id).value = ''); applyFilters(); }
function exportCSV() { const csv = [["Nome", "Partido", "UF", "Voto"], ...votosView.map(r => [r.nome, r.siglaPartido, r.siglaUf, r.tipoVoto])].map(l => l.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join(''); const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `votos-${VOT_ID}.csv`; a.click(); }

async function init() {
    const proposicaoApiUrl = `${API_BASE}/proposicoes/${encodeURIComponent(PROP_ID)}`;
    const votacaoApiUrl = `${API_BASE}/votacoes/${encodeURIComponent(VOT_ID)}`;
    const votosApiUrl = `${votacaoApiUrl}/votos`;

    $('#apiLink').href = votosApiUrl;
    $('#apiLink').textContent = votosApiUrl;

    try {
        setStatus('Carregando detalhes…', true);

        const [proposicaoResponse, votacaoResponse] = await Promise.all([
            fetch(proposicaoApiUrl, { headers: { 'Accept': 'application/json' } }),
            fetch(votacaoApiUrl, { headers: { 'Accept': 'application/json' } })
        ]);

        if (!proposicaoResponse.ok) throw new Error(`Erro ${proposicaoResponse.status} ao buscar proposição`);
        if (!votacaoResponse.ok) throw new Error(`Erro ${votacaoResponse.status} ao buscar votação`);

        const proposicaoJson = await proposicaoResponse.json();
        const votacaoJson = await votacaoResponse.json();

        const proposicao = proposicaoJson.dados;
        const votacao = votacaoJson.dados;

        // Popula dados da Proposição
        if (proposicao && proposicao.siglaTipo && proposicao.numero && proposicao.ano) {
            const titulo = `${proposicao.siglaTipo} ${proposicao.numero}/${proposicao.ano}`;
            $('#proposicaoTitulo').textContent = titulo;
            document.title = `${titulo} — Votação`;
        } else {
            // Fallback para o título da votação se a proposição principal falhar
            const propDaVotacao = votacao.proposicao;
            if (propDaVotacao && propDaVotacao.siglaTipo && propDaVotacao.numero && propDaVotacao.ano) {
                const titulo = `${propDaVotacao.siglaTipo} ${propDaVotacao.numero}/${propDaVotacao.ano}`;
                $('#proposicaoTitulo').textContent = titulo;
                document.title = `${titulo} — Votação`;
            }
        }

        if (proposicao && (proposicao.ementaDetalhada || proposicao.ementa)) {
            $('#proposicaoEmenta').textContent = proposicao.ementaDetalhada || proposicao.ementa;
        }

        // Popula dados da Votação
        if (votacao) {
            $('#votacaoDescricao').textContent = votacao.descricao;
            $('#votacaoData').textContent = new Date(votacao.dataHoraRegistro).toLocaleDateString('pt-BR');
            $('#votacaoDataHoraRegistro').textContent = new Date(votacao.dataHoraRegistro).toLocaleString('pt-BR');
            $('#votacaoOrgao').textContent = votacao.siglaOrgao;
        }


        setStatus('Carregando votos…', true);
        votosRaw = (await fetchAllPages(votosApiUrl)).map(normalize);
        votosView = [...votosRaw];
        populateFilters(votosRaw);
        sortAndRender();
        updateResumo();
        setStatus('Dados carregados.');
    } catch (error) {
        console.error(error);
        setStatus(`Falha ao carregar: ${error.message}`);
    }
}

['fPartido', 'fUF', 'fVoto', 'fNome'].forEach(id => document.addEventListener('input', ev => { if (ev.target && ev.target.id === id) applyFilters(); }));
['fPartido', 'fUF', 'fVoto', 'fNome'].forEach(id => document.addEventListener('change', ev => { if (ev.target && ev.target.id === id) applyFilters(); }));
$$('#tabela thead th').forEach(th => th.addEventListener('click', () => { const k = th.dataset.k; if (!k) return; if (sortKey === k) sortDir = (sortDir === 'asc' ? 'desc' : 'asc'); else { sortKey = k; sortDir = 'asc'; } sortAndRender(); }));
$('#btnLimpar').addEventListener('click', resetFilters);
$('#btnCSV').addEventListener('click', exportCSV);

init();