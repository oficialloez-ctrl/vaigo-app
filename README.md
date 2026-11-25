# ZECA · homologação em Francisco Beltrão

Aplicação web instalável para ensaios de corridas sem cobrança, com interface de passageiro, painel de motorista e administração por perfil. As corridas de homologação são persistidas no PostgreSQL. O painel operacional requer conexão e o motorista deve manter o aplicativo em primeiro plano.

O [caderno de homologação](docs/HOMOLOGACAO.md) reúne acesso por perfil, instalação, arquitetura, auditoria, testes executados, custos estimados, roteiro do piloto e pendências de lançamento.

Para executar a aplicação com as funções Node, use a Vercel CLI em ambiente de desenvolvimento configurado com um banco isolado. O banco precisa do esquema legado de autenticação/configuração e da migração migrations/001-piloto.sql. Um servidor de arquivos estáticos serve apenas a interface.
