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
    combobox: document.querySelector("[data-combobox]"),
    translationToggle: document.querySelector("#translation-toggle"),
    translationPopover: document.querySelector("#translation-popover"),
    translationSearch: document.querySelector("#translation-search"),
    translationOptions: document.querySelector("#translation-options"),
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

export function createComboboxState(options, { query = "", isOpen = false, selectedValue = null, maxResults = 25 } = {}) {
  const filteredOptions = getSelectableTranslations(
    options.map((option) => ({
      name: option.label,
      language: option.description.split(" · ")[0] ?? "",
      path: option.value,
    })),
    query,
  ).slice(0, maxResults);

  const selectedOption = options.find((option) => option.value === selectedValue) ?? null;

  return {
    query,
    isOpen,
    selectedValue,
    buttonLabel: selectedOption?.label ?? "Select a translation",
    filteredOptions,
  };
}

export function selectComboboxOption(value) {
  return {
    query: "",
    isOpen: false,
    selectedValue: value,
  };
}

function renderCombobox(elements, entries, state) {
  const options = getSelectableTranslations(entries);
  const comboboxState = createComboboxState(options, state);

  elements.translationToggle.textContent = comboboxState.buttonLabel;
  elements.translationToggle.setAttribute("aria-expanded", String(comboboxState.isOpen));
  elements.translationPopover.hidden = !comboboxState.isOpen;
  elements.translationSearch.value = comboboxState.query;
  elements.translationOptions.innerHTML = "";

  if (comboboxState.filteredOptions.length === 0) {
    const empty = document.createElement("li");
    empty.className = "combobox-empty";
    empty.textContent = "No translations match your search.";
    elements.translationOptions.append(empty);
    return;
  }

  for (const option of comboboxState.filteredOptions) {
    const item = document.createElement("li");
    item.className = "combobox-option";
    item.setAttribute("role", "option");
    item.setAttribute("aria-selected", String(option.value === comboboxState.selectedValue));
    item.dataset.value = option.value;
    item.innerHTML = `
      <span class="combobox-option-label">${option.label}</span>
      <span class="combobox-option-description">${option.description}</span>
    `;
    elements.translationOptions.append(item);
  }
}

export function createApp({ manifestLoader = loadManifest } = {}) {
  const elements = getElements();
  const state = {
    entries: [],
    query: "",
    isOpen: false,
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
    renderCombobox(elements, state.entries, {
      query: state.query,
      isOpen: state.isOpen,
      selectedValue: state.selectedPath,
    });
    elements.convertButton.disabled = !selectedEntry();
  }

  async function init() {
    setError("");
    setStatus("Loading manifest...");
    state.entries = await manifestLoader();
    updateSelectionState();
    setStatus("Manifest ready.");
  }

  elements.translationToggle.addEventListener("click", () => {
    state.isOpen = !state.isOpen;
    updateSelectionState();
    if (state.isOpen) {
      elements.translationSearch.focus();
    }
  });

  elements.translationSearch.addEventListener("input", (event) => {
    state.query = event.target.value;
    state.isOpen = true;
    updateSelectionState();
  });

  elements.translationOptions.addEventListener("click", (event) => {
    const option = event.target.closest(".combobox-option");
    if (!option) {
      return;
    }
    const next = selectComboboxOption(option.dataset.value);
    state.query = next.query;
    state.isOpen = next.isOpen;
    state.selectedPath = next.selectedValue;
    updateSelectionState();
  });

  document.addEventListener("click", (event) => {
    if (!elements.combobox.contains(event.target)) {
      state.isOpen = false;
      updateSelectionState();
    }
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
