"""Configuração do backend: as 22 variáveis do plano (§11.3) e a da vertente diabetes, tipadas.

Todo `os.environ` do projeto passa por aqui. A senha do banco (dentro de `BANCO_URL`) não é
lida em mais nenhum lugar, e nenhuma constante de módulo duplica um valor que vive aqui.
"""

from __future__ import annotations

from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/app/config.py -> parents[2] é a raiz do repositório. Nunca o diretório de trabalho,
# que muda entre um bloco de aceite e outro.
RAIZ_REPOSITORIO = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """Fonte de verdade única de toda variável de ambiente do backend."""

    model_config = SettingsConfigDict(
        env_file=RAIZ_REPOSITORIO / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # ---- identidade (ADR 0001) ----
    nome_app: str = "Triagem Metabólica"
    nome_repositorio: str = "risco-metabolico"

    # ---- caminhos (4.2, 11.3) ----
    modelos_dir: Path = RAIZ_REPOSITORIO / "models"
    artefatos_dir: Path = RAIZ_REPOSITORIO / "artifacts"
    dados_dir: Path = RAIZ_REPOSITORIO / "data" / "processado"
    sql_dir: Path = RAIZ_REPOSITORIO / "sql"

    # ---- API ----
    origens_cors: str = "http://localhost:5173"
    regex_previews: str | None = None
    exigir_integridade: bool = False
    versao_api: str = "1"
    limite_lote: int = 500

    # ---- banco (4.3) ----
    banco_url: str = "postgresql://postgres:postgres@localhost:55432/app_local"
    banco_habilitado: bool = False
    banco_pool_max: int = 3
    banco_timeout_conexao_s: float = 5.0
    banco_timeout_consulta_s: float = 3.0
    banco_timeout_acordar_s: float = 20.0

    # ---- log de predição (6.8) ----
    log_predicao_habilitado: bool = True
    log_predicao_fila_max: int = 500
    limite_payload_log_bytes: int = 16384

    # ---- limitação de taxa (6.8.3) ----
    limite_taxa_ativo: bool = False
    limite_taxa_predicao: str = "30/minute;300/hour"
    limite_taxa_lote: str = "3/minute;20/hour"
    sal_taxa: str | None = None  # sem default: obrigatória com LIMITE_TAXA_ATIVO=true

    # ---- deriva (6.8.5) ----
    n_minimo_deriva: int | None = None  # sem default: obrigatória com BANCO_HABILITADO=true
    # A da vertente diabetes, medida pelo método da ADR 0008. Sem default e NÃO obrigatória: sem
    # ela a API sobe como antes, e só /diabetes/monitoramento/deriva responde disponivel=false.
    n_minimo_deriva_diabetes: int | None = None

    @property
    def lista_origens_cors(self) -> list[str]:
        """`ORIGENS_CORS` é uma lista separada por vírgula, sem barra final (§11.4)."""
        return [o.strip().rstrip("/") for o in self.origens_cors.split(",") if o.strip()]

    @model_validator(mode="after")
    def _exigir_segredos_condicionais(self) -> Settings:
        """A API recusa subir sem as variáveis que o modo ativo exige, nomeando cada uma."""
        if self.limite_taxa_ativo and not self.sal_taxa:
            raise ValueError("SAL_TAXA é obrigatória quando LIMITE_TAXA_ATIVO=true (§6.8.2)")
        if self.banco_habilitado and self.n_minimo_deriva is None:
            raise ValueError("N_MINIMO_DERIVA é obrigatória quando BANCO_HABILITADO=true (§6.8.5)")
        return self


CONFIG = Settings()


def recarregar_config() -> Settings:
    """Reconstrói o `Settings` a partir do ambiente corrente, no MESMO objeto.

    Exigido pela fixture `cliente_banco_morto` (§10.9.2) e por nada mais: quem já fez
    `from app.config import CONFIG` continua apontando para o mesmo objeto e passa a ver os
    valores novos.
    """
    novo = Settings()
    CONFIG.__dict__.update(novo.__dict__)
    return CONFIG
