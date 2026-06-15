import { filterManifest, loadManifest } from "./manifest.js";
import { buildTranslationZip, triggerDownload } from "./download.js";
import { parseBibleXml } from "./xmlParser.js";

const PAGE_SIZE = 20;

async function fetchXmlText(url, fetchImpl = fetch) {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`Failed to download XML: ${response.status}`);
  }
  return response.text();
}

export async function convertTranslation({
  entry,
  onStatus,
  fetchXml = (url) => fetchXmlText(url),
  parseXml = parseBibleXml,
  buildZip = buildTranslationZip,
  download = triggerDownload,
}) {
  onStatus("Downloading XML...");
  try {
    const xmlText = await fetchXml(entry.rawUrl);
    onStatus("Parsing XML...");
    const parsedBible = parseXml(xmlText, entry);
    onStatus("Building EPUB files...");
    onStatus("Packaging ZIP...");
    const artifact = await buildZip(parsedBible);
    download(artifact.fileName, artifact.bytes);
    onStatus("Ready.");
    return artifact;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${message} (source: ${entry.rawUrl})`);
  }
}

function getElements() {
  return {
    translationSearch: document.querySelector("#translation-search"),
    resultsMeta: document.querySelector("#results-meta"),
    translationList: document.querySelector("#translation-list"),
    loadMoreButton: document.querySelector("#load-more-button"),
    statusMessage: document.querySelector("#status-message"),
    errorMessage: document.querySelector("#error-message"),
  };
}

export function getSelectableTranslations(entries, query = "") {
  return filterManifest(entries, query).map((entry) => ({
    value: entry.path,
    label: entry.name,
    description: `${entry.language} · ${entry.path}`,
  }));
}

export function getVisibleTranslations(entries, { query = "", visibleCount = PAGE_SIZE } = {}) {
  const filtered = (query ?? "").trim().toLowerCase();
  const rows = filtered
    ? entries.filter((entry) => `${entry.label} ${entry.description}`.toLowerCase().includes(filtered))
    : [...entries];
  return {
    filteredCount: rows.length,
    rows: rows.slice(0, visibleCount),
  };
}

export function shouldShowMoreButton({ filteredCount, visibleCount }) {
  return filteredCount > visibleCount;
}

function renderResultsMeta(element, filteredCount) {
  if (filteredCount === 0) {
    element.textContent = "No matching translations.";
    return;
  }
  element.textContent = `${filteredCount} matching translation${filteredCount === 1 ? "" : "s"}`;
}

function renderTranslationRows(container, rows) {
  container.innerHTML = "";

  if (rows.length === 0) {
    const empty = document.createElement("div");
    empty.className = "translation-empty";
    empty.textContent = "No translations match the current filter.";
    container.append(empty);
    return;
  }

  for (const row of rows) {
    const article = document.createElement("article");
    article.className = "translation-row";
    article.innerHTML = `
      <div>
        <span class="translation-row-title">${row.label}</span>
        <span class="translation-row-description">${row.description}</span>
      </div>
      <div class="translation-row-action">
        <button type="button" data-path="${row.value}">Download EPUB ZIP</button>
      </div>
    `;
    container.append(article);
  }
}

export function createApp({ manifestLoader = loadManifest } = {}) {
  const elements = getElements();
  const state = {
    entries: [],
    query: "",
    visibleCount: PAGE_SIZE,
    activePath: null,
  };

  function setStatus(message) {
    elements.statusMessage.textContent = message;
  }

  function setError(message = "") {
    elements.errorMessage.textContent = message;
    elements.errorMessage.hidden = !message;
  }

  function findEntry(path) {
    return state.entries.find((entry) => entry.path === path) ?? null;
  }

  function render() {
    const rows = getSelectableTranslations(state.entries, state.query);
    const visible = getVisibleTranslations(rows, {
      visibleCount: state.visibleCount,
    });

    renderResultsMeta(elements.resultsMeta, visible.filteredCount);
    renderTranslationRows(elements.translationList, visible.rows);
    elements.loadMoreButton.hidden = !shouldShowMoreButton({
      filteredCount: visible.filteredCount,
      visibleCount: state.visibleCount,
    });
  }

  async function init() {
    setError("");
    setStatus("Loading manifest...");
    state.entries = await manifestLoader();
    render();
    setStatus("Manifest ready.");
  }

  elements.translationSearch.addEventListener("input", (event) => {
    state.query = event.target.value;
    state.visibleCount = PAGE_SIZE;
    render();
  });

  elements.loadMoreButton.addEventListener("click", () => {
    state.visibleCount += PAGE_SIZE;
    render();
  });

  elements.translationList.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-path]");
    if (!button) {
      return;
    }

    const entry = findEntry(button.dataset.path);
    if (!entry) {
      return;
    }

    state.activePath = entry.path;
    setError("");
    button.disabled = true;

    try {
      await convertTranslation({
        entry,
        onStatus: setStatus,
      });
    } catch (error) {
      setStatus("Conversion failed.");
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      state.activePath = null;
      button.disabled = false;
    }
  });

  return {
    init,
    setStatus,
    setError,
    getState() {
      return { ...state };
    },
  };
}

if (typeof document !== "undefined") {
  const app = createApp();
  app.init().catch((error) => {
    const fallback = getElements();
    fallback.statusMessage.textContent = "Manifest failed to load.";
    fallback.errorMessage.hidden = false;
    fallback.errorMessage.textContent = error instanceof Error ? error.message : String(error);
  });
}
