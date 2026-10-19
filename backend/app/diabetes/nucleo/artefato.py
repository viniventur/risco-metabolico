"""O artefato da vertente diabetes em serviço: carga no lifespan, sha256 conferido, forma validada.

O desenho do de obesidade (`app.nucleo.artefato`): joblib, sha256 contra o manifest da vertente
(artifacts/diabetes/manifest.json) e exceção explícita (`ArtefatoIndisponivel` -> 503), nunca um
fallback mudo. Muda o que se confere: as dez entradas, o alvo binário e o limiar de triagem, que
viaja dentro do artefato e tem de ser o mesmo do manifest — o limiar faz parte do modelo servido.
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


def ler_manifest(artefatos_dir: Path) -> dict[str, Any]:
    """`artifacts/diabetes/manifest.json`, a fonte de verdade de tudo que a vertente publica."""
    caminho = artefatos_dir / "manifest.json"
    if not caminho.exists():
        raise ArtefatoIndisponivel(
            f"manifest da vertente diabetes não encontrado em {artefatos_dir.name}/"
        )
    return dict(json.loads(caminho.read_text(encoding="utf-8")))


class ArtefatoDiabetes:
    """Pipeline + colunas + limiar + manifest, validados na carga."""

    def __init__(
        self,
        *,
        pipeline: Any,
        colunas: list[str],
        limiar: float,
        manifest: dict[str, Any],
        caminho: Path,
        sha256_arquivo: str,
    ) -> None:
        """Guarda o que foi carregado; use `carregar()` para construir a partir do disco."""
        self.pipeline = pipeline
        self.colunas: list[str] = list(colunas)
        self.limiar = float(limiar)
        self.manifest = manifest
        self.caminho = caminho
        self.sha256_arquivo = sha256_arquivo

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
        return cls(
            pipeline=pipeline,
            colunas=colunas,
            limiar=limiar,
            manifest=manifest,
            caminho=caminho,
            sha256_arquivo=sha,
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
