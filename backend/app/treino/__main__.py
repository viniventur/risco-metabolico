"""CLI de treino: `python -m app.treino <congelar|snapshot|treinar|agregados|verificar> [opções]`.

Gramática fechada (§6.6): cinco subcomandos e NENHUM caminho obrigatório — todo default é
relativo à raiz do repositório, resolvida em código, nunca pelo diretório de trabalho.

- `congelar`: snapshot E agregados no MESMO processo e na MESMA transação REPEATABLE READ.
- `snapshot` / `agregados`: os dois passos isolados, para depuração (conferência de §6.7.4).
- `treinar --versao X.Y.Z`: treina os candidatos sobre o snapshot congelado, escolhe, serializa
  com joblib, escreve o manifest, as métricas, as saídas de ouro e o perfil de distribuição.
- `verificar`: retreina sobre o MESMO snapshot e compara as predições de ouro e as métricas com
  o manifest. Não escreve nada. É o que roda no CI.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import platform
import sys
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import joblib
import numpy as np

from app.config import CONFIG, RAIZ_REPOSITORIO
from app.dominio.features import COLUNAS
from app.dominio.predicao import montar_quadro
from app.dominio.regras import ORDEM_ALFABETICA
from app.treino import agregar, avaliacao, dados, distribuicao
from app.treino import pipeline as pipe

ARTEFATOS = RAIZ_REPOSITORIO / "artifacts"
MANIFESTO_PADRAO = ARTEFATOS / "manifest.json"
METRICAS_PADRAO = ARTEFATOS / "metricas"
AGREGADOS_PADRAO = ARTEFATOS / "agregados"
DISTRIBUICAO_PADRAO = ARTEFATOS / "distribuicao_treino.json"
MODELOS_PADRAO = RAIZ_REPOSITORIO / "models"
PROCESSADO_PADRAO = RAIZ_REPOSITORIO / "data" / "processado"
PARQUET_PAINEL_PADRAO = PROCESSADO_PADRAO / "base_painel.parquet"
SQL_AGREGADOS_PADRAO = RAIZ_REPOSITORIO / "sql" / "agregados"
DADOS_OURO = RAIZ_REPOSITORIO / "backend" / "tests" / "dados_ouro"
NOME_PROJETO = "risco-metabolico"
TOLERANCIA_METRICAS = 1e-6
# Reprodutibilidade ENTRE plataformas, medida em F17 (2026-10-18, ADR 0004): o mesmo snapshot, os
# mesmos pacotes e hiperparâmetros produzem, em Windows e em Linux, modelos com métricas iguais a
# 1e-15 e as mesmas classes nos 24 casos de ouro, mas probabilidades diferentes (máximo 0,0214
# em 168, mediana 4,8e-5) — o treino do XGBoost não é bit a bit reprodutível entre sistemas.
# Na MESMA plataforma do treino o critério continua o sha256 exato; noutra, vale esta tolerância.
TOLERANCIA_PROBAS_ENTRE_PLATAFORMAS = 0.03
CHAVES_METRICAS = ("acuracia", "f1_macro", "recall_risco")


def _relativo(caminho: Path) -> str:
    """Caminho relativo à raiz do repositório; fora dela (pastas temporárias de teste), absoluto."""
    caminho = caminho.resolve()
    try:
        return caminho.relative_to(RAIZ_REPOSITORIO).as_posix()
    except ValueError:
        return caminho.as_posix()


def manifest_vazio() -> dict[str, Any]:
    """O esqueleto de §6.5: todo campo medido fica `null` até o CLI preenchê-lo."""
    return {
        "nome": NOME_PROJETO,
        "versao": None,
        "arquivo": None,
        "sha256": None,
        "sha256_predicoes_ouro": None,
        "treinado_em": None,
        "algoritmo": None,
        "random_state": pipe.RANDOM_STATE,
        "binning_ativo": None,
        "imc_como_feature": None,
        "n_features_entrada": len(COLUNAS),
        "n_features_modelo": None,
        "classes": list(ORDEM_ALFABETICA),
        "dataset": {
            "tabela_origem": dados.TABELA_ORIGEM,
            "insumo_de_semeadura": "data/bruto/obesity.csv",
            "proveniencia": "data/bruto/FONTE.md",
            "snapshot": None,
            "versao_dados": None,
            "sha256_snapshot": None,
            "sha256_conteudo": None,
            "sha256_carga": None,
            "pyarrow": None,
            "linhas": None,
            "colunas": None,
        },
        "split": {
            "test_size": pipe.TEST_SIZE,
            "stratify": True,
            "linhas_treino": None,
            "linhas_teste": None,
        },
        "hiperparametros": None,
        "smote": dict(pipe.SMOTE_PARAMS),
        "metricas_teste": {"acuracia": None, "f1_macro": None, "recall_risco": None},
        "overfitting": None,
        "categoria_rara_no_treino": None,
        "ambiente": None,
        "dados_ouro": None,
        "notebook_origem": "study/01_comparacao_de_modelos.ipynb",
    }


def ler_manifest(caminho: Path) -> dict[str, Any]:
    """O manifest existente, ou o esqueleto vazio na primeira execução."""
    if caminho.exists():
        return json.loads(caminho.read_text(encoding="utf-8"))
    return manifest_vazio()


def escrever_manifest(caminho: Path, manifest: dict[str, Any]) -> None:
    """Grava o manifest em UTF-8, indentado, sem NaN."""
    caminho.parent.mkdir(parents=True, exist_ok=True)
    caminho.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8"
    )


def _sha_probas(probas: np.ndarray) -> str:
    """O critério de reprodutibilidade: sha256 das probabilidades arredondadas a 6 casas."""
    return hashlib.sha256(np.round(np.asarray(probas, dtype="float64"), 6).tobytes()).hexdigest()


def _ambiente() -> dict[str, str]:
    import imblearn
    import lightgbm
    import numpy
    import pandas
    import pyarrow
    import sklearn
    import xgboost

    return {
        "python": platform.python_version(),
        "sistema": platform.system(),
        "scikit-learn": sklearn.__version__,
        "xgboost": xgboost.__version__,
        "lightgbm": lightgbm.__version__,
        "imbalanced-learn": imblearn.__version__,
        "numpy": numpy.__version__,
        "pandas": pandas.__version__,
        "pyarrow": pyarrow.__version__,
        "joblib": joblib.__version__,
    }


def _abrir_transacao_congelada(dsn: str) -> Any:
    """A transação de `congelar`: REPEATABLE READ e as configurações de sessão de §10.9.1."""
    import psycopg

    con = psycopg.connect(dsn)
    con.isolation_level = psycopg.IsolationLevel.REPEATABLE_READ
    con.execute("SET SESSION timezone = 'UTC'")  # divergência 13
    con.execute("SET SESSION extra_float_digits = 3")
    con.execute("SET SESSION max_parallel_workers_per_gather = 0")  # divergência 9
    return con


def _registrar_snapshot_no_manifest(manifesto: Path, info: dados.InfoSnapshot) -> dict[str, Any]:
    import pyarrow

    manifest = ler_manifest(manifesto)
    manifest["dataset"].update(
        {
            "snapshot": _relativo(info.caminho),
            "versao_dados": info.versao_dados,
            "sha256_snapshot": info.sha256_arquivo,
            "sha256_conteudo": info.sha256_conteudo,
            "sha256_carga": info.sha256_carga,
            "pyarrow": pyarrow.__version__,
            "linhas": info.linhas,
            "colunas": info.colunas,
        }
    )
    escrever_manifest(manifesto, manifest)
    return manifest


def _resolver_snapshot(manifest: dict[str, Any], override: Path | None) -> Path:
    """Nunca glob: o caminho vem de `dataset.snapshot` do manifest, e a falha diz qual esperava."""
    if override is not None:
        return override
    relativo = manifest.get("dataset", {}).get("snapshot")
    if not relativo:
        raise SystemExit(
            "manifest sem dataset.snapshot: rode `python -m app.treino congelar` antes"
        )
    caminho = Path(relativo)
    if not caminho.is_absolute():  # pastas temporárias de teste gravam caminho absoluto
        caminho = RAIZ_REPOSITORIO / relativo
    if not caminho.exists():
        raise SystemExit(
            f"snapshot esperado em {relativo} não existe: rode `python -m app.treino congelar`"
        )
    return caminho


def _congelar(args: argparse.Namespace, *, com_agregados: bool) -> dados.InfoSnapshot:
    con = _abrir_transacao_congelada(args.banco_url or CONFIG.banco_url)
    try:
        info = dados.gerar_snapshot(con, args.processado)
        print(
            f"snapshot: {info.caminho.name} ({info.linhas} x {info.colunas}) "
            f"versao_dados={info.versao_dados}"
        )
        if com_agregados:
            quadro = dados.carregar_snapshot(info.caminho, sha256_esperado=info.sha256_arquivo)
            escritos = agregar.materializar_todos(
                con,
                versao_dados=info.versao_dados,
                snapshot=quadro,
                sql_agregados=args.sql,
                sql_pontos=args.sql.parent / "pontos",
                destino=args.agregados,
                parquet=args.parquet,
            )
            for e in escritos:
                print(f"escrito: {_relativo(e)}")
        con.commit()
    finally:
        con.close()
    _registrar_snapshot_no_manifest(args.manifesto, info)
    return info


def cmd_congelar(args: argparse.Namespace) -> int:
    """Snapshot + agregados na MESMA transação REPEATABLE READ (§6.6)."""
    _congelar(args, com_agregados=True)
    return 0


def cmd_snapshot(args: argparse.Namespace) -> int:
    """Só o snapshot (depuração)."""
    _congelar(args, com_agregados=False)
    return 0


def cmd_agregados(args: argparse.Namespace) -> int:
    """Só a materialização, fora da transação de `congelar`: confere a carga antes."""
    import psycopg

    manifest = ler_manifest(args.manifesto)
    caminho = _resolver_snapshot(manifest, None)
    quadro = dados.carregar_snapshot(
        caminho, sha256_esperado=manifest["dataset"]["sha256_snapshot"]
    )
    with psycopg.connect(args.banco_url or CONFIG.banco_url) as con:
        con.execute("SET SESSION timezone = 'UTC'")
        con.execute("SET SESSION extra_float_digits = 3")
        con.execute("SET SESSION max_parallel_workers_per_gather = 0")
        escritos = agregar.materializar_todos(
            con,
            versao_dados=manifest["dataset"]["versao_dados"],
            snapshot=quadro,
            sql_agregados=args.sql,
            sql_pontos=args.sql.parent / "pontos",
            destino=args.agregados,
            parquet=args.parquet,
            conferir=True,
        )
    for e in escritos:
        print(f"escrito: {_relativo(e)}")
    return 0


def _preparar(manifest: dict[str, Any], override: Path | None) -> tuple[Any, ...]:
    caminho = _resolver_snapshot(manifest, override)
    quadro = dados.carregar_snapshot(
        caminho, sha256_esperado=manifest["dataset"].get("sha256_snapshot")
    )
    X, y = dados.separar_alvo(quadro)
    label_encoder, y_enc = pipe.codificar_alvo(y)
    X_train, X_test, y_train, y_test = pipe.dividir(X, y_enc)
    return quadro, X, label_encoder, X_train, X_test, y_train, y_test


def _casos_de_ouro(pasta: Path) -> list[dict[str, Any]]:
    return list(json.loads((pasta / "entradas.json").read_text(encoding="utf-8")))


def cmd_treinar(args: argparse.Namespace) -> int:
    """Treina os 3 candidatos, escolhe, serializa o vencedor e escreve manifest e métricas."""
    manifest = ler_manifest(args.manifesto)
    if args.snapshot is None and not manifest["dataset"].get("snapshot"):
        print("snapshot ausente: congelando antes do treino")
        _congelar(args, com_agregados=True)
        manifest = ler_manifest(args.manifesto)
    quadro, X, label_encoder, X_train, X_test, y_train, y_test = _preparar(manifest, args.snapshot)
    classes = list(label_encoder.classes_)
    categoria_rara_no_treino = set(X_train["Consumo_Alcool"]) == set(X["Consumo_Alcool"])
    print(
        f"snapshot {manifest['dataset']['versao_dados']}: "
        f"treino {len(X_train)} / teste {len(X_test)} | "
        f"binning={args.binning} imc={args.imc} | 'Sempre' no treino: {categoria_rara_no_treino}"
    )

    resultados: list[dict[str, Any]] = []
    for nome, fabrica in pipe.CANDIDATOS.items():
        inicio = time.perf_counter()
        p = pipe.montar_pipeline(fabrica(), binning=args.binning, imc=args.imc)
        pipe.treinar(p, X_train, y_train)
        segundos = time.perf_counter() - inicio
        metricas = avaliacao.avaliar(p, X_test, y_test, classes)
        overfitting = avaliacao.checar_overfitting(p, X_train, y_train, X_test, y_test)
        resultados.append(
            {
                "nome": nome,
                "binning": args.binning,
                "imc": args.imc,
                "pipeline": p,
                "metricas": metricas,
                "overfitting": overfitting,
                "largura": pipe.largura_do_modelo(p),
                "segundos": round(segundos, 2),
            }
        )
        print(
            f"  {nome:<22} acc={metricas['acuracia']:.4f} f1={metricas['f1_macro']:.4f} "
            f"recall_risco={metricas['recall_risco']:.4f} gap={overfitting['diff_acuracia']:+.4f} "
            f"largura={resultados[-1]['largura']} ({segundos:.1f}s)"
        )

    vencedor = avaliacao.escolher(resultados)
    p = vencedor["pipeline"]
    print(f"vencedor: {vencedor['nome']}")

    # Dados de ouro: as predições que `verificar` e os testes de F7 comparam.
    casos = _casos_de_ouro(args.dados_ouro)
    probas = p.predict_proba(montar_quadro(COLUNAS, casos))
    saidas = [
        {
            "classe_prevista": str(classes[int(np.argmax(pr))]),
            "probabilidades": {
                str(c): round(float(v), 6) for c, v in zip(classes, pr, strict=True)
            },
        }
        for pr in probas
    ]
    (args.dados_ouro / "saidas_esperadas.json").write_text(
        json.dumps(saidas, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    arquivo = f"modelo-{args.versao}.pkl"
    manifest.update(
        {
            "versao": args.versao,
            "arquivo": arquivo,
            "sha256": None,  # integridade de transporte: preenchido depois do dump
            "sha256_predicoes_ouro": _sha_probas(probas),
            "treinado_em": datetime.now(UTC).isoformat(timespec="seconds"),
            "algoritmo": vencedor["nome"],
            "random_state": pipe.RANDOM_STATE,
            "binning_ativo": bool(args.binning),
            "imc_como_feature": bool(args.imc),
            "n_features_entrada": len(COLUNAS),
            "n_features_modelo": int(vencedor["largura"]),
            "classes": classes,
            "split": {
                "test_size": pipe.TEST_SIZE,
                "stratify": True,
                "linhas_treino": int(len(X_train)),
                "linhas_teste": int(len(X_test)),
            },
            "hiperparametros": dict(pipe.HIPERPARAMETROS[vencedor["nome"]]),
            "smote": dict(pipe.SMOTE_PARAMS),
            "metricas_teste": vencedor["metricas"],
            "overfitting": vencedor["overfitting"],
            "categoria_rara_no_treino": bool(categoria_rara_no_treino),
            "ambiente": _ambiente(),
            "dados_ouro": {"entradas": "backend/tests/dados_ouro/entradas.json", "n": len(casos)},
        }
    )
    # O manifest embutido torna o artefato autodescritivo fora do repositório; ele não pode
    # conter o hash do próprio arquivo (circular), então viaja com `sha256: null`.
    objeto = {
        "pipeline": p,
        "classes": classes,
        "colunas": list(COLUNAS),
        "manifest": dict(manifest),
    }
    args.saida.mkdir(parents=True, exist_ok=True)
    destino = args.saida / arquivo
    joblib.dump(objeto, destino, compress=3)
    manifest["sha256"] = dados.sha256_de(destino)
    escrever_manifest(args.manifesto, manifest)

    args.metricas.mkdir(parents=True, exist_ok=True)
    comparacao = [{k: v for k, v in r.items() if k != "pipeline"} for r in resultados]
    (args.metricas / "comparacao-candidatos.json").write_text(
        json.dumps(
            {
                "versao": args.versao,
                "criterio": "recall_risco, acuracia, menor gap",
                "candidatos": comparacao,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    (args.metricas / "relatorio-por-classe.json").write_text(
        json.dumps(
            avaliacao.relatorio_por_classe(p, X_test, y_test, classes), ensure_ascii=False, indent=2
        )
        + "\n",
        encoding="utf-8",
    )
    (args.metricas / "matriz-confusao.json").write_text(
        json.dumps(
            avaliacao.matriz_confusao(p, X_test, y_test, classes), ensure_ascii=False, indent=2
        )
        + "\n",
        encoding="utf-8",
    )
    distribuicao.escrever(
        args.distribuicao,
        distribuicao.perfil(
            quadro,
            versao_modelo=args.versao,
            versao_dados=manifest["dataset"]["versao_dados"],
            sha256_snapshot=manifest["dataset"]["sha256_snapshot"],
        ),
    )
    if args.anotar_banco:
        _anotar_versao_no_snapshot(
            args.banco_url or CONFIG.banco_url, args.versao, manifest["dataset"]["versao_dados"]
        )
    print(avaliacao.comparar(resultados).to_string(index=False))
    print(
        f"artefato: {_relativo(destino)} sha256={manifest['sha256'][:12]}… "
        f"largura={manifest['n_features_modelo']}"
    )
    print(
        f"manifest: {_relativo(args.manifesto)} | metricas: {_relativo(args.metricas)} | "
        f"perfil: {_relativo(args.distribuicao)}"
    )
    return 0


def _anotar_versao_no_snapshot(dsn: str, versao: str, versao_dados: str) -> None:
    """`operacao.snapshot_treino.versao_modelo` é preenchido pelo treino; sem banco, só avisa."""
    try:
        import psycopg

        with psycopg.connect(dsn, connect_timeout=5) as con:
            con.execute(
                "UPDATE operacao.snapshot_treino SET versao_modelo = %s WHERE versao_dados = %s",
                (versao, versao_dados),
            )
            con.commit()
    except Exception as erro:  # noqa: BLE001 — o treino não depende do banco
        print(
            f"aviso: versao_modelo não anotada em operacao.snapshot_treino ({type(erro).__name__})"
        )


def cmd_verificar(args: argparse.Namespace) -> int:
    """Retreina sobre o MESMO snapshot e compara predições de ouro e métricas; não escreve."""
    manifest = ler_manifest(args.manifesto)
    faltantes = [k for k in ("versao", "algoritmo", "sha256_predicoes_ouro") if not manifest.get(k)]
    if faltantes:
        print(f"FALHA: manifest sem {faltantes}: rode `python -m app.treino treinar` antes")
        return 1
    quadro, X, label_encoder, X_train, X_test, y_train, y_test = _preparar(manifest, args.snapshot)
    classes = list(label_encoder.classes_)
    fabrica = pipe.CANDIDATOS[manifest["algoritmo"]]
    p = pipe.montar_pipeline(
        fabrica(), binning=manifest["binning_ativo"], imc=manifest["imc_como_feature"]
    )
    pipe.treinar(p, X_train, y_train)
    probas = p.predict_proba(montar_quadro(COLUNAS, _casos_de_ouro(args.dados_ouro)))
    metricas = avaliacao.avaliar(p, X_test, y_test, classes)

    falhas: list[str] = []
    sha = _sha_probas(probas)
    sistema_do_treino = str((manifest.get("ambiente") or {}).get("sistema") or "")
    mesma_plataforma = platform.system() == sistema_do_treino
    if mesma_plataforma:
        criterio = "sha256 exato das predições de ouro (mesma plataforma do treino)"
        if sha != manifest["sha256_predicoes_ouro"]:
            falhas.append(
                f"sha256 das predições de ouro: manifest "
                f"{manifest['sha256_predicoes_ouro'][:12]}… ≠ retreino {sha[:12]}…"
            )
    else:
        criterio = (
            f"classes iguais e probabilidades a {TOLERANCIA_PROBAS_ENTRE_PLATAFORMAS} "
            f"({sistema_do_treino or 'plataforma desconhecida'} → {platform.system()})"
        )
        falhas += _comparar_com_saidas_esperadas(
            probas, classes, args.dados_ouro / "saidas_esperadas.json"
        )
    for chave in CHAVES_METRICAS:
        esperado, real = float(manifest["metricas_teste"][chave]), float(metricas[chave])
        if abs(esperado - real) > TOLERANCIA_METRICAS:
            falhas.append(f"{chave}: manifest {esperado:.6f} ≠ retreino {real:.6f}")
    largura = pipe.largura_do_modelo(p)
    if largura != manifest["n_features_modelo"]:
        falhas.append(
            f"n_features_modelo: manifest {manifest['n_features_modelo']} ≠ retreino {largura}"
        )
    if falhas:
        print("FALHA: o modelo servido NÃO é o que o pipeline produz sobre estes dados")
        for f in falhas:
            print(f"  {f}")
        return 1
    print(
        f"OK: {manifest['algoritmo']} v{manifest['versao']} "
        f"sobre versao_dados={manifest['dataset']['versao_dados']} "
        f"reproduz as predições de ouro e as métricas (tolerância {TOLERANCIA_METRICAS}); "
        f"critério: {criterio}"
    )
    return 0


def _comparar_com_saidas_esperadas(
    probas: np.ndarray, classes: list[str], saidas_esperadas: Path
) -> list[str]:
    """Critério entre plataformas: mesma classe e probabilidade dentro da tolerância medida."""
    if not saidas_esperadas.exists():
        return [f"{saidas_esperadas.name} ausente ao lado de entradas.json: rode `treinar` antes"]
    esperadas = json.loads(saidas_esperadas.read_text(encoding="utf-8"))
    if len(esperadas) != len(probas):
        return [f"saidas_esperadas.json tem {len(esperadas)} casos; entradas.json, {len(probas)}"]
    falhas: list[str] = []
    desvio_max = 0.0
    for i, (pr, esperado) in enumerate(zip(probas, esperadas, strict=True)):
        classe = classes[int(np.argmax(pr))]
        if classe != esperado["classe_prevista"]:
            falhas.append(f"caso {i}: classe {classe!r} ≠ esperada {esperado['classe_prevista']!r}")
        for c, v in zip(classes, pr, strict=True):
            desvio_max = max(desvio_max, abs(float(v) - float(esperado["probabilidades"][c])))
    if desvio_max > TOLERANCIA_PROBAS_ENTRE_PLATAFORMAS:
        falhas.append(
            f"probabilidades de ouro: desvio máximo {desvio_max:.4f} acima da tolerância "
            f"{TOLERANCIA_PROBAS_ENTRE_PLATAFORMAS} entre plataformas"
        )
    else:
        print(f"probabilidades de ouro: desvio máximo {desvio_max:.4f} entre plataformas")
    return falhas


def construir_parser() -> argparse.ArgumentParser:
    """A gramática do CLI."""
    parser = argparse.ArgumentParser(
        prog="python -m app.treino",
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    sub = parser.add_subparsers(dest="comando", required=True)

    def comuns(sp: argparse.ArgumentParser) -> None:
        sp.add_argument("--manifesto", type=Path, default=MANIFESTO_PADRAO)
        sp.add_argument(
            "--banco-url", default=None, help="DSN; padrão BANCO_URL (CONFIG.banco_url)"
        )

    def de_agregacao(sp: argparse.ArgumentParser) -> None:
        sp.add_argument(
            "--sql",
            type=Path,
            default=SQL_AGREGADOS_PADRAO,
            help="sql/agregados (mais sql/pontos ao lado)",
        )
        sp.add_argument("--agregados", type=Path, default=AGREGADOS_PADRAO)
        sp.add_argument("--parquet", type=Path, default=PARQUET_PAINEL_PADRAO)

    for nome, fn, doc in (
        ("congelar", cmd_congelar, "snapshot + agregados na mesma transação REPEATABLE READ"),
        ("snapshot", cmd_snapshot, "só o snapshot (depuração)"),
        ("agregados", cmd_agregados, "só a materialização, conferindo a carga antes"),
    ):
        sp = sub.add_parser(nome, help=doc)
        comuns(sp)
        sp.add_argument("--processado", type=Path, default=PROCESSADO_PADRAO)
        de_agregacao(sp)
        sp.set_defaults(fn=fn)

    sp = sub.add_parser("treinar", help="treina, escolhe, serializa e escreve o manifest")
    comuns(sp)
    sp.add_argument("--versao", required=True, help="ex.: 2.0.0")
    sp.add_argument(
        "--snapshot", type=Path, default=None, help="padrão: dataset.snapshot do manifest"
    )
    sp.add_argument("--processado", type=Path, default=PROCESSADO_PADRAO)
    de_agregacao(sp)
    sp.add_argument("--saida", type=Path, default=MODELOS_PADRAO)
    sp.add_argument("--metricas", type=Path, default=METRICAS_PADRAO)
    sp.add_argument("--distribuicao", type=Path, default=DISTRIBUICAO_PADRAO)
    sp.add_argument(
        "--binning", dest="binning", action="store_true", default=False, help="ADR 0002: desligado"
    )
    sp.add_argument("--sem-binning", dest="binning", action="store_false")
    sp.add_argument("--imc", dest="imc", action="store_true", default=True, help="ADR 0003: ligado")
    sp.add_argument("--sem-imc", dest="imc", action="store_false")
    sp.add_argument("--dados-ouro", type=Path, default=DADOS_OURO, help="pasta com entradas.json")
    sp.add_argument(
        "--sem-anotar-banco",
        dest="anotar_banco",
        action="store_false",
        default=True,
        help="não grava versao_modelo em operacao.snapshot_treino (testes)",
    )
    sp.set_defaults(fn=cmd_treinar)

    sp = sub.add_parser("verificar", help="retreina e compara com o manifest; não escreve nada")
    comuns(sp)
    sp.add_argument("--snapshot", type=Path, default=None)
    sp.add_argument("--dados-ouro", type=Path, default=DADOS_OURO, help="pasta com entradas.json")
    sp.set_defaults(fn=cmd_verificar)
    return parser


def main(argv: list[str] | None = None) -> int:
    """Ponto de entrada."""
    args = construir_parser().parse_args(argv)
    return int(args.fn(args))


if __name__ == "__main__":
    sys.exit(main())
