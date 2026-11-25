-- Executa cenários em uma subtransação e desfaz os registros de teste.
DO $$
DECLARE a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); m text:=a::text||'@example.invalid'; p text:=b::text||'@example.invalid';
BEGIN
 BEGIN
  INSERT INTO zeca_piloto.motoristas(email,nome,veiculo,placa,categoria) VALUES(m,'Teste','Teste','TESTE','eco');
  INSERT INTO zeca_piloto.corridas(id,ator,passageiro,categoria,origem,destino,km,minutos) VALUES(a,p,p,'eco','{}','{}',2,5),(b,p,p,'eco','{}','{}',2,5);
  UPDATE zeca_piloto.corridas SET estado='buscando' WHERE id=a;
  BEGIN
   UPDATE zeca_piloto.corridas SET estado='buscando' WHERE id=b;
   RAISE EXCEPTION 'dupla solicitação permitida';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  UPDATE zeca_piloto.corridas SET motorista=m,ator=m,estado='aceita' WHERE id=a AND estado='buscando';
  IF (SELECT count(*) FROM zeca_piloto.ocupacoes WHERE corrida=a)<>2 THEN RAISE EXCEPTION 'vínculos ausentes'; END IF;
  UPDATE zeca_piloto.corridas SET estado='cancelada',ator=p WHERE id=a;
  IF EXISTS(SELECT 1 FROM zeca_piloto.ocupacoes WHERE corrida=a) THEN RAISE EXCEPTION 'ocupação retida'; END IF;
  IF (SELECT count(*) FROM zeca_piloto.eventos WHERE corrida=a)<>3 THEN RAISE EXCEPTION 'auditoria incompleta'; END IF;
  RAISE EXCEPTION USING ERRCODE='ZX001';
 EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
 END;
 IF EXISTS(SELECT 1 FROM zeca_piloto.corridas WHERE id=a) THEN RAISE EXCEPTION 'teste não revertido'; END IF;
END $$;
