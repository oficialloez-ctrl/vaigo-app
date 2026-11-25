# ZECA | Caderno de homologação · 25/11/2026

## Versão e restauração

A base é o commit b5b21d686dc6401d01f54669c3b1c3e4f316d0fc de fix/busca-enderecos-regional. A branch homologacao/operacao-piloto serve para testes. A página HTML carrega a interface, Leaflet, login, publicidade e o painel operacional. As funções Node da Vercel consultam o Postgres do Neon via HTTPS. As contas e preferências existentes são compartilhadas com a versão anterior. Operações de corrida ficam no esquema separado zeca_piloto. A API de piloto recusa VERCEL_ENV=production. O isolamento completo de banco, identidade, segredos e credenciais entre ambientes ainda precisa ser feito.

O Neon conserva o ponto restauracao-antes-piloto-20261125, criado antes da migração aditiva. Em um incidente, interromper os testes, redirecionar os testadores à versão anterior e comparar uma cópia do ponto de restauração com o estado vigente. Uma restauração da base inteira requer conciliação dos dados recebidos depois do ponto e autorização do proprietário. O procedimento completo de recuperação ainda precisa de ensaio. Não incluir dados de usuários no ZIP.

## Acesso e exercício

1. No iPhone abra o endereço de prévia no Safari. Em Compartilhar, use Adicionar à Tela de Início. No Android abra no Chrome e use Adicionar à tela inicial ou Instalar aplicativo. Essa instalação abre a versão web.
2. Cada participante usa seu próprio e-mail. Na tela de login, “Criar minha senha” envia o código de verificação. “Esqueci minha senha” inicia a recuperação. A sessão é específica do endereço da prévia.
3. O motorista abre Configurações → Motorista → Abrir painel do motorista. Envia nome, modelo, cor, placa e categoria. A conta fica pendente.
4. O administrador abre Configurações → Administração → Gerenciar motoristas do piloto. Confere a identidade do participante por um canal previamente acordado, aprova o motorista e libera o e-mail do passageiro. A liberação de passageiro para um teste não concede acesso administrativo. Só a conta proprietária pode delegar acesso ao painel administrativo geral. Documentos pessoais ainda não devem ser enviados pelo app.
5. Motorista ativa disponibilidade e concede GPS. Passageiro escolhe embarque e destino em Francisco Beltrão, aguarda rota, escolhe a categoria correspondente ao veículo, revisa distância e duração e confirma. O painel do motorista deve ficar visível. Os dois participantes podem consultar o histórico no próprio perfil.
6. O motorista aceita, confirma chegada, embarque/início e encerramento. O passageiro acompanha o estado em Minhas corridas. Cancelamento disponível até o início. O registro de teste é sem cobrança. Se a conexão cair, reabra o painel e confira o estado confirmado pelo servidor antes de repetir.

## Auditoria e mudanças

O fluxo antigo de corrida dependia de temporizadores e histórico do navegador. Isso impedia que outro dispositivo aceitasse ou recuperasse a mesma corrida. O novo fluxo usa cotações com validade de cinco minutos, transições condicionais, participantes únicos por corrida ativa, recusa individual, liberação das ocupações no fim e auditoria transacional. A lista de ofertas usa categoria, disponibilidade, aprovação e proximidade retangular. As contas em teste precisam de convite para solicitar. O motorista transmite a posição com o painel em primeiro plano. A presença expira em 45 segundos. A tela verifica o servidor a cada cinco segundos enquanto acompanha uma corrida. Entrar na aplicação novamente consulta a conta e suas viagens. A busca expira na leitura seguinte, depois de cinco minutos sem aceite.

O mapa da frota exibe posição arredondada. Apenas o passageiro vinculado recebe coordenadas recentes do motorista da sua corrida. A área de teste é uma caixa em torno da cidade, ainda sem polígono municipal homologado. O acesso à rota depende de serviço viário externo. O tempo mostrado é o do trajeto embarque–destino. Falta calcular ETA de aproximação até o embarque.

## Segurança e pendências

As sessões existentes usam cookie HttpOnly/Secure, digest e validade no servidor. Verificação administrativa e acesso por participante são aplicados na API. As consultas usam parâmetros. A API registra o ator das mudanças de estado. Revisões administrativas de motorista também geram evento. Controles verificados nesta entrega cobrem acesso sem sessão, origem, perfil, convite, placa, área do piloto e transições principais. Continuam pendentes revisão independente, privilégios mínimos do usuário de banco, controle distribuído de frequência de pesquisa/posição, gestão de retenção, limitação de consultas geográficas, verificação de GPS adulterado e análise de dependências cliente/CDN. O envio de localização não prova embarque físico. O bloqueio administrativo é recusado enquanto o participante está numa corrida ativa; falta interrupção assistida por operador. Antes de abrir o piloto a terceiros, definir atendimento e revogação imediata em incidente.

## Mapa e busca comercial

O fluxo combina base local do CNEFE/IBGE, catálogo de pontos com nome e atualização por Overpass, Photon e consulta explícita de endereço. Dados censitários não são um cadastro comercial corrente. Um comércio novo ou com nome fantasia diferente pode faltar. Fotografia do catálogo e cron não comprovam atualização diária bem-sucedida. Medir data da última importação, indisponibilidade e cadastros sem número; manter a última base válida em falha. Falta fila administrativa para conferir correções e publicar estabelecimentos locais verificados. Para comparar provedores, registrar uma amostra de 30 buscas em Francisco Beltrão, divididas entre residências numeradas, comércios conhecidos e pequenos/novos negócios. Registrar nome e endereço retornados, correspondência entre os três primeiros, erro do pino em metros, data e divergências conferidas no local.

| Alternativa | Aplicação no ZECA | Custo e limite |
|---|---|---|
| Dados OSM + serviços públicos atuais | Piloto controlado, facilidade de conferir e corrigir dados locais | Tiles públicos têm capacidade limitada, sem garantia de serviço. Nominatim público não permite autocomplete no cliente. Preservar atribuição. |
| Mapbox | Avaliar mapas vetoriais, SDK móvel, busca e navegação onde houver cobertura do produto | Cobrança por produto, incluindo uso de mapas e sessões. Confirmar a cobertura brasileira específica de POIs e medir em Beltrão antes de integrar. |
| Google Maps Platform | Avaliar Places, autocomplete, geocodificação e Routes com a mesma amostra | Franquias e faixas distintas por SKU. Projetar sessões, detalhes e rotas separadamente. A cobertura de uma residência ou comércio precisa de validação local. |

Fontes de preços e políticas: https://www.mapbox.com/pricing · https://developers.google.com/maps/billing-and-pricing/pricing · https://operations.osmfoundation.org/policies/tiles/ · https://operations.osmfoundation.org/policies/nominatim/

## Custos e pagamentos

Cenário de avaliação: dois motoristas, 100 corridas de teste por mês, 20 minutos de acompanhamento por corrida, três clientes consultando a cada cinco segundos. Até 72 mil leituras HTTP de painel durante essas corridas, além de GPS, busca e consultas em espera. Cada leitura do painel desencadeia múltiplas consultas SQL. Antes de escalar, separar expiração de pedidos de leitura, indexar a expiração e substituir consultas repetitivas por assinatura de eventos. Medir tempo p95, compute, consumo de rede e cotas reais na prévia.

Neon Free anuncia 100 CU-h e 1 GB de banco por projeto. Vercel Pro tem referência de US$ 20/mês mais consumo aplicável; a oferta Hobby é voltada ao uso pessoal e não comercial. Cenário indicativo de hospedagem comercial de entrada: US$ 20/mês se as demais franquias atenderem, além de mapas, mensagens, banco, armazenamento privado, domínio, tributos, lojas e adquirência conforme uso. Não é orçamento total nem cotação em reais. Os testes não ativam produtos pagos.

Avaliar Mercado Pago Marketplace/Split e Stripe Connect para cadastro de recebedores, disponibilidade Pix/cartão/débito, divisão, estornos e conciliação. Dinheiro deve ter confirmação manual dos envolvidos. Pix manual precisa de conciliação. Para captura automática, usar tokens do PSP, chave idempotente por tentativa, webhook autenticado, identificador único de evento e reconciliação servidor a servidor. Cartão recusado e evento duplicado ainda não foram ensaiados com um PSP. Nenhuma tarifa comercial foi fixada. As preferências herdadas da calculadora administrativa são ilustrativas.

Fontes: https://neon.com/pricing · https://vercel.com/pricing · https://www.mercadopago.com.br/developers/pt/docs/split-payments · https://stripe.com/br/connect/pricing

## Ensaios e estado individual

Executados: sete testes unitários/contrato em Node; um cenário de integração com a API real e PostgreSQL local em PGlite (contas, GPS e roteador controlados); um ensaio SQL no Neon com reversão dos registros de teste. A integração cobre solicitação, envio concorrente de dois aceites na mesma instância local, recusa, chegada, início, finalização, acesso entre perfis, cancelamento, avaliações e histórico. PGlite executa comandos numa conexão; concorrência entre conexões de produção continua pendente. O teste SQL confirmou índices, ocupações, auditoria e liberação após cancelamento. Para repetir localmente: node --test tests/api.test.js; instalar @electric-sql/pglite@0.6.0 em diretório de testes e disponibilizar seu node_modules via NODE_PATH antes de executar node --test tests/viagem.test.js. Rodar tests/piloto.sql somente em banco de homologação com a migração aplicada.

| Função | Estado | Evidência ou lacuna |
|---|---|---|
| Restrições de ocupação e trilha de status | Concluída e testada | Ensaio no PostgreSQL Neon e integração local |
| Solicitar, aceitar, recusar, chegar, iniciar, encerrar, cancelar, avaliar, consultar histórico | Implementada, aguardando homologação | Fluxo automatizado; validar aparelhos e conexões independentes |
| Cadastro e aprovação de motorista, convite de passageiro, disponibilidade por categoria e GPS | Implementada, aguardando homologação | API exercitada; posição e aprovação precisam de teste físico |
| Cadastro/login por e-mail, recuperação de senha, edição de nome, permissões administrativas e publicidade | Implementada, aguardando homologação | Recursos herdados; falta repetir autenticação e entrega de e-mails em aparelhos |
| Endereço por número, comércio, autocomplete, seleção no mapa | Parcialmente implementada | Cobertura depende de fontes; aferição de campo e curadoria pendentes |
| Localização durante a corrida e acompanhamento | Parcialmente implementada | Primeiro plano, atualização periódica e navegação externa; ETA até passageiro pendente |
| Compartilhamento | Parcialmente implementada | Texto pelo compartilhamento do sistema; falta link temporário ao vivo |
| Tarifa, comissão, ganhos e financeiro | Parcialmente implementada | Calculadora de cenário; falta política versionada por região/horário, razão contábil e repasse |
| Dinheiro, Pix, crédito, débito e estorno | Não implementada | Piloto exclusivamente sem cobrança |
| Chat, emergência, contatos de confiança, central de suporte | Não implementada | Dependem de fluxo de atendimento e proteção de dados |
| Documentos com armazenamento privado e análise | Não implementada | Aprovação da conta não verifica documento |
| Agendamento, cupons, múltiplas paradas e entregas | Não implementada | Fora do fluxo básico |
| GPS em segundo plano e push de chamada | Não implementada | A versão web interrompe o envio ao sair da tela |
| Android/iPhone e pares cruzados físicos | Bloqueada por dependência externa | Aparelhos e participantes |
| Publicação em lojas e autorização municipal | Bloqueada por dependência externa | Contas, revisão e autorização administrativa |

## Piloto e aparelhos

Primeiro ensaio parado, com dois celulares lado a lado e contas separadas. Validar embarque/destino reais escolhidos pelos participantes, valores sem cobrança e mesma viagem nos dois aparelhos. Repetir invertendo plataformas. Adicionar o segundo motorista para disputar a mesma oferta. Em local seguro, verificar perda de rede antes/depois do aceite, restauração da sessão, GPS negado, mudança de precisão, cancelamentos, encerramento repetido e busca expirada. Registrar horário, ID da corrida, versões de SO, navegador e app, estado mostrado e bateria antes/depois. Não incluir nomes, telefones ou coordenadas residenciais nos relatórios compartilhados.

| Conjunto físico | Estado | Itens críticos |
|---|---|---|
| Android passageiro | Não executado | Cadastro, localização, oferta, acompanhamento, histórico e reconexão |
| Android motorista | Não executado | Oferta, aceite, rota ativa, bloqueio de tela, bateria e rede |
| iPhone passageiro | Não executado | Safari e app instalado, sessão, busca e sincronização |
| iPhone motorista | Não executado | Permissões, tela bloqueada, suspensão e retomada |
| Android passageiro × iPhone motorista e inverso | Não executado | Mesma corrida e estados nos dois sentidos |

Aproveitar a interface web via Capacitor é a opção inicial de menor reescrita. O componente do motorista exige implementação nativa de localização, ciclo de vida e push, além de ensaios em Android e iOS. Comparar com um app de motorista em React Native se o invólucro web impuser limitações de navegação ou ciclo de vida. Preparar IDs, assinaturas do titular, permissões de localização com finalidade clara, política pública revisada, ficha de privacidade, conta de revisão, testes internos Android e TestFlight. Pacotes nativos assinados e distribuição em lojas estão pendentes.

Antes de ampliar, registrar falhas de busca, chamadas perdidas, divergências de status, atrasos do GPS, duplicações e bateria. Suspender o ensaio se surgir exposição de dados, vínculo duplo, pagamento inesperado ou perda de corrida. Faltam testes de carga, indisponibilidade real do servidor, restauração completa, pagamento recusado e reconexão em estrada.

## Município, termos e privacidade para revisão

A Lei Municipal 5.288 de 17/12/2025 exige autorização do poder municipal para transporte privado individual remunerado. Prevê requisitos de habilitação com EAR, veículo, CRLV, certidão, seguro, contribuição previdenciária e tributos. Confirmar junto ao município o decreto/procedimento vigente, seguro exigível, critérios do veículo e documentos da plataforma antes da operação remunerada. O cadastro de teste não concede autorização municipal.

Fonte: https://sapl.franciscobeltrao.pr.leg.br/media/sapl/public/documentoacessorio/2025/1466/lei_no_5.288_de_17_de_dezembro_de_2025.pdf

Minuta de condições de teste: o ZECA oferece a participantes convidados um ambiente de avaliação de solicitações de transporte sem cobrança. O participante deve manter seus dados corretos e sua conta pessoal. A disponibilidade depende de aprovação, sinal GPS, rede e motoristas online. O passageiro pode cancelar até o início da viagem. Os participantes devem relatar divergências pelo canal de suporte a ser definido antes dos testes externos. A versão comercial dependerá das regras de preço, cancelamento, seguro e atendimento aprovadas pelo responsável.

Minuta de privacidade: o ZECA trata identificadores de conta, informações do veículo, coordenadas durante a disponibilidade, endereços, estados das viagens e avaliações para autenticação, distribuição e acompanhamento. A frota apresenta posições aproximadas. O passageiro vinculado pode ver a identificação do veículo e a última posição recente durante a corrida. Consultas de localização e rotas envolvem provedores externos. O aviso definitivo deve identificar controlador e contato de direitos, operadores, bases legais por finalidade, retenção por categoria, transferências, medidas de segurança, revogação de acesso, atendimento e descarte. Esses elementos ainda exigem decisão do controlador e revisão jurídica.

Referências: https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm · https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia-orientativo-sobre-seguranca-da-informacao-para-agentes-de-tratamento-de-pequeno-porte

Interface verificada em Chromium headless com viewport de 390 × 844 e respostas de API controladas: área autenticada, painel de corridas vazio e formulário de motorista abriram sem erro JavaScript. Mapas externos e aparelhos físicos não fizeram parte desse ensaio.
