const STORAGE_KEY = "cadastrosPessoasV1";

const fields = [
  { key: "nome", label: "Nome" },
  { key: "telefone", label: "Telefone" },
  { key: "cidade", label: "Cidade" },
  { key: "bairro", label: "Bairro" },
  { key: "areaAtuacao", label: "Área de atuação" },
  { key: "estimativaVoto", label: "Estimativa de voto" },
  { key: "demanda", label: "Demanda" },
  { key: "estrutura", label: "Estrutura" },
];

const state = {
  cadastros: loadCadastros(),
  editandoId: null,
  fotoBase64: "",
};

const cadastroForm = document.getElementById("cadastroForm");
const fotoBox = document.getElementById("fotoBox");
const fotoInput = document.getElementById("fotoInput");
const fotoPreview = document.getElementById("fotoPreview");
const fotoPlaceholder = document.getElementById("fotoPlaceholder");
const listaCadastros = document.getElementById("listaCadastros");
const totalCadastros = document.getElementById("totalCadastros");
const sectionFormulario = document.getElementById("sectionFormulario");
const sectionGaleria = document.getElementById("sectionGaleria");
const btnNovoCadastro = document.getElementById("btnNovoCadastro");
const btnGaleria = document.getElementById("btnGaleria");
const btnLimpar = document.getElementById("btnLimpar");
const btnSalvar = document.getElementById("btnSalvar");
const modalVisualizacao = document.getElementById("modalVisualizacao");
const modalFicha = document.getElementById("modalFicha");
const btnFecharModal = document.getElementById("btnFecharModal");
const toast = document.getElementById("toast");
let toastTimeoutId = null;

fotoInput.addEventListener("change", handleFotoChange);
cadastroForm.addEventListener("submit", handleSalvarCadastro);
btnNovoCadastro.addEventListener("click", () => alternarAba("formulario"));
btnGaleria.addEventListener("click", () => alternarAba("galeria"));
btnLimpar.addEventListener("click", limparFormulario);
btnFecharModal.addEventListener("click", () => modalVisualizacao.close());
modalVisualizacao.addEventListener("click", (event) => {
  if (event.target === modalVisualizacao) modalVisualizacao.close();
});

renderGaleria();
setSaveButtonLabel(false);
initIcons();

function loadCadastros() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value ? JSON.parse(value) : [];
  } catch (error) {
    console.error("Erro ao carregar cadastros:", error);
    return [];
  }
}

function saveCadastros() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.cadastros));
}

function handleFotoChange(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  if (!/\.(jpg|jpeg|png)$/i.test(file.name) && !["image/jpeg", "image/png"].includes(file.type)) {
    alert("Formato inválido. Selecione uma imagem JPG, JPEG ou PNG.");
    fotoInput.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const base64 = String(reader.result || "");
    state.fotoBase64 = base64;
    atualizarPreviewFoto(base64);
    showToast("Foto carregada com sucesso.");
  };
  reader.readAsDataURL(file);
}

function atualizarPreviewFoto(src) {
  if (src) {
    fotoPreview.src = src;
    fotoPreview.style.display = "block";
    fotoPlaceholder.style.display = "none";
    fotoBox.classList.add("has-image");
    return;
  }

  fotoPreview.src = "";
  fotoPreview.style.display = "none";
  fotoPlaceholder.style.display = "inline";
  fotoBox.classList.remove("has-image");
}

function handleSalvarCadastro(event) {
  event.preventDefault();
  const payload = obterDadosFormulario();
  if (!payload.nome || !payload.telefone) {
    alert("Preencha pelo menos Nome e Telefone.");
    return;
  }

  const cadastro = {
    ...payload,
    foto: state.fotoBase64,
    id: state.editandoId || crypto.randomUUID(),
    atualizadoEm: new Date().toISOString(),
  };

  if (state.editandoId) {
    state.cadastros = state.cadastros.map((item) => (item.id === cadastro.id ? cadastro : item));
    showToast("Cadastro atualizado.");
  } else {
    state.cadastros.unshift(cadastro);
    showToast("Cadastro salvo com sucesso.");
  }

  saveCadastros();
  renderGaleria();
  limparFormulario();
  alternarAba("galeria");
}

function obterDadosFormulario() {
  return fields.reduce((acc, item) => {
    const input = document.getElementById(item.key);
    acc[item.key] = input.value.trim();
    return acc;
  }, {});
}

function preencherFormulario(cadastro) {
  fields.forEach((item) => {
    const input = document.getElementById(item.key);
    input.value = cadastro[item.key] || "";
  });
  state.fotoBase64 = cadastro.foto || "";
  atualizarPreviewFoto(state.fotoBase64);
}

function limparFormulario() {
  cadastroForm.reset();
  state.fotoBase64 = "";
  state.editandoId = null;
  setSaveButtonLabel(false);
  fotoInput.value = "";
  atualizarPreviewFoto("");
  initIcons();
}

function alternarAba(aba) {
  const mostrarGaleria = aba === "galeria";
  sectionGaleria.classList.toggle("hidden", !mostrarGaleria);
  sectionFormulario.classList.toggle("hidden", mostrarGaleria);
  btnGaleria.classList.toggle("active", mostrarGaleria);
  btnNovoCadastro.classList.toggle("active", !mostrarGaleria);
  initIcons();
}

function renderGaleria() {
  atualizarContadorCadastros();

  if (!state.cadastros.length) {
    listaCadastros.innerHTML = `
      <article class="card">
        <div class="card-no-photo">
          <div class="foto-placeholder-content">
            <i data-lucide="folder-open"></i>
            <strong>Nenhum cadastro ainda</strong>
            <small>Crie o primeiro cadastro para visualizar aqui.</small>
          </div>
        </div>
      </article>
    `;
    initIcons();
    return;
  }

  listaCadastros.innerHTML = "";
  state.cadastros.forEach((cadastro) => {
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `
      ${
        cadastro.foto
          ? `<img class="card-photo" src="${cadastro.foto}" alt="Foto de ${escapeHtml(cadastro.nome)}" />`
          : `<div class="card-no-photo">Sem foto</div>`
      }
      <div class="card-body">
        ${fields
          .map(
            (field) =>
              `<div class="card-row"><strong>${field.label}:</strong> ${escapeHtml(cadastro[field.key] || "-")}</div>`
          )
          .join("")}
      </div>
      <div class="card-actions">
        <button class="btn btn-light" data-action="view" data-id="${cadastro.id}" type="button">
          <i data-lucide="eye"></i>
          <span>Visualizar</span>
        </button>
        <button class="btn btn-light" data-action="edit" data-id="${cadastro.id}" type="button">
          <i data-lucide="pencil"></i>
          <span>Editar</span>
        </button>
        <button class="btn btn-outline" data-action="pdf" data-id="${cadastro.id}" type="button">
          <i data-lucide="file-down"></i>
          <span>PDF</span>
        </button>
        <button class="btn btn-danger" data-action="delete" data-id="${cadastro.id}" type="button">
          <i data-lucide="trash-2"></i>
          <span>Excluir</span>
        </button>
      </div>
    `;
    listaCadastros.appendChild(card);
  });

  initIcons();
}

listaCadastros.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  const id = button.dataset.id;
  const action = button.dataset.action;
  const cadastro = state.cadastros.find((item) => item.id === id);
  if (!cadastro) return;

  if (action === "view") {
    abrirModalVisualizacao(cadastro);
    return;
  }

  if (action === "edit") {
    state.editandoId = cadastro.id;
    setSaveButtonLabel(true);
    preencherFormulario(cadastro);
    alternarAba("formulario");
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  if (action === "delete") {
    const confirmed = confirm(`Deseja excluir o cadastro de ${cadastro.nome}?`);
    if (!confirmed) return;
    state.cadastros = state.cadastros.filter((item) => item.id !== cadastro.id);
    saveCadastros();
    renderGaleria();
    showToast("Cadastro excluído.");
    return;
  }

  if (action === "pdf") {
    await gerarPdf(cadastro);
    showToast("PDF gerado com sucesso.");
  }
});

function abrirModalVisualizacao(cadastro) {
  const fotoHtml = cadastro.foto
    ? `<img src="${cadastro.foto}" alt="Foto de ${escapeHtml(cadastro.nome)}" />`
    : `<div class="ficha-line">Sem foto</div>`;

  modalFicha.innerHTML = `
    <div class="ficha-view">
      ${fotoHtml}
      ${fields
        .map((field) => `<div class="ficha-line"><strong>${field.label}:</strong> ${escapeHtml(cadastro[field.key] || "-")}</div>`)
        .join("")}
    </div>
  `;
  modalVisualizacao.showModal();
  initIcons();
}

async function gerarPdf(cadastro) {
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const margin = 12;
    const contentWidth = 186;
    let y = margin;

    doc.setFillColor(51, 92, 255);
    doc.roundedRect(margin, y, contentWidth, 22, 3, 3, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Ficha de Cadastro", margin + 4, y + 9);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(
      `Atualizado em ${new Date(cadastro.atualizadoEm || Date.now()).toLocaleString("pt-BR")}`,
      margin + 4,
      y + 16
    );
    y += 28;

    doc.setDrawColor(220, 230, 250);
    doc.setTextColor(29, 40, 66);
    const photoWidth = 46;
    const photoHeight = 58;
    if (cadastro.foto) {
      const imageType = cadastro.foto.includes("image/png") ? "PNG" : "JPEG";
      doc.addImage(cadastro.foto, imageType, margin, y, photoWidth, photoHeight);
    } else {
      doc.roundedRect(margin, y, photoWidth, photoHeight, 2, 2);
      doc.setFontSize(11);
      doc.text("Sem foto", margin + 12, y + 30);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(cadastro.nome || "-", margin + 52, y + 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Telefone: ${cadastro.telefone || "-"}`, margin + 52, y + 19);
    doc.text(`Cidade: ${cadastro.cidade || "-"}`, margin + 52, y + 27);
    doc.text(`Bairro: ${cadastro.bairro || "-"}`, margin + 52, y + 35);
    doc.text(`Area de atuacao: ${cadastro.areaAtuacao || "-"}`, margin + 52, y + 43);
    doc.text(`Estimativa de voto: ${cadastro.estimativaVoto || "-"}`, margin + 52, y + 51);

    y += 66;

    fields.forEach((field) => {
      const label = field.label;
      const text = cadastro[field.key] || "-";
      const wrapped = doc.splitTextToSize(text, 170);
      const blockHeight = Math.max(16, wrapped.length * 5 + 9);

      if (y + blockHeight > 286) {
        doc.addPage();
        y = margin;
      }

      doc.setFillColor(248, 251, 255);
      doc.roundedRect(margin, y, contentWidth, blockHeight, 2, 2, "F");
      doc.setDrawColor(215, 225, 245);
      doc.roundedRect(margin, y, contentWidth, blockHeight, 2, 2);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(label, margin + 4, y + 6);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(wrapped, margin + 4, y + 12);
      y += blockHeight + 3;
    });

    doc.save(`cadastro-${(cadastro.nome || "pessoa").toLowerCase().replace(/\s+/g, "-")}.pdf`);
  } catch (error) {
    console.error(error);
    alert("Não foi possível gerar o PDF.");
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function atualizarContadorCadastros() {
  const total = state.cadastros.length;
  totalCadastros.textContent = `${total} ${total === 1 ? "cadastro" : "cadastros"}`;
}

function initIcons() {
  if (window.lucide?.createIcons) {
    window.lucide.createIcons();
  }
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.remove("hidden");
  clearTimeout(toastTimeoutId);
  toastTimeoutId = setTimeout(() => toast.classList.add("hidden"), 2200);
}

function setSaveButtonLabel(isEditing) {
  btnSalvar.innerHTML = `
    <i data-lucide="${isEditing ? "refresh-cw" : "save"}"></i>
    <span>${isEditing ? "Atualizar" : "Salvar"}</span>
  `;
  initIcons();
}
