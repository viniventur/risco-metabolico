## Resumo

Esta política explica, em linguagem simples, quais dados a **demonstração da Triagem Metabólica**, publicada em **{{SITE}}**, usa, para quê e quais são os seus direitos, de acordo com a **Lei Geral de Proteção de Dados (LGPD, Lei nº 13.709/2018)** e as orientações da **Autoridade Nacional de Proteção de Dados (ANPD)**.

- **É um projeto de portfólio, com duas bases públicas.** A da triagem de obesidade é majoritariamente sintética: nenhum registro corresponde a uma pessoa real. A da triagem de diabetes tem respostas reais e anonimizadas de uma pesquisa de saúde dos Estados Unidos (BRFSS 2015, do CDC): nenhum registro identifica uma pessoa.
- **Não pedimos cadastro nem login, e não usamos cookies.**
- **Não guardamos registro de acesso com o seu IP.** O servidor web não registra quem entra; o IP só é usado na hora, para limitar excesso de pedidos, e não é gravado.
- **O que você responde nos simuladores é registrado de forma anônima**, sem IP, sem navegador e sem nome, para acompanhar se cada modelo continua adequado. Fica guardado por até **{{RETENCAO_LOG}}**.
- **O nome do relatório não é guardado.** Ele só aparece no relatório que você baixa ou imprime.
- **A aplicação não carrega nada de terceiros**: sem fontes externas, sem estatística de visitas e sem propaganda. Só a página da documentação da API busca arquivos fora daqui (item 5).
- **Seus direitos:** confirmar, acessar, corrigir, apagar e outros. Fale com a gente em **{{RESPONSAVEL_EMAIL}}**.

## 1. Quem é o responsável pelos seus dados

O responsável (o **controlador**, na linguagem da LGPD, art. 5º, VI) é quem decide como e por que os dados são usados:

|                          |                           |
| ------------------------ | ------------------------- |
| **Nome ou razão social** | {{RESPONSAVEL_NOME}}      |
| **CNPJ ou CPF**          | {{RESPONSAVEL_DOCUMENTO}} |
| **Endereço**             | {{RESPONSAVEL_ENDERECO}}  |
| **E-mail**               | {{RESPONSAVEL_EMAIL}}     |
| **Site**                 | {{SITE}}                  |

## 2. Canal de privacidade e Encarregado

Para qualquer assunto sobre os seus dados, fale com o nosso canal de privacidade. Ele é a ponte entre você, o responsável e a ANPD (LGPD, art. 41):

- **Encarregado:** {{ENCARREGADO}}
- **Contato:** {{RESPONSAVEL_EMAIL}}

## 3. Quais dados usamos, para quê e com qual base legal

Usamos só o necessário para cada finalidade (princípio da necessidade, LGPD art. 6º, III):

| Dado | Para quê | Base legal | Por quanto tempo |
| --- | --- | --- | --- |
| **Endereço IP**, só na memória do servidor: o servidor web conta os pedidos por IP e a API usa um pseudônimo do IP que muda todo dia (um código calculado com uma chave secreta, que não permite voltar ao IP) | Limitar pedidos em excesso, como robôs que repetem chamadas | Legítimo interesse em manter o serviço no ar (art. 7º, IX) | Pouco tempo, só na memória: a contagem do servidor web se recicla sozinha, e o pseudônimo da API dura no máximo {{JANELA_LIMITE}}. **Nunca é gravado** e some quando o servidor reinicia |
| **As 16 respostas do simulador de obesidade** (gênero, idade, altura, peso e hábitos), o resultado e a hora | Calcular o resultado que você pediu e, depois, acompanhar se as respostas recebidas se afastam dos dados de treino (a tela Monitoramento) | Execução do que você pediu (art. 7º, V) e legítimo interesse em manter o modelo adequado (art. 7º, IX) | O registro é anônimo e fica guardado por até {{RETENCAO_LOG}}, com um limite de tamanho |
| **As 10 respostas do simulador de diabetes** (faixa etária, sexo, IMC, se já ouviu de um profissional de saúde que tem pressão alta ou colesterol alto, fumo, atividade física, fruta, verdura e escolaridade), o resultado e a hora. O peso e a altura da calculadora de IMC ficam no seu aparelho: só o IMC é enviado | Calcular o resultado que você pediu e, depois, acompanhar se as respostas recebidas se afastam dos dados de treino (a tela Monitoramento da diabetes) | Execução do que você pediu (art. 7º, V) e legítimo interesse em manter o modelo adequado (art. 7º, IX) | O registro é anônimo e fica guardado por até {{RETENCAO_LOG}}, com um limite de tamanho |
| **Nome do relatório** (opcional) | Aparecer no relatório que você baixa ou imprime | Execução do que você pediu (art. 7º, V) | **Não é guardado.** Vai junto com as respostas, volta no relatório e é descartado |
| **Registros técnicos do servidor**: o endereço pedido, a resposta e o tempo de resposta. Na API, o IP que aparece é o do nosso próprio servidor web, não o seu. Uma falha do servidor web pode registrar o IP do pedido que falhou | Segurança e correção de falhas | Legítimo interesse em manter o serviço seguro e funcionando (art. 7º, IX) | Rodízio automático de {{RODIZIO_LOGS}}: os mais antigos são sobrescritos |
| **Tema e menu**, guardados só no seu aparelho: o tema claro ou escuro, se você escolher no botão, e o menu lateral recolhido ou aberto | Abrir o sistema do jeito que você deixou | Legítimo interesse, porque cumpre uma escolha sua (art. 7º, IX) | Até você limpar os dados do navegador. Nunca são enviados para nós |

**Sobre o registro dos simuladores:** ele guarda as respostas (as 16 da obesidade ou as 10 da diabetes) e o resultado, e nada que identifique você: nem IP, nem navegador, nem nome, nem conta (não há conta). Só marcamos qual simulador foi usado e se o pedido veio da tela ou de uma chamada direta à API. Sem nenhum identificador, um registro não tem como ser ligado a você, e por isso o tratamos como dado anonimizado (LGPD, art. 12). Isso vale também para as respostas de saúde do simulador de diabetes, como pressão alta e colesterol alto. Se preferir, use valores fictícios: os simuladores funcionam com qualquer valor dentro das faixas do formulário.

**O que não fazemos:** não pedimos cadastro, não usamos cookies, não montamos perfil sobre você, não usamos estatística de visitas nem propaganda, e não guardamos dados sensíveis ligados a você (saúde, religião, biometria e outros do art. 5º, II).

**Sobre os dados que aparecem nos painéis e nas consultas:** os da obesidade vêm de um conjunto público de pesquisa, com licença CC BY 4.0, em que a maior parte dos registros foi gerada sinteticamente pelos próprios autores. Nenhum registro corresponde a uma pessoa real, e nenhuma leitura epidemiológica das distribuições é válida. Os da diabetes vêm de uma pesquisa pública de saúde dos Estados Unidos (BRFSS 2015, do CDC), numa cópia publicada com licença CC0: são respostas reais, anonimizadas na origem, sem nome, data, endereço ou qualquer identificador, e nenhum registro identifica uma pessoa.

## 4. Como os dados chegam até nós

- **Automaticamente**, quando o seu navegador pede uma página ou um dado ao servidor (o IP, usado na hora, e os registros técnicos).
- **Por você**, ao calcular uma triagem num dos simuladores (as 16 respostas da obesidade ou as 10 da diabetes) ou ao baixar o relatório (o nome, se você preencher).
- **No seu próprio aparelho**, no armazenamento local do navegador, ficam o tema e o menu. Eles não são enviados para nós (veja o item 12).

## 5. Com quem compartilhamos

| Quem | O que recebe | Para quê | Onde |
| --- | --- | --- | --- |
| **Hospedagem do servidor**: {{HOSPEDAGEM}} | Os dados que ficam no servidor: o registro anônimo dos simuladores e os registros técnicos | Manter o sistema no ar | Estados Unidos (Boston) |
| **jsDelivr** (rede de distribuição de arquivos) | Seu endereço IP e o tipo de navegador, **só se você abrir a documentação da API** (`/docs`), que busca lá os arquivos da página | Mostrar a documentação interativa da API | Vários países, conforme a [política de privacidade do jsDelivr](https://www.jsdelivr.com/terms/privacy-policy-jsdelivr-net) |
| **Site do FastAPI** | Seu endereço IP e o tipo de navegador, **também só na documentação da API**, que busca lá o ícone da aba | Mostrar o ícone da página de documentação | Conforme o serviço que hospeda o site |

Fora da documentação da API, **o seu navegador só fala com o nosso servidor**: até a fonte das letras é servida por ele, e não há fontes, mapas, estatística de visitas ou propaganda de terceiros. Os links para outros sites (o código-fonte no GitHub e o site do autor) só levam você até eles se você clicar; a partir daí, valem as políticas desses serviços.

**Não vendemos nem alugamos dados.** Também podemos ter de entregar dados por ordem judicial ou a pedido de autoridade competente, nos casos previstos em lei (Marco Civil da Internet, Lei nº 12.965/2014, arts. 10 e 22).

## 6. Transferência para outros países

**O nosso servidor fica nos Estados Unidos**, em Boston, na empresa de hospedagem Hostinger. Por isso, o registro anônimo dos simuladores e os registros técnicos são guardados e tratados lá. Essa transferência é necessária para prestar o serviço que você usa (LGPD, art. 33, IX, combinado com o art. 7º, V). Mesmo fora do Brasil, esses dados seguem protegidos pela LGPD (art. 3º) e pelas medidas do item 8.

Ao abrir a documentação da API, o seu endereço IP também chega aos servidores do **jsDelivr** e do site do **FastAPI**, que podem ficar fora do Brasil. Essa transferência acontece porque é necessária para mostrar a página que você pediu (LGPD, art. 33, IX, combinado com o art. 7º, V).

## 7. Por quanto tempo guardamos

- **Registro anônimo dos simuladores:** até {{RETENCAO_LOG}}. Uma rotina automática apaga os mais antigos toda semana, e também mantém o total abaixo de um limite.
- **Registros técnicos do servidor:** rodízio automático de {{RODIZIO_LOGS}}; os mais antigos são sobrescritos.
- **IP e pseudônimo do IP para o limite de pedidos:** só na memória do servidor, por pouco tempo (o pseudônimo, no máximo {{JANELA_LIMITE}}).
- **Nome do relatório:** não é guardado.
- **O que fica no seu aparelho:** até você limpar os dados do navegador.

## 8. Como protegemos os dados

- Não pedimos cadastro e não guardamos o seu IP nem o seu nome: o que não é coletado não pode vazar.
- O registro dos simuladores aceita só uma lista fechada de campos: as respostas de cada simulador (16 na obesidade, 10 na diabetes) e o resultado. Qualquer outro dado do pedido é descartado antes de gravar.
- A conexão com o sistema é protegida (HTTPS), e a página só carrega arquivos do próprio site.
- Só o servidor web fica exposto na internet. A API e o banco de dados ficam em rede interna, e a API entra no banco com uma permissão mínima: pode ler, mas só consegue gravar no registro dos simuladores, e apenas acrescentando linhas.
- Nenhuma senha ou chave do banco existe no código que chega ao seu navegador; isso é conferido a cada publicação.

Se acontecer um incidente de segurança que possa causar risco ou dano relevante, avisaremos a **ANPD** e as pessoas afetadas nos prazos da Resolução CD/ANPD nº 15/2024 (LGPD, art. 48).

## 9. Seus direitos

A LGPD (art. 18) garante a você, de graça e a qualquer momento:

1. **Confirmar** se tratamos dados seus.
2. **Acessar** os dados.
3. **Corrigir** dados incompletos, errados ou desatualizados.
4. Pedir **anonimização, bloqueio ou eliminação** de dados desnecessários, excessivos ou tratados fora da lei.
5. **Portabilidade** dos dados para outro fornecedor.
6. **Eliminar** os dados tratados com o seu consentimento.
7. Saber **com quem** compartilhamos os dados.
8. Saber que **pode não consentir** e o que acontece nesse caso.
9. **Revogar o consentimento**.

### Como exercer

- **Tema e menu:** limpe os dados do navegador.
- **Demais pedidos:** escreva para **{{RESPONSAVEL_EMAIL}}**. Como o registro dos simuladores não guarda nada que identifique você, não temos como achar um registro seu entre os outros; se você souber as respostas exatas e a data e a hora aproximadas, podemos tentar localizá-lo e apagá-lo.

**Prazo de resposta:** confirmação simplificada em até 15 dias; resposta completa em até 30 dias (LGPD, art. 19, com os prazos em dobro do agente de pequeno porte, Resolução CD/ANPD nº 2/2022).

Se achar que não atendemos bem o seu pedido, você pode reclamar à ANPD: [atendimento ao titular de dados da ANPD](https://www.gov.br/anpd/pt-br/canais_atendimento/cidadao-titular-de-dados).

## 10. Crianças e adolescentes

O sistema é aberto a todas as idades e não pede dados pessoais. Não coletamos dados de crianças ou adolescentes de forma intencional. O simulador de obesidade aceita idades a partir de 14 anos, a faixa da base de treino, e o de diabetes começa na faixa de 18 a 24 anos, a da pesquisa; quem tem menos de 18 anos deve usar o de obesidade com um responsável.

## 11. Decisões automáticas

Os simuladores calculam, de forma automática, uma estimativa a partir das respostas que **você** digita: é a função da ferramenta. Essa estimativa é de **triagem**, não substitui avaliação clínica, não fica ligada a você e não é usada para tomar nenhuma decisão a seu respeito (LGPD, art. 20). Não criamos perfis.

## 12. Cookies e armazenamento no aparelho

**Não usamos cookies.** Guardamos no seu aparelho só o que cumpre uma escolha sua. Por isso, não pedimos o seu aceite num aviso de cookies.

| Nome | Onde fica | Para quê | Por quanto tempo |
| --- | --- | --- | --- |
| `tema` | Armazenamento local do navegador | Lembrar o tema claro ou escuro, se você escolher no botão | Até você limpar os dados do navegador |
| `menu-lateral` | Armazenamento local do navegador | Lembrar se o menu lateral fica recolhido | Até você limpar os dados do navegador |

## 13. Mudanças nesta política

Quando mudarmos algo importante, avisaremos no próprio sistema, com destaque e, sempre que possível, com 30 dias de antecedência. A versão em vigor fica sempre neste endereço.

## 14. Histórico de versões

| Versão | Data | O que mudou |
| --- | --- | --- |
| {{VERSAO}} | {{DATA_ATUALIZACAO}} | Triagem de diabetes: as 10 respostas do simulador de diabetes no registro anônimo e a base real e anonimizada do BRFSS 2015 |
| 1.0 | 18 de outubro de 2026 | Primeira versão |

---

_Política elaborada conforme a LGPD (Lei nº 13.709/2018), o Marco Civil da Internet (Lei nº 12.965/2014) e as orientações da ANPD. Em caso de dúvida de interpretação, prevalecem a lei e as orientações oficiais da [ANPD](https://www.gov.br/anpd/pt-br)._
