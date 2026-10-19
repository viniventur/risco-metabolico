"""Rotas da vertente diabetes, sob `/diabetes`: o roteador que `app.main` registra na API."""

from __future__ import annotations

from fastapi import APIRouter

from app.diabetes.api import metadados, modelo, predicoes

roteador = APIRouter(prefix="/diabetes")
roteador.include_router(modelo.roteador)
roteador.include_router(metadados.roteador)
roteador.include_router(predicoes.roteador)
