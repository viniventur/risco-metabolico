import { Link } from "react-router-dom";

export function NaoEncontrada() {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-bold">Página não encontrada</h1>
      <p className="text-texto-fraco">
        O endereço não existe.{" "}
        <Link to="/" className="text-primaria underline">
          Voltar ao início
        </Link>
      </p>
    </div>
  );
}
