# 📊 Câmara — Consulta de Proposições e Votações

Este projeto é uma **SPA simples (páginas estáticas)** que consome a API de [Dados Abertos da Câmara](https://dadosabertos.camara.leg.br/swagger/api.html) para:

- Buscar **proposições** por **tipo**, **número** e **ano**
- Listar todas as **votações** de uma proposição
- Exibir os **votos nominais** de uma votação, com filtros avançados

---

## 📁 Estrutura de Pastas

```
pec3-votacao/
├── index.html       # Página inicial (busca de proposições)
├── home.js          # Lógica da busca e listagem de votações
├── votacao.html     # Página de votos nominais (filtros)
├── votacao.js       # Lógica de carregamento e filtros de votos
└── style.css        # Estilos compartilhados
```

---

## 🚀 Como Executar

1. Baixe ou clone os arquivos para uma pasta local.
2. Sirva os arquivos usando qualquer servidor estático ou abra o `index.html` diretamente no navegador:
   ```bash
   # Exemplo usando Python 3
   python -m http.server 8080
   # depois acesse http://localhost:8080
   ```
   > Se abrir como `file://`, alguns navegadores podem bloquear fetch por CORS. Recomenda-se usar um servidor local.

3. Na **Home**:
   - Escolha tipo (ex.: `PEC`), número (ex.: `3`) e ano (ex.: `2021`) e clique em **Buscar**.
   - Clique em **Ver votações** para listar todas as votações dessa proposição.
   - Clique em qualquer votação para abrir `votacao.html` com os votos nominais.

4. Na **Página de Votação**:
   - Filtre por **Partido**, **UF**, **Tipo de Voto** ou busque pelo **nome**.
   - Ordene clicando nos cabeçalhos das colunas.
   - Exporte os resultados para **CSV**.

---

## 🔗 Votações Mais Acessadas

Na Home, há uma seção fixa **Votações mais acessadas** com links diretos.  
Já incluímos a votação:

- [PEC 3/2021 — 2º turno (ID: 2270800-160)](votacao.html?v=2270800-160)

---

## 🧩 Customização

- **Adicionar novas votações populares:** edite o `<ul>` na seção “Votações mais acessadas” em `index.html` e inclua novos `<li><a>` com o `?v=<id>` da votação.
- **Alterar cores ou layout:** edite `style.css` (as variáveis em `:root` controlam temas).
- **Mudar a votação padrão:** em `votacao.js`, altere o valor padrão:
  ```js
  const VOT_ID = url.searchParams.get('v') || '2270800-160';
  ```

---

## 📚 API Utilizada

- [`GET /proposicoes`](https://dadosabertos.camara.leg.br/api/v2/proposicoes)
- [`GET /proposicoes/{id}/votacoes`](https://dadosabertos.camara.leg.br/api/v2/proposicoes/2270800/votacoes)
- [`GET /votacoes/{id}/votos`](https://dadosabertos.camara.leg.br/api/v2/votacoes/2270800-160/votos)

---

## 📝 Licença

Código de exemplo para uso livre.  
Os dados são públicos e fornecidos pela **Câmara dos Deputados — Dados Abertos**.
