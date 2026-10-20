"""O artefato da vertente diabetes em serviço: carga no lifespan, sha256 conferido, forma validada.

O desenho do de obesidade (`app.nucleo.artefato`): joblib, sha256 contra o manifest da vertente
(artifacts/diabetes/manifest.json) e exceção explícita (`ArtefatoIndisponivel` -> 503), nunca um
fallback mudo. Muda o que se confere: as dez entradas, o alvo binário e os limiares de triagem, que
viajam dentro do artefato e têm de ser os do manifest — os limiares fazem parte do modelo servido.

Desde a versão 1.1.0 o artefato traz a tabela `limiares_por_idade`: o limiar de cada grupo de
idade, que é o que classifica; o `limiar` único fica como referência. Um artefato sem a tabela (o
1.0.0) aplica o limiar único a todas as idades, como sempre aplicou.
"""

from __future__ import annotations

import hashlib
import json
import logging
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd

from app.diabetes.dominio.features import ENTRADAS
from app.nucleo.erros import ArtefatoIndisponivel, NaoEncontrado

log = logging.getLogger(__name__)

# As 13 faixas etárias do BRFSS: a tabela de limiares por idade tem de cobrir cada uma, uma vez.
FAIXAS_ETARIAS: list[int] = list(range(1, 14))


def _limiar_por_faixa(tabela: Any, manifest: dict[str, Any]) -> dict[int, tuple[float, str]]:
    """Valida a tabela do artefato e devolve `{faixa: (limiar, grupo)}`; defeito é 503."""
    if not isinstance(tabela, list) or not tabela:
        raise ArtefatoIndisponivel("limiares_por_idade do artefato não é uma lista de grupos")
    por_faixa: dict[int, tuple[float, str]] = {}
    for linha in tabela:
        if not isinstance(linha, dict) or {"grupo", "faixas_etarias", "valor"} - set(linha):
            raise ArtefatoIndisponivel("grupo de limiares_por_idade sem grupo/faixas_etarias/valor")
        valor = float(linha["valor"])
        if not 0.0 <= valor <= 1.0:
            raise ArtefatoIndisponivel(f"limiar do grupo {linha['grupo']!r} fora de [0, 1]")
        for faixa in linha["faixas_etarias"]:
            if faixa in por_faixa:
                raise ArtefatoIndisponivel(f"faixa etária {faixa} em mais de um grupo de idade")
            por_faixa[int(faixa)] = (valor, str(linha["grupo"]))
    if sorted(por_faixa) != FAIXAS_ETARIAS:
        raise ArtefatoIndisponivel("limiares_por_idade não cobre as 13 faixas etárias")
    no_manifest = [
        {k: g.get(k) for k in ("grupo", "faixas_etarias", "valor")}
        for g in (manifest.get("limiares_por_idade") or {}).get("grupos") or []
    ]
    if no_manifest != [{k: g[k] for k in ("grupo", "faixas_etarias", "valor")} for g in tabela]:
        raise ArtefatoIndisponivel("os limiares por idade do artefato não são os do manifest")
    return por_faixa


def ler_manifest(artefatos_dir: Path) -> dict[str, Any]:
    """`artifacts/diabetes/manifest.json`, a fonte de verdade de tudo que a vertente publica."""
    caminho = artefatos_dir / "manifest.json"
    if not caminho.exists():
        raise ArtefatoIndisponivel(
            f"manifest da vertente diabetes não encontrado em {artefatos_dir.name}/"
        )
    return dict(json.loads(caminho.read_text(encoding="utf-8")))


class ArtefatoDiabetes:
    """Pipeline + colunas + limiares + manifest, validados na carga."""

    def __init__(
        self,
        *,
        pipeline: Any,
        colunas: list[str],
        limiar: float,
        manifest: dict[str, Any],
        caminho: Path,
        sha256_arquivo: str,
        limiar_por_faixa: dict[int, tuple[float, str]] | None = None,
    ) -> None:
        """Guarda o que foi carregado; use `carregar()` para construir a partir do disco."""
        self.pipeline = pipeline
        self.colunas: list[str] = list(colunas)
        self.limiar = float(limiar)
        self.manifest = manifest
        self.caminho = caminho
        self.sha256_arquivo = sha256_arquivo
        self.limiar_por_faixa = limiar_por_faixa

    @classmethod
    def carregar(
        cls, modelos_dir: Path, manifest: dict[str, Any], *, exigir_integridade: bool
    ) -> ArtefatoDiabetes:
        """Abre o `.pkl` com joblib, confere o sha256 do manifest e valida a forma do pipeline."""
        if manifest.get("vertente") != "diabetes":
            raise ArtefatoIndisponivel("o manifest não é o da vertente diabetes")
        if not manifest.get("arquivo"):
            raise ArtefatoIndisponivel("manifest sem `arquivo`: nenhum modelo foi treinado")
        caminho = modelos_dir / str(manifest["arquivo"])
        if not caminho.exists():
            raise ArtefatoIndisponivel(
                f"artefato {manifest['arquivo']} não encontrado em MODELOS_DIR"
            )
        sha = hashlib.sha256(caminho.read_bytes()).hexdigest()
        if sha != manifest.get("sha256"):
            mensagem = f"sha256 de {caminho.name} não bate com o manifest"
            if exigir_integridade:
                raise ArtefatoIndisponivel(mensagem)  # 503 em produção
            log.warning("%s (EXIGIR_INTEGRIDADE=false: seguindo em desenvolvimento)", mensagem)
        objeto = joblib.load(caminho)
        if not isinstance(objeto, dict) or {"pipeline", "colunas", "limiar"} - set(objeto):
            raise ArtefatoIndisponivel("artefato sem as chaves pipeline/colunas/limiar")
        pipeline = objeto["pipeline"]
        if not hasattr(pipeline, "predict_proba"):
            raise ArtefatoIndisponivel("pipeline sem predict_proba")
        colunas = list(objeto["colunas"])
        nomes_in = [str(n) for n in getattr(pipeline, "feature_names_in_", [])]
        if colunas != ENTRADAS or nomes_in != ENTRADAS:
            raise ArtefatoIndisponivel(
                "colunas do artefato diferem das dez entradas da vertente, na ordem canônica"
            )
        classes = [int(c) for c in getattr(pipeline, "classes_", [])]
        if classes != [0, 1]:
            raise ArtefatoIndisponivel(f"classes do artefato {classes}; esperadas [0, 1]")
        limiar = float(objeto["limiar"])
        if limiar != float((manifest.get("limiar") or {}).get("valor", np.nan)):
            raise ArtefatoIndisponivel("o limiar do artefato não é o do manifest")
        tabela = objeto.get("limiares_por_idade")
        if tabela is None and manifest.get("limiares_por_idade"):
            log.warning(
                "artefato %s sem a tabela limiares_por_idade: o limiar único vale para todas "
                "as idades",
                caminho.name,
            )
        return cls(
            pipeline=pipeline,
            colunas=colunas,
            limiar=limiar,
            manifest=manifest,
            caminho=caminho,
            sha256_arquivo=sha,
            limiar_por_faixa=None if tabela is None else _limiar_por_faixa(tabela, manifest),
        )

    # ---- metadados ----
    @property
    def versao(self) -> str:
        """Versão do modelo (semver), do manifest."""
        return str(self.manifest["versao"])

    @property
    def versao_dados(self) -> str:
        """Os 12 primeiros caracteres do sha256 do snapshot congelado."""
        return str(self.manifest["dataset"]["versao_dados"])

    @property
    def treinado_em(self) -> str:
        """Carimbo UTC do treino."""
        return str(self.manifest["treinado_em"])

    @property
    def algoritmo(self) -> str:
        """Classe do estimador."""
        return str(self.manifest["algoritmo"])

    @property
    def n_features_modelo(self) -> int:
        """Largura que o classificador vê, do manifest."""
        return int(self.manifest["n_features_modelo"])

    # ---- cálculo ----
    def limiar_de(self, faixa_etaria: int) -> tuple[float, str | None]:
        """O limiar que classifica uma pessoa desta faixa etária e o grupo de idade dele.

        Sem a tabela (um artefato de limiar único), o limiar único e nenhum grupo.
        """
        if self.limiar_por_faixa is None:
            return self.limiar, None
        return self.limiar_por_faixa[int(faixa_etaria)]

    def transformar(self, quadro: pd.DataFrame) -> np.ndarray:
        """Aplica `imc` e `colunas` e devolve a matriz que o modelo vê."""
        return np.asarray(self.pipeline[:-1].transform(quadro), dtype="float64")

    def probabilidades(self, quadro: pd.DataFrame) -> np.ndarray:
        """Probabilidade da classe positiva (diagnóstico de diabetes), uma por linha."""
        return np.asarray(self.pipeline.predict_proba(quadro)[:, 1], dtype="float64")


class RegistroDiabetes:
    """`{versao: ArtefatoDiabetes}` em `app.state`, para `?versao=`; o padrão é o do manifest."""

    def __init__(self, padrao: ArtefatoDiabetes) -> None:
        """Começa com a versão do manifest como padrão."""
        self._por_versao: dict[str, ArtefatoDiabetes] = {padrao.versao: padrao}
        self.padrao = padrao

    @classmethod
    def carregar(
        cls, modelos_dir: Path, artefatos_dir: Path, *, exigir_integridade: bool
    ) -> RegistroDiabetes:
        """Lê o manifest da vertente e carrega o artefato que ele descreve."""
        manifest = ler_manifest(artefatos_dir)
        return cls(
            ArtefatoDiabetes.carregar(modelos_dir, manifest, exigir_integridade=exigir_integridade)
        )

    @property
    def versoes(self) -> list[str]:
        """Versões disponíveis lado a lado."""
        return sorted(self._por_versao)

    def obter(self, versao: str | None = None) -> ArtefatoDiabetes:
        """A versão pedida, ou a padrão; versão desconhecida é 404, não silêncio."""
        if versao is None:
            return self.padrao
        try:
            return self._por_versao[versao]
        except KeyError as erro:
            raise NaoEncontrado(
                f"versão de modelo de diabetes {versao!r} não está carregada",
                [{"disponiveis": self.versoes}],
            ) from erro
