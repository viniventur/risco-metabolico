"""Registro de artefatos: `{versao: ArtefatoModelo}` em `app.state`, para servir `?versao=`."""

from __future__ import annotations

from pathlib import Path

from app.nucleo.artefato import ArtefatoModelo, ler_manifest
from app.nucleo.erros import NaoEncontrado


class RegistroArtefatos:
    """Dicionário de versões carregadas; `padrao` é a versão do manifest."""

    def __init__(self, padrao: ArtefatoModelo) -> None:
        """Começa com a versão do manifest como padrão."""
        self._por_versao: dict[str, ArtefatoModelo] = {padrao.versao: padrao}
        self.padrao = padrao

    @classmethod
    def carregar(
        cls, modelos_dir: Path, artefatos_dir: Path, *, exigir_integridade: bool
    ) -> RegistroArtefatos:
        """Lê o manifest e carrega o artefato que ele descreve."""
        manifest = ler_manifest(artefatos_dir)
        return cls(
            ArtefatoModelo.carregar(modelos_dir, manifest, exigir_integridade=exigir_integridade)
        )

    @property
    def versoes(self) -> list[str]:
        """Versões disponíveis lado a lado."""
        return sorted(self._por_versao)

    def obter(self, versao: str | None = None) -> ArtefatoModelo:
        """A versão pedida, ou a padrão; versão desconhecida é 404, não silêncio."""
        if versao is None:
            return self.padrao
        try:
            return self._por_versao[versao]
        except KeyError as erro:
            raise NaoEncontrado(
                f"versão de modelo {versao!r} não está carregada", [{"disponiveis": self.versoes}]
            ) from erro
