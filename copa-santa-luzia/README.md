# Copa Santa Luzia

Site com **duas áreas**:

| Página | Arquivo | Quem usa | Entrada |
|---|---|---|---|
| Site público | `index.html` | torcedores/atletas | Login com Google **ou** modo convidado |
| Painel | `admin.html` | organização | Usuário + senha (vinculado a um e-mail) |

**Site público:** classificação por grupo (com os critérios de desempate), jogos (não iniciado / ao vivo / concluído, com placar, gols e cartões), mata-mata (chave e campeão), artilharia, cartões (com "pendurados"), suspensos, clubes → jogadores → ficha do jogador (gols e cartões) e avisos. O **CPF nunca aparece** aqui.

**Painel:** formato do campeonato, grupos de 4, sorteios, desempate, clubes, jogadores (com CPF), importação por planilha, jogos ao vivo, mata-mata, suspensões, observações e backup.

## Rodar agora (modo teste)

Não precisa instalar nada. Na pasta do projeto:

```bash
python3 -m http.server 8080
```

Abra `http://localhost:8080` (site) e `http://localhost:8080/admin.html` (painel).
No painel: usuário `admin`, senha `admin123`. Vá em **Dados e banco → Carregar dados de exemplo** para ver tudo funcionando.

No modo teste os dados ficam no `localStorage` do navegador.

## Fluxo do administrador

1. **Campeonato → 1. Formato:** escolha *Fase de grupos + mata-mata* ou *Direto no mata-mata*; quantos classificam por grupo (os 2 melhores ou só o 1º) e se os jogos da fase de grupos são só ida ou ida e volta.
2. **2. Critérios de desempate:** 5 critérios, na ordem do futebol profissional por padrão (vitórias → saldo de gols → gols marcados → confronto direto → fair play). Use ↑ ↓ para escolher o 1º, o 2º... critério.
3. **3. Grupos:** *Sortear grupos* (grupos de exatamente 4 clubes; o total de clubes deve ser múltiplo de 4) e, se quiser, mova clubes de grupo manualmente.
4. **4. Jogos da fase de grupos:** *Sortear jogos* distribui os confrontos e as rodadas de forma aleatória (opcional: data do 1º jogo e intervalo entre rodadas).
5. **Jogos e resultados:** edite **rodada** e **data/hora** direto na tabela; crie um confronto manual escolhendo **em qual rodada** os clubes se enfrentam (o sistema barra clube jogando duas vezes na mesma rodada e confronto repetido no modo só ida).
6. **Mata-mata (2ª fase):** *Gerar 1ª fase* usa os classificados dos grupos (1º de um grupo × 2º do outro). No formato direto, sorteia todos os clubes; se o número não for potência de 2, alguns avançam direto (folga). Depois de concluir os jogos, *Gerar próxima fase* até a final e o campeão.

### Partidas: três status
- **Não iniciado:** só data/hora e rodada.
- **Em andamento:** placar com botões − / +1, lançamento de **quem fez cada gol** e **cartões** (amarelo/vermelho, com minuto). Gol lançado atualiza o placar sozinho. O site dos usuários atualiza a cada 30 s.
- **Concluído:** entra na classificação. No mata-mata, empate exige os pênaltis.

### Jogadores e CPF
- O **CPF é a chave única** do atleta (validado pelos dígitos): não pode estar em dois clubes nem repetido.
- Só o painel mostra o CPF. No site dos usuários ele nem é carregado.
- **Planilha:** colunas `Clube`, `Nome`, `CPF`, `Número`, `Posição` (aceita Time/Equipe, Jogador, Camisa, Pos). Baixe o modelo na aba *Importar planilha*. Linhas com CPF vazio, inválido, repetido na planilha ou já cadastrado em **outro** clube aparecem como erro na pré-visualização e não são importadas. Se o Excel tirar o zero à esquerda do CPF, o sistema completa.

## Configuração (`js/config.js`)

- `adminEmail`: e-mail ao qual o administrador fica vinculado.
- `googleClientId`: crie em console.cloud.google.com → APIs e serviços → Credenciais → ID do cliente OAuth (Aplicativo da Web) e adicione o endereço do seu site em "Origens JavaScript autorizadas".
- `rules`: pontos por vitória/empate/derrota e nº de amarelos para suspensão.
- Trocar a senha do admin (modo local): `printf 'NOVA_SENHA' | sha256sum` e cole o resultado em `admin.passwordSha256`.

## Ligar a um banco de dados

Toda leitura/escrita passa por `js/store.js`. Quando você definir o banco:

1. Crie as tabelas com `db/schema.sql` (PostgreSQL; fácil adaptar para MySQL). Os nomes das colunas são **iguais** aos campos usados no site. `players.cpf` é `UNIQUE`, então o banco também impede o mesmo atleta em dois clubes.
2. Em `config.js`: `dataMode: "api"` e `apiBaseUrl: "https://seu-backend/api"`.
3. Seu backend expõe, para cada coleção `teams`, `players`, `matches`, `events`, `suspensions`, `notes`, `tournament`:

| Método | Rota | Função |
|---|---|---|
| GET | `/{coleção}` | lista tudo |
| POST | `/{coleção}` | cria 1 registro, devolve o registro com `id` |
| POST | `/{coleção}/bulk` | cria vários (importação por planilha), devolve a lista com `id` |
| PUT | `/{coleção}/{id}` | atualiza, devolve o registro |
| DELETE | `/{coleção}/{id}` | remove (use `ON DELETE CASCADE`) |
| POST | `/auth/admin` | `{username,password}` → `{token,email}` |
| POST | `/auth/google` | `{credential}` → `{name,email,picture,token}` |

Regras que o **servidor** deve aplicar:
- Escritas exigem o token de admin (`Authorization: Bearer ...`); leituras podem ser públicas.
- **`GET /players` sem token de admin deve omitir o campo `cpf`** (use a view `players_public` do `schema.sql`). Com token de admin, devolve o CPF.
- CPF duplicado deve responder erro (HTTP 409) — a restrição `UNIQUE` já garante.

Usando Supabase/Firebase em vez de backend próprio? Basta escrever um adaptador com os mesmos 5 métodos de `RestAdapter` em `store.js`.

## Segurança — leia antes de publicar

- No **modo local** tudo roda no navegador: a senha do admin e os CPFs ficam no `localStorage`. Serve para testes, **não protege dados reais** (quem abrir as ferramentas do navegador consegue ler). 
- Em produção use `dataMode: "api"`: o servidor valida a senha (guarde com bcrypt/argon2), valida o token do Google, bloqueia escritas de quem não é admin e **nunca envia o CPF ao público**.
- CPF é dado pessoal (LGPD): colete só o necessário, restrinja o acesso e guarde backups em local seguro.
- Nunca coloque senha, chave secreta ou credenciais do banco nos arquivos do site; só o `googleClientId` (público) fica no front-end.

## Estrutura

```
index.html  admin.html
css/style.css
js/config.js    configurações
js/store.js     camada de dados (local / API)
js/auth.js      login Google, convidado, admin
js/stats.js     classificação, desempate, mata-mata, artilharia, cartões
js/tournament.js sorteio de grupos, jogos e chaveamento
js/shared.js    elenco do clube e ficha do jogador
js/ui.js        utilitários (inclui validação de CPF)
js/app.js       página do usuário
js/admin.js     painel do administrador
db/schema.sql
```
