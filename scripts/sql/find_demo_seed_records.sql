-- Lista registros de exemplo gravados pelo seed automático antigo do frontend
-- (loadOrSeed* com bulkCreate, removido no PR #13 em 23/10/2026).
--
-- SOMENTE LEITURA: nada é apagado ou alterado. Rodar com psql no banco desejado:
--   psql "$DATABASE_URL" -f scripts/sql/find_demo_seed_records.sql
--
-- Sinais usados para separar exemplo de coincidência:
--   * titulo_de_exemplo : o título bate com um mock de frontend/src/mediamind/data.js
--   * gravado_em_lote   : gravado no mesmo segundo que outros exemplos da mesma
--                         entidade e empresa (o seed gravava tudo de uma vez)
--   * editado_depois    : updated_at posterior ao created_at; alguém pode ter
--                         reaproveitado o registro como dado real — revisar antes
--                         de qualquer exclusão.
-- Valores gerados de data.js; regenerar se os mocks mudarem.

WITH exemplos(entity_type, campo, valor) AS (
  VALUES
    ('Asset', 'title', 'Entrevista Prefeito'),
    ('Asset', 'title', 'Drone Centro Histórico'),
    ('Asset', 'title', 'Comerciantes comentam mudanças'),
    ('Asset', 'title', 'Relatório Turismo Centro'),
    ('Asset', 'title', 'Obras de Revitalização'),
    ('Asset', 'title', 'Entrevista - Festival de Inovação'),
    ('Asset', 'title', 'B-roll - Cidade ao amanhecer'),
    ('Asset', 'title', 'Áudio base - trilha institucional'),
    ('Script', 'title', 'Jornal 15h — 15/05'),
    ('Script', 'title', 'Matéria Enchentes'),
    ('Script', 'title', 'Especial Educação'),
    ('Script', 'title', 'Turismo RS'),
    ('Clip', 'title', 'Corte — Prefeito fala sobre obras'),
    ('Clip', 'title', 'Corte — Drone centro ao entardecer'),
    ('Clip', 'title', 'Corte — Comerciantes reclamam'),
    ('ProducaoProjeto', 'titulo', 'Saúde mental no trabalho'),
    ('ProducaoProjeto', 'titulo', 'Inovação em telemedicina'),
    ('ProducaoProjeto', 'titulo', 'A trajetória do Preto na medicina'),
    ('ProducaoProjeto', 'titulo', 'Entrevista mensal'),
    ('ProducaoProjeto', 'titulo', 'Desafios do SUS'),
    ('ProducaoProjeto', 'titulo', 'Vacinação infantil'),
    ('ProducaoProjeto', 'titulo', 'Direitos do médico'),
    ('AgendaEvento', 'titulo', 'A trajetória do Preto na medicina'),
    ('AgendaEvento', 'titulo', 'Entrevista mensal'),
    ('AgendaEvento', 'titulo', 'Saúde mental no trabalho'),
    ('PendenciaCorp', 'titulo', 'Confirmar convidado EP054'),
    ('PendenciaCorp', 'titulo', 'Reservar estúdio 1 (15/09 14h)'),
    ('PendenciaCorp', 'titulo', 'Finalizar roteiro EP054'),
    ('PendenciaCorp', 'titulo', 'Arte da capa EP054'),
    ('PendenciaCorp', 'titulo', 'EP053 — exportar versão final'),
    ('PendenciaCorp', 'titulo', 'Coluna do presidente — setembro'),
    ('PendenciaCorp', 'titulo', 'Artigo: futuro da saúde'),
    ('PendenciaCorp', 'titulo', 'Newsletter semanal #35'),
    ('PendenciaCorp', 'titulo', 'Newsletter #34 — agendar envio'),
    ('PendenciaCorp', 'titulo', 'Campanha institucional Q3 — capa'),
    ('PendenciaCorp', 'titulo', 'Capa revista #12'),
    ('PendenciaCorp', 'titulo', 'Templates redes sociais'),
    ('PendenciaCorp', 'titulo', 'Ícones do set — exportar'),
    ('PendenciaCorp', 'titulo', 'Release — resultado trimestral'),
    ('PendenciaCorp', 'titulo', 'Posicionamento sobre projeto X'),
    ('PendenciaCorp', 'titulo', 'Nomeação novo diretor — agendar'),
    ('PendenciaCorp', 'titulo', 'Clipping diário — classificar'),
    ('PendenciaCorp', 'titulo', 'EP054 — edição final'),
    ('PendenciaCorp', 'titulo', 'EP052 — revisão'),
    ('PendenciaCorp', 'titulo', 'Vinhetas Out/2026'),
    ('PendenciaCorp', 'titulo', 'Teaser EP054'),
    ('PendenciaCorp', 'titulo', 'EP053 — final cut'),
    ('PendenciaCorp', 'titulo', 'Revista #12 — panorama trimestral'),
    ('PendenciaCorp', 'titulo', 'Revista #12 — entrevista diretoria'),
    ('PendenciaCorp', 'titulo', 'Revista #12 — caso de sucesso'),
    ('PendenciaCorp', 'titulo', 'Especial Saúde Mental — diagramação'),
    ('PendenciaCorp', 'titulo', 'Setembro Amarelo — campanha ativa'),
    ('PendenciaCorp', 'titulo', 'Programa de ideias — planejar'),
    ('PendenciaCorp', 'titulo', 'Onboarding novos colaboradores'),
    ('PendenciaCorp', 'titulo', 'Conexão Interna #34'),
    ('AprovacaoItem', 'titulo', 'Capa revista #12 — v2'),
    ('AprovacaoItem', 'titulo', 'EP053 — Sala de Prescrição (final cut)'),
    ('AprovacaoItem', 'titulo', 'Vinheta abertura v3'),
    ('AprovacaoItem', 'titulo', 'Release — nomeação novo diretor'),
    ('AprovacaoItem', 'titulo', 'Coluna do presidente — setembro'),
    ('AprovacaoItem', 'titulo', 'Revista Simers #12 — panorama trimestral'),
    ('AprovacaoItem', 'titulo', 'Campanha Setembro Amarelo — comunicado'),
    ('AprovacaoItem', 'titulo', 'Thumbnails EP054/EP055 — lote'),
    ('AprovacaoItem', 'titulo', 'EP050 — Corações e Mentes (revisão)'),
    ('Publicacao', 'titulo', 'A trajetória do Preto na medicina'),
    ('Publicacao', 'titulo', 'O maior desafio da carreira'),
    ('Publicacao', 'titulo', 'Construindo caminhos'),
    ('Release', 'titulo', 'Resultado trimestral 3T26'),
    ('Release', 'titulo', 'Posicionamento sobre projeto X'),
    ('Release', 'titulo', 'Nomeação novo diretor'),
    ('Release', 'titulo', 'Campanha de vacinação — apoio institucional'),
    ('Release', 'titulo', 'Balanço social 2026'),
    ('Clipping', 'titulo', 'Empresa anuncia crescimento'),
    ('Clipping', 'titulo', 'Especialista comenta projeto'),
    ('Clipping', 'titulo', 'Entrevista com diretor'),
    ('Clipping', 'titulo', 'Comentário sobre nomeação'),
    ('Clipping', 'titulo', 'Crítica ao posicionamento'),
    ('Jornalista', 'nome', 'João Lima'),
    ('Jornalista', 'nome', 'Maria Souza'),
    ('Jornalista', 'nome', 'Pedro Alves'),
    ('Jornalista', 'nome', 'Fernanda Ramos'),
    ('Jornalista', 'nome', 'Lucas Teixeira'),
    ('Mencao', 'titulo', 'Sindicato comenta novo projeto'),
    ('Mencao', 'titulo', 'Especialista questiona medida'),
    ('Mencao', 'titulo', 'Diretoria fala sobre concessões'),
    ('Mencao', 'titulo', 'Repercussão da campanha de vacinação'),
    ('Mencao', 'titulo', 'Crítica ao posicionamento institucional')
),
candidatos AS (
  SELECT r.id, r.tenant_id, r.entity_type, r.data ->> e.campo AS titulo,
         r.created_at, r.updated_at
  FROM tenant_records r
  JOIN exemplos e
    ON e.entity_type = r.entity_type
   AND r.data ->> e.campo = e.valor
),
lotes AS (
  SELECT tenant_id, entity_type, date_trunc('second', created_at) AS lote,
         count(*) AS exemplos_no_lote
  FROM candidatos
  GROUP BY 1, 2, 3
)
SELECT t.name AS empresa,
       c.entity_type,
       c.titulo,
       c.id AS registro_id,
       c.created_at,
       l.exemplos_no_lote >= 2 AS gravado_em_lote,
       c.updated_at > c.created_at + interval '1 second' AS editado_depois
FROM candidatos c
JOIN lotes l
  ON l.tenant_id = c.tenant_id
 AND l.entity_type = c.entity_type
 AND l.lote = date_trunc('second', c.created_at)
JOIN tenants t ON t.id = c.tenant_id
ORDER BY t.name, c.entity_type, c.created_at, c.titulo;
