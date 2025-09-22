// deputado.js — via /deputados/{id}/eventos → /eventos/{id}/votacoes → /votacoes/{id}/votos
(function () {
  const qs = new URLSearchParams(location.search);
  const id = Number(qs.get("id"));
  if (!id) {
    const s = document.getElementById("status");
    s.textContent = "ID do deputado ausente na URL (?id=).";
    s.classList.remove("loading");
    return;
  }

  const API = "https://dadosabertos.camara.leg.br/api/v2";

  async function getJSON(url) {
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error(`HTTP ${r.status} em ${url}`);
    return r.json();
  }

  function fmtDataHora(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
    } catch {
      return iso || "";
    }
  }

  function setDepHeader(dep) {
    document.title = `${dep.nome} — Perfil e Votações`;
    document.getElementById("depNome").textContent = dep.nome;
    const ult = dep.ultimoStatus || {};
    const partido = ult.siglaPartido || dep.siglaPartido || "";
    const uf = ult.siglaUf || dep.siglaUf || "";
    document.getElementById("depPartidoUF").textContent = `${partido}/${uf}`.replace(/^\/$|^\/|\/$/g, "");
    document.getElementById("depLegislatura").textContent = ult.idLegislatura ?? "";
    document.getElementById("depSituacao").textContent = ult.situacao || "";
    document.getElementById("depEmail").textContent = ult.email || "—";
    const a = document.getElementById("depSite");
    const site = dep.urlWebsite || (Array.isArray(dep.redeSocial) ? dep.redeSocial[0] : dep.redeSocial) || "";
    if (site) { a.href = site; a.textContent = "Abrir"; } else { a.removeAttribute("href"); a.textContent = "—"; }
    document.getElementById("apiLink").href = `${API}/deputados/${id}`;
  }

  function renderVotos(votos) {
    const tbody = document.getElementById("tbodyVotos");
    tbody.innerHTML = "";
    for (const v of votos) {
      const tr = document.createElement("tr");
      const tdData = document.createElement("td");
      const tdDesc = document.createElement("td");
      const tdVoto = document.createElement("td");

      tdData.textContent = fmtDataHora(v.dataHoraRegistro || v.data || "");
      const a = document.createElement("a");
      a.href = `votacao.html?v=${encodeURIComponent(v.idVotacao)}`;
      a.textContent = v.descricao || `Votação ${v.idVotacao}`;
      tdDesc.appendChild(a);
      tdVoto.textContent = v.tipoVoto || v.voto || "—";

      tr.appendChild(tdData);
      tr.appendChild(tdDesc);
      tr.appendChild(tdVoto);
      tbody.appendChild(tr);
    }
  }

  function toISODate(d) { return d.toISOString().slice(0,10); }

  // Carrega eventos com participação do deputado em uma janela de dias
  async function listarEventosDoDeputado(depId, { dias=60, pagina=1, itens=100, soPlenario=false } = {}) {
    const fim = new Date();
    const ini = new Date(fim); ini.setDate(fim.getDate() - dias);
    let url = `${API}/deputados/${depId}/eventos?dataInicio=${toISODate(ini)}&dataFim=${toISODate(fim)}&ordem=desc&ordenarPor=dataHoraInicio&pagina=${pagina}&itens=${itens}`;
    const data = await getJSON(url);
    let eventos = data.dados || [];
    if (soPlenario) eventos = eventos.filter(ev => ev.orgao?.sigla === "PLEN" || ev.orgao?.id === 180);
    return { eventos, links: data.links || [] };
  }

  // A partir do evento, carrega suas votações
  async function listarVotacoesDoEvento(eventoId) {
    const data = await getJSON(`${API}/eventos/${encodeURIComponent(eventoId)}/votacoes?itens=100`);
    return data.dados || [];
  }

  // Dentro de uma votação, procura o voto do deputado
  async function buscarVotoDoDeputadoNaVotacao(votacaoId, depId) {
    const votosResp = await getJSON(`${API}/votacoes/${encodeURIComponent(votacaoId)}/votos?itens=500`);
    return (votosResp.dados || []).find(x => x.deputado_?.id === depId) || null;
  }

  // Orquestra: Deputado → Eventos → Votações → Voto do dep.
  async function votosRecentesViaEventos(depId, limite=50, janelaDias=60, soPlenario=false) {
    const resultados = [];
    let pagina = 1;
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    while (resultados.length < limite) {
      const { eventos, links } = await listarEventosDoDeputado(depId, { dias: janelaDias, pagina, itens: 100, soPlenario });
      if (!eventos.length) break;

      for (const ev of eventos) {
        if (resultados.length >= limite) break;

        let votacoes;
        try {
          votacoes = await listarVotacoesDoEvento(ev.id);
        } catch { continue; }

        for (const v of votacoes) {
          if (resultados.length >= limite) break;
          try {
            const votoDoDep = await buscarVotoDoDeputadoNaVotacao(v.id, depId);
            if (votoDoDep) {
              resultados.push({
                idVotacao: v.id,
                descricao: v.descricao,
                dataHoraRegistro: votoDoDep.dataHoraRegistro || v.data || ev.dataHoraInicio,
                tipoVoto: votoDoDep.tipoVoto
              });
            }
          } catch {}
          await sleep(110); // backoff leve para a API pública
        }
      }

      const temNext = (links || []).some(l => l.rel === "next");
      if (!temNext) break;
      pagina++;
    }

    // Fallback: amplia janela se muito poucos resultados
    if (resultados.length < Math.min(10, limite) && janelaDias < 180) {
      return votosRecentesViaEventos(depId, limite, 180, soPlenario);
    }

    return resultados.slice(0, limite);
  }

  async function init() {
    const s = document.getElementById("status");
    try {
      const depResp = await getJSON(`${API}/deputados/${id}`);
      const dep = depResp.dados;
      setDepHeader(dep);

      s.textContent = "Coletando votações recentes a partir de eventos…";
      // Ajuste 'soPlenario' para true se quiser só eventos do Plenário
      const votos = await votosRecentesViaEventos(id, 50, 60, /*soPlenario=*/false);
      renderVotos(votos);

      s.classList.remove("loading");
      s.textContent = `${votos.length} votação(ões) encontradas.`;
    } catch (e) {
      console.error(e);
      s.classList.remove("loading");
      s.classList.add("error");
      s.textContent = "Não foi possível carregar os dados do deputado.";
    }
  }

  init();
})();
