"""A chave do limite de taxa é por VISITANTE, e não pelo nginx que está na frente da API."""

from __future__ import annotations

from starlette.requests import Request

from app.nucleo.limite_taxa import chave_origem, ip_de_quem_acessa

NGINX = "172.18.0.5"  # o par da conexão em produção: o nginx do app, na rede do Docker


def _pedido(par: str, real_ip: str | None = None) -> Request:
    cabecalhos = [(b"x-real-ip", real_ip.encode())] if real_ip else []
    escopo = {
        "type": "http",
        "method": "POST",
        "path": "/api/v1/predicoes",
        "headers": cabecalhos,
        "client": (par, 41000),
    }
    return Request(escopo)


def test_atras_do_nginx_vale_o_ip_que_ele_repassa() -> None:
    assert ip_de_quem_acessa(_pedido(NGINX, "203.0.113.9")) == "203.0.113.9"
    # A mesma chave de quem chegasse direto com aquele IP: o proxy não muda o pseudônimo.
    assert chave_origem(_pedido(NGINX, "203.0.113.9")) == chave_origem(_pedido("203.0.113.9"))


def test_dois_visitantes_atras_do_mesmo_nginx_tem_chaves_diferentes() -> None:
    a = chave_origem(_pedido(NGINX, "203.0.113.9"))
    b = chave_origem(_pedido(NGINX, "198.51.100.20"))
    assert a != b


def test_x_real_ip_vindo_de_fora_da_rede_interna_e_ignorado() -> None:
    """Sem isso, qualquer um trocaria de chave a cada pedido escrevendo o cabeçalho.

    O par é um IP público de verdade: os blocos de documentação (198.51.100.0/24, ...) contam
    como privados para o `ipaddress`.
    """
    forjado = _pedido("93.184.216.34", "203.0.113.9")
    assert ip_de_quem_acessa(forjado) == "93.184.216.34"
    assert chave_origem(forjado) == chave_origem(_pedido("93.184.216.34"))


def test_sem_cabecalho_vale_o_par_e_a_chave_nao_contem_o_ip() -> None:
    assert ip_de_quem_acessa(_pedido(NGINX)) == NGINX
    chave = chave_origem(_pedido(NGINX, "203.0.113.9"))
    assert "203.0.113.9" not in chave
    assert len(chave) == 16
