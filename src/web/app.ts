type DocumentRow = {
  id: number;
  status: string;
  chave: string;
  numero: string;
  serie: string;
  emissao: string;
  valor_dfe: string;
  valor_dominio: string;
  diferenca: string;
  similaridade: string;
  situacao: string;
  operacao: string;
  parte_dfe: string;
  parte_dominio: string;
  cancelada: boolean;
};

type Summary = {
  movimento: string;
  empresa: string;
  periodo_dominio: string;
  periodo_dfe: string;
  total_dfe: number;
  total_dominio: number;
  ok: number;
  faltantes: number;
  canceladas: number;
  diferencas: number;
  chaves_para_baixar: number;
  valor_faltante: string;
  valor_para_baixar: string;
  conformidade: number;
  gerado_em: string;
  documents: DocumentRow[];
};

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector);
const setText = (id: string, value: string | number) => {
  const element = document.getElementById(id);
  if (element) element.textContent = String(value);
};

let documents: DocumentRow[] = [];
let activeFilter = "all";

document.querySelectorAll<HTMLInputElement>('input[type="file"]').forEach((input) => {
  input.addEventListener("change", () => {
    const label = document.querySelector<HTMLElement>(`[data-for="${input.id}"]`);
    if (label) label.textContent = input.files?.[0]?.name || "Selecionar arquivo";
    input.closest(".dropzone")?.classList.toggle("active", Boolean(input.files?.length));
  });
});

function statusGroup(row: DocumentRow) {
  if (row.cancelada) return "cancelled";
  if (row.status === "OK") return "ok";
  if (row.status.includes("FALTANDO")) return "missing";
  return "difference";
}

function addCell(row: HTMLTableRowElement, text: string, className = "") {
  const cell = document.createElement("td");
  cell.textContent = text || "-";
  if (className) cell.className = className;
  row.appendChild(cell);
}

function renderRows() {
  const query = ($("#table-search") as HTMLInputElement | null)?.value.trim().toLocaleLowerCase("pt-BR") || "";
  const visible = documents.filter((row) => {
    const groupMatches = activeFilter === "all" || statusGroup(row) === activeFilter;
    const searchable = Object.values(row).join(" ").toLocaleLowerCase("pt-BR");
    return groupMatches && (!query || searchable.includes(query));
  });
  const tbody = $("#report-rows");
  if (!tbody) return;
  tbody.replaceChildren();
  visible.forEach((item) => {
    const row = document.createElement("tr");
    const statusCell = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = `status-badge ${statusGroup(item)}`;
    badge.textContent = item.cancelada ? "CANCELADA" : item.status;
    statusCell.appendChild(badge);
    row.appendChild(statusCell);
    addCell(row, item.numero, "number");
    addCell(row, item.serie);
    addCell(row, item.emissao);
    addCell(row, item.valor_dfe, "money");
    addCell(row, item.valor_dominio, "money");
    addCell(row, item.diferenca, "money");
    addCell(row, item.situacao);
    addCell(row, item.parte_dfe);
    addCell(row, item.parte_dominio);
    addCell(row, item.chave, "access-key");
    tbody.appendChild(row);
  });
  setText("visible-count", `${visible.length} ${visible.length === 1 ? "registro" : "registros"}`);
  $("#empty-state")?.toggleAttribute("hidden", visible.length > 0);
}

function showResult(summary: Summary, jobId: string) {
  documents = summary.documents;
  setText("result-movement", `${summary.movimento} · conferência concluída`);
  setText("result-company", summary.empresa);
  setText("result-periods", `Domínio: ${summary.periodo_dominio} | DFE: ${summary.periodo_dfe}`);
  setText("generated-at", summary.gerado_em);
  setText("metric-dominio", summary.total_dominio);
  setText("metric-total", summary.total_dfe);
  setText("metric-missing", summary.faltantes);
  setText("metric-missing-value", summary.valor_faltante);
  setText("metric-differences", summary.diferencas);
  setText("metric-ok", summary.ok);
  setText("metric-compliance", `${summary.conformidade}% de conformidade`);
  setText("valid-keys", summary.chaves_para_baixar);
  setText("valid-value", summary.valor_para_baixar);
  setText("cancelled-count", summary.canceladas);
  setText("count-all", summary.documents.length);
  setText("count-missing", summary.documents.filter((row) => statusGroup(row) === "missing").length);
  setText("count-difference", summary.documents.filter((row) => statusGroup(row) === "difference").length);
  setText("count-cancelled", summary.canceladas);
  setText("count-ok", summary.ok);
  const download = $("#download-link") as HTMLAnchorElement | null;
  if (download) download.href = `/api/download/${jobId}`;
  $("#upload-view")?.setAttribute("hidden", "");
  $("#result-view")?.removeAttribute("hidden");
  renderRows();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

$("#compare-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  form.classList.add("loading");
  $("#error-box")?.setAttribute("hidden", "");
  try {
    const response = await fetch("/api/compare", { method: "POST", body: new FormData(form) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Não foi possível concluir a conferência.");
    showResult(data.summary as Summary, data.jobId as string);
  } catch (error) {
    const box = $("#error-box");
    if (box) {
      box.textContent = error instanceof Error ? error.message : "Erro inesperado.";
      box.removeAttribute("hidden");
    }
  } finally {
    form.classList.remove("loading");
  }
});

document.querySelectorAll<HTMLButtonElement>("[data-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-filter]").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    activeFilter = button.dataset.filter || "all";
    renderRows();
  });
});

$("#table-search")?.addEventListener("input", renderRows);
$("#print-report")?.addEventListener("click", () => window.print());
$("#new-comparison")?.addEventListener("click", () => window.location.reload());
