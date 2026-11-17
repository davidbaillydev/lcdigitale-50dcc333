/** Leaflet interprets strings as HTML, so zone names must be DOM text. */
export function zoneTooltip(name: string): HTMLElement {
  const label = document.createElement("span");
  label.textContent = name;
  return label;
}