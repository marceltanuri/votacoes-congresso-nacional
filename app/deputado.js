const $ = (s) => document.querySelector(s);

const url = new URL(location.href);
const DEPUTADO_ID = url.searchParams.get('id');

function setStatus(msg, loading = false) {
    const el = $('#status');
    el.textContent = msg || '';
    el.classList.toggle('loading', !!loading);
}

async function fetchAllPages(url) {
    const all = [];
    let next = url;
    let safety = 0;
    while (next && safety++ < 50) {
        const r = await fetch(next, { headers: { 'Accept': 'application/json' } });
        if (!r.ok) throw new Error('Erro ' + r.status);
        const j = await r.json();
        all.push(...(j.dados || []));
        next = (j.links || []).find(l => l.rel === 'next')?.href || null;
    }
    return all;
}

function escapeCsv(s) {
    if (s === null || s === undefined) return '';
    let str = String(s);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        str = `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

async function exportarEventos() {
    if (!DEPUTADO_ID) return;
    setStatus('Exportando eventos para CSV…', true);
    try {
        const eventosApiUrl = `${API_BASE}/deputados/${DEPUTADO_ID}/eventos?ordem=DESC&ordenarPor=dataHoraInicio`;
        const eventos = await fetchAllPages(eventosApiUrl);

        if (!eventos.length) {
            setStatus('Nenhum evento encontrado para este deputado.');
            return;
        }

        const headers = ['ID Evento', 'Data/Hora Início', 'Data/Hora Fim', 'Situação', 'Descrição Tipo', 'Local'];
        const rows = eventos.map(e => [
            e.id,
            e.dataHoraInicio,
            e.dataHoraFim,
            e.situacao,
            e.descricaoTipo,
            e.localCamara?.nome || 'Externo'
        ].map(escapeCsv).join(','));

        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', `eventos_deputado_${DEPUTADO_ID}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setStatus('Eventos exportados com sucesso.');
    } catch (error) {
        console.error(error);
        setStatus(`Falha ao exportar eventos: ${error.message}`);
    }
}


async function init() {
    if (!DEPUTADO_ID) {
        $('#nomeDeputado').textContent = 'ID do deputado não fornecido';
        return;
    }

    setStatus('Carregando perfil do deputado…', true);
    try {
        const deputadoApiUrl = `${API_BASE}/deputados/${DEPUTADO_ID}`;
        const response = await fetch(deputadoApiUrl, { headers: { 'Accept': 'application/json' } });
        if (!response.ok) throw new Error(`Erro ${response.status}`);

        const json = await response.json();
        const deputado = json.dados;

        $('#nomeDeputado').textContent = deputado.nomeCivil;
        document.title = `${deputado.nomeCivil} — Perfil do Deputado`;

        const detalhesHtml = `
            <p><strong>Nome Civil:</strong> ${deputado.nomeCivil}</p>
            <p><strong>Partido:</strong> ${deputado.ultimoStatus.siglaPartido}</p>
            <p><strong>UF:</strong> ${deputado.ultimoStatus.siglaUf}</p>
            <p><strong>Email:</strong> <a href="mailto:${deputado.gabinete.email}">${deputado.gabinete.email}</a></p>
            <img src="${deputado.ultimoStatus.urlFoto}" alt="Foto de ${deputado.nomeCivil}" width="150">
        `;
        $('#detalhesDeputado').innerHTML = detalhesHtml;

        $('#btnExportarEventos').addEventListener('click', exportarEventos);

        setStatus('Perfil carregado.');
    } catch (error) {
        console.error(error);
        setStatus(`Falha ao carregar perfil: ${error.message}`);
    }
}

init();