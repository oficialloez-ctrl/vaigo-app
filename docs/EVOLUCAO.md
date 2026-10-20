# Evolução VaiGo — arquitetura de corridas reais

## Situação atual
O site na branch `main` continua sendo um protótipo. Esta branch é uma **fundação de engenharia**, não uma integração pronta: não há motoristas reais conectados, pagamento, verificação de identidade ou despacho automático.

## Origem das ideias
Referências analisadas:
- Avijit200318/Uber-Clone (MIT): separação de serviços, estados de viagem, OTP e WebSocket.
- rota259/Za2zo2a (MIT): organização funcional, módulos de segurança e administrativo.
- K-Daksh/UberClone e tanav29/uber: estudo conceitual; não incorporamos código pois licença de reutilização não foi confirmada.

O código nesta branch foi escrito especificamente para VaiGo, sem cópia literal desses sistemas.

## Arquivos novos
- `supabase/migrations/001_vaigo_base.sql`: tabelas de perfis, motoristas, corridas e coordenadas; RLS bloqueia alterações diretas não autorizadas.
- `src/domain/ride-state.mjs`: transições permitidas e checagens básicas de ator.
- `src/domain/ride-state.test.mjs`: teste unitário básico. Execute `node src/domain/ride-state.test.mjs` com Node.js instalado.

## Próximos passos antes de permitir corridas reais
1. Vincular um projeto Supabase de testes e aplicar migração depois de revisar RLS.
2. Criar signup/login e aprovação de motoristas administrada no servidor.
3. Criar endpoints de solicitação, aceite atômico, OTP, conclusão e cancelamento com transações no PostgreSQL.
4. Criar aplicativo do motorista, localização sob consentimento, atualização ao vivo e expiracão de posições antigas.
5. Integrar geocodificador robusto com chave protegida no servidor e confirmação manual de endereço quando faltarem números.
6. Implementar testes automatizados, segurança, limites de requisições e privacidade antes de produção.

## Observações
- O campo `role` é apenas informativo, não deve conceder privilégios. A aprovação do motorista ocorre por rotina administrativa no servidor.
- Não coloque chaves de API ou `service_role` do Supabase no frontend nem no repositório.
- O local exato do usuário e do motorista só deve ser divulgado aos participantes autorizados da corrida, quando necessário.
