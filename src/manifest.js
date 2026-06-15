export async function loadManifest(url = "./public/manifest.json", fetchImpl = fetch) {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`Failed to load manifest: ${response.status}`);
  }
  return response.json();
}

export function filterManifest(entries, query) {
  const normalizedQuery = (query ?? "").trim().toLowerCase();
  if (!normalizedQuery) {
    return [...entries];
  }

  return entries.filter((entry) => {
    const haystack = `${entry.name} ${entry.language} ${entry.path}`.toLowerCase();
    return haystack.includes(normalizedQuery);
  });
}
