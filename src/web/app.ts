type Summary = {
  movimento: string; empresa: string; periodo_dominio: string; periodo_dfe: string;
  total_dfe: number; ok: number; faltantes: number; canceladas: number;
  diferencas: number; chaves_para_baixar: number; valor_faltante: string;
  valor_para_baixar: string; conformidade: number;
};

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector);
const setText = (id: string, value: string | number) => {
  const element = document.getElementById(id);
  if (element) element.textContent = String(value);
};

document.querySelectorAll<HTMLInputElement>('input[type="file"]').forEach((input) => {
  input.addEventListener("change", () => {
    const label = document.querySelector<HTMLElement>(`[data-for="${input.id}"]`);
    label && (label.textContent = input.files?.[0]?.name || "Selecionar arquivo");
    input.closest(".dropzone")?.classList.toggle("active", Boolean(input.files?.length));
  });
});

const form = $<HTMLFormElement>("#compare-form");
const errorBox = $<HTMLElement>("#error-box");
const uploadView = $<HTMLElement>("#upload-view");
const resultView = $<HTMLElement>("#result-view");

function showResult(summary: Summary, jobId: string) {
  setText("result-movement", `${summary.movimento} identificadas`);
  setText("result-company", summary.empresa);
  setText("result-periods", `Domínio: ${summary.periodo_dominio} · DFE: ${summary.periodo_dfe}`);
  setText("metric-total", summary.total_dfe);
  setText("metric-missing", summary.faltantes);
  setText("metric-missing-value", summary.valor_faltante);
  setText("metric-differences", summary.diferencas);
  setText("metric-ok", summary.ok);
  setText("metric-compliance", `${summary.conformidade}% de conformidade`);
  setText("download-detail", `${summary.chaves_para_baixar} chaves para baixar · ${summary.canceladas} notas canceladas`);
  setText("valid-value", summary.valor_para_baixar);
  const download = $<HTMLAnchorElement>("#download-link");
  if (download) download.href = `/api/download/${jobId}`;
  uploadView?.setAttribute("hidden", "");
  resultView?.removeAttribute("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  form.classList.add("loading");
  errorBox?.setAttribute("hidden", "");
  try {
    const response = await fetch("/api/compare", { method: "POST", body: new FormData(form) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Não foi possível concluir a conferência.");
    showResult(data.summary as Summary, data.jobId as string);
  } catch (error) {
    if (errorBox) {
      errorBox.textContent = error instanceof Error ? error.message : "Erro inesperado.";
      errorBox.removeAttribute("hidden");
    }
  } finally { form.classList.remove("loading"); }
});

$("#new-comparison")?.addEventListener("click", () => {
  resultView?.setAttribute("hidden", "");
  uploadView?.removeAttribute("hidden");
  form?.reset();
  document.querySelectorAll(".dropzone").forEach((zone) => zone.classList.remove("active"));
  document.querySelectorAll<HTMLElement>(".selected-file").forEach((label) => label.textContent = "Selecionar arquivo");
});
