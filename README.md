# ♚ Chess Vault

Biblioteca pessoal de xadrez — partidas, jogadores, livros, vídeos e puzzles em um só lugar.

---

## Sobre o Projeto

Chess Vault nasceu como um projeto de aprendizado com um objetivo concreto: ter um lugar para guardar e organizar partidas favoritas de xadrez, jogadores que admiro, livros interessantes e vídeos educacionais.

A ideia não era construir outro Chess.com. Era construir **minha** plataforma, do jeito que eu precisava, enquanto aprendia Java, Spring Boot e tudo que vem junto.

O projeto passou por um recomeço no meio do caminho: nas duas primeiras semanas fiz um CRUD básico de usuários e, depois de "vibe codar" um monte de coisa sem entender direito o que estava fazendo, decidi parar e recomeçar do zero — mantendo o mesmo frontend, mas bem mais simplificado, dessa vez entendendo cada peça antes de colar o próximo bloco.

---

## Stack

| Camada   | Tecnologia                          |
|----------|-------------------------------------|
| Frontend | HTML, CSS, JavaScript (Vanilla)     |
| Backend  | Java 21 + Spring Boot 4.1           |
| Banco    | PostgreSQL (Neon)                   |
| Auth     | Spring Security + JWT (JJWT 0.12.6) |
| Cache    | Caffeine                            |
| Deploy   | Render (backend, Docker) · Cloudflare (frontend) · Neon (banco) |

---

## Funcionalidades

- **Partidas** — adicione, visualize e valide PGN de partidas; busca via API do Chess.com filtrando por jogadores e data; visualizador de tabuleiro integrado
- **Jogadores** — cadastre jogadores com busca automática de dados via API pública do Chess.com; vincule partidas a jogadores específicos
- **Livros** — biblioteca de livros de xadrez com pesquisa e sumário (e, futuramente, link de compra)
- **Vídeos** — busca de vídeos via YouTube Data API v3; player integrado (embed); salvar favoritos
- **Puzzles** — puzzle do dia e puzzle aleatório via API do Chess.com, com tabuleiro interativo e validação de lance
- **Autenticação** — JWT com Spring Security; cache de sessão via Caffeine para evitar consulta ao banco a cada requisição
- **Interface responsiva** — sidebar em formato de gaveta (menu hambúrguer) para uso mobile via browser

---

## Arquitetura

```
Frontend (Cloudflare)
       │
       ▼ HTTPS + JWT
Backend Spring Boot (Render/Docker)
       │
       ├─ Spring Security + JwtAuthFilter
       ├─ Cache Caffeine (UserLookupService)
       │
       ▼
PostgreSQL (Neon)
```

---

## Decisões técnicas e aprendizados

**Security Config e hash de senha**  
Depois do recomeço, a primeira peça nova foi a `SecurityConfig`, responsável pelo encoder que faz o hash da senha — pra ela nunca ficar salva como texto puro no banco. Entender o porquê (e não só copiar) foi mais simples do que parecia.

**JWT**  
Compreender JWT foi o próximo desafio, e o que mais travou no início: o motivo básico do seu uso, e como header, payload e signature se encaixam. A virada foi entender o passo a passo de gerar um token — criar o builder, colocar o `subject` (email) e o `issuedAt`/`expiration` no payload, e por fim assinar tudo com `HMACSHA256(base64(header.payload), secretKey)`, resultando em `header.payload.signature`. A implementação final usa JJWT 0.12.6 com `HS256`.

**Cache com Caffeine**  
O objetivo era simples: evitar bater no banco a cada clique/ação na aplicação. O problema real era mais específico — toda requisição autenticada passava pelo `JwtAuthFilter`, que buscava o usuário no banco pra validar se ele ainda existia, e essa busca ia direto pro repositório sem nenhum `@Cacheable`, repetindo a consulta em **toda** request.

A pesquisa sobre qual biblioteca usar apontou o Caffeine como preferível pro contexto. A solução foi centralizar essa busca num `UserLookupService` cacheado — criei o `CacheConfig` com um bean do Caffeine (tempo de validade e tamanho configurados ali), habilitei na classe principal, e anotei os métodos de busca. Funcionou — mas revelou um efeito colateral: ao adicionar novos registros, o cache ficava desatualizado (stale), porque a escrita não invalidava o que já estava cacheado. Resolvido com `@CacheEvict` nos métodos de escrita.

**Validação de PGN**  
Integrada a biblioteca `chess-lib` para validar lances antes de salvar partidas — necessário porque um PGN de partida real (como os que vêm da API do Chess.com) inclui metadados como relógio de cada lance, abertura via ECO, e outros campos que precisam ser bem interpretados antes de qualquer validação de lance.

**API Chess.com**  
Funciona bem para jogadores ativos com username exato — mas jogadores históricos ou sem conta no Chess.com não são encontrados. Pra achar um jogador, é preciso o nome exato de dois jogadores + a data da partida, e mesmo assim pode não encontrar. Limitação conhecida da API, sem solução simples por agora.

**Busca de partidas**  
Segue sendo o ponto mais fraco da aplicação — na prática, é mais rápido achar a partida direto no Google ou YouTube do que pela busca interna, e mesmo dentro da própria plataforma do Chess.com a busca não ajuda muito. Fica como possível próximo passo explorar a base de dados do Lichess como alternativa.

**Embed de vídeos do YouTube**  
Alguns vídeos aparecem como "indisponível" no player interno. Isso é uma restrição do próprio canal no YouTube (embed desabilitado pelo dono do vídeo) — não é bug da aplicação.

**Lição recorrente**  
O problema mais frequente ao longo do projeto não foi técnico — foi falta de atenção na escrita (nomes de endpoints, de caches, URLs), gerando inconsistência de dados por descuido, não por lógica errada.

---

## Linha do tempo

| Data | Marco |
|------|-------|
| — | CRUD básico de usuários; decisão de recomeçar o projeto do zero |
| 12/08/2026 | MVP quase encaminhado |
| 15/08/2026 | Aplicação em produção (Cloudflare + Render + Neon) |
| 24/08/2026 | **MVP funcional** — busca de livros, cadastro de jogadores, busca de partidas, validação de PGN, vídeos e puzzles todos operacionais |

---

## Problemas conhecidos / Próximos passos

- [ ] Busca de jogadores ainda depende do username exato no Chess.com — jogadores históricos ou não registrados não são encontrados
- [ ] Busca de partidas limitada (Chess.com requer dados muito específicos); explorar a base do Lichess como alternativa
- [ ] Backend no Render vai a sleep após 15 min de inatividade — migração planejada para Oracle Cloud (VPS sempre ativa)
- [x] Interface mobile (responsividade) — implementada
- [ ] Seção de perfil e configurações pendentes
- [ ] Melhorar layout dos cards de livros e expandir o tipo de pesquisa (aumentar quantidade de resultados)
- [ ] Verificar segurança de ponta a ponta e lapidar o visual geral
- [ ] Avaliar cache invalidation em outros pontos além de usuário (mesmo padrão que gerou o bug do Caffeine)
- [ ] Futuramente: webhooks e websockets

---

## Como rodar localmente

**Pré-requisitos:** Java 21, Maven, PostgreSQL

```bash
# 1. Clone o repositório
git clone https://github.com/M4RCOSx15/ChessVaultFrontend.git
cd chess-vault

# 2. Configure as variáveis de ambiente
cp .env.example .env
# Edite .env com suas credenciais

# 3. Sirva o frontend
cd ChessVaultFrontend
npx http-server -p 5500
# ou abra index.html com Live Server no VS Code
```

**Variáveis de ambiente necessárias:**

```env
SPRING_DATASOURCE_URL=jdbc:postgresql://...
SPRING_DATASOURCE_USERNAME=...
SPRING_DATASOURCE_PASSWORD=...
JWT_SECRET=...
YOUTUBE_API_KEY=...
```

---

## Endpoints principais

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/auth/register` | Cadastro |
| POST | `/auth/login` | Login — retorna JWT |
| GET | `/partidas/buscartodaspartidas` | Listar partidas |
| POST | `/partidas/criarpartida` | Criar partida |
| DELETE | `/partidas/deletarpartidas/{id}` | Deletar partida |
| GET | `/jogador/buscartodosjogadores` | Listar jogadores |
| POST | `/jogador/criarjogador` | Criar jogador |
| DELETE | `/jogador/deletarjogador/{id}` | Deletar jogador |
| GET | `/videos/buscar?termo=` | Busca YouTube em tempo real |
| POST | `/videos/salvarvideo` | Salvar vídeo no banco |
| GET | `/puzzles/diario` | Puzzle do dia |
| GET | `/puzzles/aleatorio` | Puzzle aleatório |

---

## Status

**MVP funcional desde 24/08/2026.**

Aplicação em produção com todas as funcionalidades core operacionais. Foco atual: estabilidade, melhorias de busca (jogadores e partidas) e migração do backend para infraestrutura sem sleep (Oracle Cloud).

---

## Autor

**Marcos** — estudante de Ciência da Computação (UNA), técnico em Mecatrônica (IFMG).  
Projeto construído como aprendizado prático de desenvolvimento backend Java com Spring Boot.
