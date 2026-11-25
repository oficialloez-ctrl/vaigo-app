BEGIN;
CREATE SCHEMA IF NOT EXISTS zeca_piloto;
CREATE TABLE IF NOT EXISTS zeca_piloto.motoristas (
 email text PRIMARY KEY, nome text NOT NULL, veiculo text NOT NULL, placa text NOT NULL,
 categoria text NOT NULL CHECK(categoria IN ('eco','comfort','xl')),
 situacao text NOT NULL DEFAULT 'pendente' CHECK(situacao IN ('pendente','aprovado','bloqueado','rejeitado')),
 online boolean NOT NULL DEFAULT false, lat float8, lon float8, visto timestamptz
);
CREATE TABLE IF NOT EXISTS zeca_piloto.corridas (
 id uuid PRIMARY KEY, ator text NOT NULL, passageiro text NOT NULL, motorista text REFERENCES zeca_piloto.motoristas(email),
 categoria text NOT NULL CHECK(categoria IN ('eco','comfort','xl')), origem jsonb NOT NULL, destino jsonb NOT NULL,
 km numeric NOT NULL CHECK(km>0), minutos integer NOT NULL CHECK(minutos>0),
 estado text NOT NULL DEFAULT 'cotacao' CHECK(estado IN ('cotacao','buscando','aceita','chegou','em_viagem','concluida','cancelada','expirada')),
 criada timestamptz NOT NULL DEFAULT now(), alterada timestamptz NOT NULL DEFAULT now(),
 pagamento text NOT NULL DEFAULT 'sem_cobranca' CHECK(pagamento='sem_cobranca')
);
CREATE UNIQUE INDEX IF NOT EXISTS uma_corrida_passageiro ON zeca_piloto.corridas(passageiro) WHERE estado IN ('buscando','aceita','chegou','em_viagem');
CREATE UNIQUE INDEX IF NOT EXISTS uma_corrida_motorista ON zeca_piloto.corridas(motorista) WHERE estado IN ('aceita','chegou','em_viagem');
CREATE INDEX IF NOT EXISTS painel_passageiro ON zeca_piloto.corridas(passageiro,alterada DESC);
CREATE INDEX IF NOT EXISTS painel_motorista ON zeca_piloto.corridas(motorista,alterada DESC);
CREATE INDEX IF NOT EXISTS chamadas ON zeca_piloto.corridas(categoria,alterada) WHERE estado='buscando';
CREATE TABLE IF NOT EXISTS zeca_piloto.recusas (
 corrida uuid REFERENCES zeca_piloto.corridas(id), motorista text REFERENCES zeca_piloto.motoristas(email), PRIMARY KEY(corrida,motorista)
);
CREATE TABLE IF NOT EXISTS zeca_piloto.avaliacoes (
 corrida uuid REFERENCES zeca_piloto.corridas(id), autor text, estrelas integer NOT NULL CHECK(estrelas BETWEEN 1 AND 5), PRIMARY KEY(corrida,autor)
);
CREATE TABLE IF NOT EXISTS zeca_piloto.eventos (
 seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, corrida uuid, ator text NOT NULL, acao text NOT NULL, instante timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS zeca_piloto.convidados (email text PRIMARY KEY);
CREATE TABLE IF NOT EXISTS zeca_piloto.ocupacoes (email text PRIMARY KEY, corrida uuid NOT NULL REFERENCES zeca_piloto.corridas(id));
CREATE OR REPLACE FUNCTION zeca_piloto.audita_corrida() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.estado='buscando' AND OLD.estado='cotacao' THEN
  INSERT INTO zeca_piloto.ocupacoes VALUES(NEW.passageiro,NEW.id);
 ELSIF NEW.estado='aceita' AND OLD.estado='buscando' THEN
  INSERT INTO zeca_piloto.ocupacoes VALUES(NEW.motorista,NEW.id);
 ELSIF NEW.estado IN ('cancelada','concluida','expirada') THEN
  DELETE FROM zeca_piloto.ocupacoes WHERE corrida=NEW.id;
 END IF;
 IF NEW.estado<>'cotacao' AND (TG_OP='INSERT' OR NEW.estado IS DISTINCT FROM OLD.estado) THEN
  INSERT INTO zeca_piloto.eventos(corrida,ator,acao) VALUES(NEW.id,NEW.ator,NEW.estado);
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER evento_corrida AFTER INSERT OR UPDATE ON zeca_piloto.corridas FOR EACH ROW EXECUTE FUNCTION zeca_piloto.audita_corrida();
COMMIT;
