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
    translationSelect: document.querySelector("#translation-select"),
    convertButton: document.querySelector("#convert-button"),
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

function renderSelectOptions(select, entries, selectedPath) {
  const options = getSelectableTranslations(entries);
  select.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = options.length === 0 ? "No translations available" : "Select a translation";
  select.append(placeholder);

  for (const option of options) {
    const element = document.createElement("option");
    element.value = option.value;
    element.textContent = `${option.label} - ${option.description}`;
    if (option.value === selectedPath) {
      element.selected = true;
    }
    select.append(element);
  }
}

export function createApp({ manifestLoader = loadManifest } = {}) {
  const elements = getElements();
  const state = {
    entries: [],
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

  function updateSelectionState() {
    renderSelectOptions(elements.translationSelect, state.entries, state.selectedPath);
    elements.convertButton.disabled = !selectedEntry();
  }

  async function init() {
    setError("");
    setStatus("Loading manifest...");
    state.entries = await manifestLoader();
    updateSelectionState();
    setStatus("Manifest ready.");
  }

  elements.translationSelect.addEventListener("change", (event) => {
    state.selectedPath = event.target.value || null;
    updateSelectionState();
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
      updateSelectionState();
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
