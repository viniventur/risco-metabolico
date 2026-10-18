// Tema antes da hidratação, para não piscar: data-theme no <html> a partir da escolha salva ou do
// prefers-color-scheme; localStorage em try/catch (modo privado, dados bloqueados).
// Arquivo do próprio site, e não <script> em linha: a CSP de produção é script-src 'self'
// (frontend/seguranca.conf), e um script em linha seria bloqueado (docs/redesenho-front.md, 1.9).
(function () {
  var tema = null;
  try {
    tema = localStorage.getItem("tema");
  } catch (e) {
    tema = null;
  }
  if (tema !== "light" && tema !== "dark") {
    tema = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  document.documentElement.setAttribute("data-theme", tema);
})();
