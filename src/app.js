import { filterManifest, loadManifest } from "./manifest.js";
import { buildTranslationZip, triggerDownload } from "./download.js";
import { parseBibleXml } from "./xmlParser.js";

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
    const parsedBible = parseXml(xmlText);
    onStatus("Building EPUB files...");
    onStatus("Packaging ZIP...");
    const artifact = buildZip(parsedBible);
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
    searchInput: document.querySelector("#search"),
    selectionSummary: document.querySelector("#selection-summary"),
    translationList: document.querySelector("#translation-list"),
    convertButton: document.querySelector("#convert-button"),
    statusMessage: document.querySelector("#status-message"),
    errorMessage: document.querySelector("#error-message"),
  };
}

function renderEmptyState(container, message) {
  container.innerHTML = "";
  const empty = document.createElement("div");
  empty.className = "translation-empty";
  empty.textContent = message;
  container.append(empty);
}

function renderTranslations(container, entries, selectedPath, onSelect) {
  container.innerHTML = "";
  for (const entry of entries) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "translation-option";
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", String(entry.path === selectedPath));
    button.dataset.path = entry.path;
    button.innerHTML = `
      <span class="translation-title">${entry.name}</span>
      <span class="translation-meta">${entry.language} · ${entry.path}</span>
    `;
    button.addEventListener("click", () => onSelect(entry.path));
    container.append(button);
  }
}

export function createApp({ manifestLoader = loadManifest } = {}) {
  const elements = getElements();
  const state = {
    entries: [],
    query: "",
    selectedPath: null,
  };

  function selectedEntry() {
    return state.entries.find((entry) => entry.path === state.selectedPath) ?? null;
  }

  function setStatus(message) {
    elements.statusMessage.textContent = message;
  }

  function setError(message = "") {
    elements.errorMessage.textContent = message;
    elements.errorMessage.hidden = !message;
  }

  function updateSelectionSummary() {
    const entry = selectedEntry();
    elements.selectionSummary.textContent = entry
      ? `Selected: ${entry.name} (${entry.language})`
      : "No translation selected.";
    elements.convertButton.disabled = !entry;
  }

  function updateList() {
    const filteredEntries = filterManifest(state.entries, state.query);
    if (filteredEntries.length === 0) {
      renderEmptyState(elements.translationList, "No translations match the current search.");
      return;
    }
    renderTranslations(elements.translationList, filteredEntries, state.selectedPath, (path) => {
      state.selectedPath = path;
      updateSelectionSummary();
      updateList();
    });
  }

  async function init() {
    setError("");
    setStatus("Loading manifest...");
    state.entries = await manifestLoader();
    updateSelectionSummary();
    updateList();
    setStatus("Manifest ready.");
  }

  elements.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value;
    updateList();
  });

  elements.convertButton.addEventListener("click", async () => {
    const entry = selectedEntry();
    if (!entry) {
      return;
    }

    setError("");
    elements.convertButton.disabled = true;
    try {
      await convertTranslation({
        entry,
        onStatus: setStatus,
      });
    } catch (error) {
      setStatus("Conversion failed.");
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      elements.convertButton.disabled = false;
      updateSelectionSummary();
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
