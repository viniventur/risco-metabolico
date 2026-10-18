import { Compass, House } from "lucide-react";
import { Link } from "react-router-dom";

import { EstadoVazio } from "@/shared/estados/EstadoVazio";
import { PageHeader } from "@/shared/layout/PageHeader";
import { Button } from "@/shared/ui/button";

export function NaoEncontrada() {
  return (
    <>
      <PageHeader titulo="Página não encontrada" descricao="O endereço não corresponde a nenhuma tela." />
      <EstadoVazio
        icone={<Compass className="size-5" />}
        titulo="Nada por aqui"
        descricao="Confira o endereço ou volte ao início para escolher uma tela."
        acao={
          <Button asChild>
            <Link to="/">
              <House aria-hidden="true" />
              Voltar ao início
            </Link>
          </Button>
        }
      />
    </>
  );
}
