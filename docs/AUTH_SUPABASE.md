# Autenticação VaiGo com Supabase — fase de testes

## Estado real
Implementamos as telas `auth.html`, `auth/style.css` e `auth/app.js`, porém **a autenticação ainda não está ativa**. Falta criar um projeto Supabase exclusivo do VaiGo, aplicar migrações e preencher a configuração pública.

A versão atual em produção (branch `main`) não foi modificada por esta etapa. O código está em `feat/arquitetura-corridas-reais` / PR #2.

## Ativação planejada
1. Escolher e autorizar a organização do Supabase onde será criado **um projeto separado** chamado `vaigo`, na região `sa-east-1`.
2. Consultar o custo real na organização. Se houver cobrança, confirmar explicitamente antes de criar.
3. Aplicar na ordem:
   - `supabase/migrations/001_vaigo_base.sql`
   - `supabase/migrations/002_driver_applications.sql`
4. Obter somente o **Project URL** e a **Publishable Key** (chave destinada ao cliente) em Supabase e preencher `auth/config.js`.
5. No painel Supabase Auth: configurar Site URL e Redirect URLs para o domínio de testes HTTPS do VaiGo e confirmar se a verificação de e-mail está ativada.
6. Publicar ambiente de teste separado e validar login, cadastro, verificação de e-mail, logout, RLS e solicitação de credenciamento.
7. Somente após os testes, fazer revisão de código e incorporar à versão pública.

## Fluxo de cadastro implementado
- Passageiro: cadastro com nome, e-mail e senha; inserção de perfil `rider` após login verificado.
- Motorista: cadastro inicial como passageiro, seguido de uma solicitação de motorista `pending` que exige aprovação posterior por administração segura.
- Os perfis não conseguem se autoconceder papel administrativo ou aprovação de motorista por meio da interface.
- Não há ainda fluxo para o administrador analisar/aprovar motoristas; terá de ser implementado **no backend protegido**.
- Ainda não existem solicitações de corridas reais pelo navegador, apenas simulação.

## Segurança e dados pessoais
- Nunca incluir `service_role` ou secret keys no navegador, em `auth/config.js`, em variáveis `VITE_*` ou no GitHub.
- A Publishable Key **não é um segredo** e requer RLS rigorosa para limitar o acesso aos dados.
- Não permitir que usuários alterem diretamente status de corridas ou aprovem motoristas.
- Não publicar posições exatas dos motoristas para todos os usuários; limitar a participantes autorizados.
- Usar HTTPS. Senhas são processadas pelo Supabase Auth, e não pelo frontend VaiGo.
- Considerar controles de fraude, LGPD, proteção de dados, regras locais para transporte e testes de penetração antes de qualquer uso comercial.

## Teste de engenharia
Os novos arquivos foram criados no repositório. A execução de login em dois navegadores e a aplicação das migrações só poderão ser testadas depois da criação do projeto. `node src/domain/ride-state.test.mjs` testa apenas regras locais de estado da corrida.
