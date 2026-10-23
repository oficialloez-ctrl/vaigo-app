#!/usr/bin/env python3
"""Importa um município do CNEFE/IBGE para índice compacto de endereços ZECA.
Uso: python scripts/import_cnefe.py 4108403 FRANCISCO_BELTRAO
"""
import csv,io,json,sys,urllib.request,zipfile,pathlib,re,unicodedata
code=sys.argv[1] if len(sys.argv)>1 else '4108403'
name=sys.argv[2] if len(sys.argv)>2 else 'FRANCISCO_BELTRAO'
url=('https://ftp.ibge.gov.br/Cadastro_Nacional_de_Enderecos_para_Fins_Estatisticos/'
'Censo_Demografico_2022/Arquivos_CNEFE/CSV/Municipio/'+code[:2]+'_PR/'+code+'_'+name+'.zip')
print('Baixando',url,flush=True)
req=urllib.request.Request(url,headers={'User-Agent':'ZECA-CNEFE-Importer/1.0'})
with urllib.request.urlopen(req,timeout=90) as response: blob=response.read()
with zipfile.ZipFile(io.BytesIO(blob)) as archive:
    filename=next(n for n in archive.namelist() if n.lower().endswith('.csv'))
    with archive.open(filename) as raw:
        text=io.TextIOWrapper(raw,encoding='utf-8-sig',errors='replace')
        reader=csv.DictReader(text,delimiter=';')
        print('Campos:',reader.fieldnames)
        def field(row,*names):
            for key in names:
                value=row.get(key)
                if value is not None and str(value).strip():return str(value).strip()
            return ''
        rows=[];seen=set();invalid=0
        for row in reader:
            street=field(row,'NOM_LOG','NOM_LOGRADOURO')
            number=field(row,'NUM_ENDERECO','NUM_LOG')
            lat=field(row,'LATITUDE');lon=field(row,'LONGITUDE')
            if not street or not number or not lat or not lon:invalid+=1;continue
            try:a=float(lat.replace(',','.'));b=float(lon.replace(',','.'))
            except ValueError:invalid+=1;continue
            if not(-34<a<-1 and -75<b<-30):invalid+=1;continue
            road=' '.join(filter(None,[field(row,'TIP_LOG','TIPO_LOGRADOURO'),street]))
            item=[road,number,field(row,'NOM_BAIRRO','BAIRRO'),field(row,'CEP'),round(a,6),round(b,6),field(row,'NV_GEO_COORD')]
            key=(road.casefold(),number,a,b)
            if key in seen:continue
            seen.add(key);rows.append(item)
path=pathlib.Path('data/cnefe')/(code+'.json');path.parent.mkdir(parents=True,exist_ok=True)
path.write_text(json.dumps({'municipio':code,'fonte':'IBGE CNEFE Censo 2022','columns':['rua','numero','bairro','cep','lat','lon','nivel_geocodificacao'],'rows':rows},ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('Gravado',path,'registros',len(rows),'descartados/incompletos',invalid)
