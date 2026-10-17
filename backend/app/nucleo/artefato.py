"""O artefato de modelo em serviço: carga no lifespan, sha256 conferido, forma validada (§6.1).

Sai `dill` + `@st.cache_resource` + fallback silencioso reescrevendo `pipeline.steps`; entra
`joblib` + sha256 contra o manifest + exceção explícita (`ArtefatoIndisponivel` -> 503).
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

from app.dominio.features import COLUNAS
from app.dominio.regras import ORDEM_ALFABETICA
from app.nucleo.erros import ArtefatoIndisponivel

log = logging.getLogger(__name__)


def ler_manifest(artefatos_dir: Path) -> dict[str, Any]:
    """`artifacts/manifest.json`, a fonte de verdade de tudo que é publicado."""
    caminho = artefatos_dir / "manifest.json"
    if not caminho.exists():
        raise ArtefatoIndisponivel(f"manifest não encontrado em {artefatos_dir.name}/")
    return dict(json.loads(caminho.read_text(encoding="utf-8")))


class ArtefatoModelo:
    """Pipeline + classes + colunas + manifest, validados na carga."""

    def __init__(
        self,
        *,
        pipeline: Any,
        classes: list[str],
        colunas: list[str],
        manifest: dict[str, Any],
        caminho: Path,
        sha256_arquivo: str,
    ) -> None:
        """Guarda o que foi carregado; use `carregar()` para construir a partir do disco."""
        self.pipeline = pipeline
        self.classes: tuple[str, ...] = tuple(classes)
        self.colunas: list[str] = list(colunas)
        self.manifest = manifest
        self.caminho = caminho
        self.sha256_arquivo = sha256_arquivo

    @classmethod
    def carregar(
        cls, modelos_dir: Path, manifest: dict[str, Any], *, exigir_integridade: bool
    ) -> ArtefatoModelo:
        """Abre o `.pkl` com joblib, confere o sha256 do manifest e valida a forma do pipeline."""
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
        if not isinstance(objeto, dict) or {"pipeline", "classes", "colunas"} - set(objeto):
            raise ArtefatoIndisponivel("artefato sem as chaves pipeline/classes/colunas")
        pipeline = objeto["pipeline"]
        if not hasattr(pipeline, "predict_proba"):
            raise ArtefatoIndisponivel("pipeline sem predict_proba")
        colunas = list(objeto["colunas"])
        if colunas != list(COLUNAS):
            raise ArtefatoIndisponivel("colunas do artefato diferem das 16 features canônicas")
        nomes_in = list(getattr(pipeline, "feature_names_in_", []))
        if len(nomes_in) != len(COLUNAS) or nomes_in != colunas:
            raise ArtefatoIndisponivel(
                f"feature_names_in_ tem {len(nomes_in)} nomes; esperados 16 na ordem canônica"
            )
        if tuple(objeto["classes"]) != ORDEM_ALFABETICA:
            raise ArtefatoIndisponivel("classes do artefato fora da ordem alfabética do encoder")
        return cls(
            pipeline=pipeline,
            classes=list(objeto["classes"]),
            colunas=colunas,
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
    def metricas(self) -> dict[str, float]:
        """Métricas de teste do manifest — nunca escritas à mão."""
        return dict(self.manifest["metricas_teste"])

    @property
    def algoritmo(self) -> str:
        """Classe do estimador vencedor."""
        return str(self.manifest["algoritmo"])

    @property
    def n_features_modelo(self) -> int:
        """Largura que o classificador vê (43 + IMC = 44 na variante dos ADRs 0002/0003)."""
        return int(self.manifest["n_features_modelo"])

    # ---- cálculo ----
    def transformar(self, quadro: pd.DataFrame) -> np.ndarray:
        """Aplica os passos ANTES do sampler (imc, feature_engineering, columns)."""
        saida: Any = quadro
        for nome, passo in self.pipeline.steps:
            if nome in ("sampler", "model"):
                break
            saida = passo.transform(saida)
        return np.asarray(saida)

    def predict_proba(self, quadro: pd.DataFrame) -> np.ndarray:
        """Probabilidades na ORDEM ALFABÉTICA do encoder (a reordenação clínica é da API)."""
        return np.asarray(self.pipeline.predict_proba(quadro), dtype="float64")

    def importancias(self) -> list[dict[str, float | str]]:
        """Importâncias agregadas por feature de entrada (one-hot somado), em ordem decrescente."""
        colunas = self.pipeline.named_steps["columns"]
        modelo = self.pipeline.named_steps["model"]
        nomes = [str(n) for n in colunas.get_feature_names_out()]
        valores = np.asarray(getattr(modelo, "feature_importances_", []), dtype="float64")
        if valores.size != len(nomes):
            return []
        candidatas = [*self.colunas, "IMC"]
        agregado: dict[str, float] = {}
        for nome, v in zip(nomes, valores, strict=True):
            base = nome.split("__", 1)[1] if "__" in nome else nome
            feature = next((c for c in candidatas if base == c or base.startswith(c + "_")), base)
            agregado[feature] = agregado.get(feature, 0.0) + float(v)
        total = sum(agregado.values()) or 1.0
        itens = sorted(agregado.items(), key=lambda kv: -kv[1])
        return [
            {
                "feature": f,
                "importancia": round(v, 6),
                "importancia_pct": round(100.0 * v / total, 2),
            }
            for f, v in itens
        ]
