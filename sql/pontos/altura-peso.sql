-- @id:              pontos-altura-peso
-- @titulo:          Altura × peso, por faixa
-- @mede:            Cada registro da base como um ponto (altura em metros, peso em quilos), com
--                   o IMC derivado e a faixa de composição corporal. Não é um agregado: é uma
--                   projeção de registros, com contrato próprio (6.7.1).
-- @origem:          study/01_comparacao_de_modelos.ipynb, célula do gráfico de dispersão; <DispersaoAlturaPeso> (7.3)
-- @fonte:           dados.registros_triagem
-- @amostra_minima:  -
-- @divergencia:     -

-- O painel de referência plotava Sum(Altura) × Sum(Peso) por série; aqui são os registros crus.
SELECT
    altura::double precision AS altura,
    peso::double precision AS peso,
    peso::double precision / nullif(altura::double precision * altura::double precision, 0) AS imc,
    nivel_obesidade AS nivel
FROM dados.registros_triagem
ORDER BY linha_origem;
