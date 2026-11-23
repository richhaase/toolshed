import type { PanelWorkspace } from "./shared";

export const PANEL_DATA_OPEN = '<script type="application/json" id="bigboard-data">';
export const PANEL_DATA_CLOSE = "</script>";
export const MAX_PANEL_DATA_LENGTH = 6 * 1024 * 1024;

export function embedPanelData(html: string, workspace: PanelWorkspace | null): string {
  const data = JSON.stringify(workspace).replaceAll("<", "\\u003c");
  if (data.length > MAX_PANEL_DATA_LENGTH) return html;
  const open = html.indexOf(PANEL_DATA_OPEN);
  if (open < 0) return html;
  const start = open + PANEL_DATA_OPEN.length;
  const end = html.indexOf(PANEL_DATA_CLOSE, start);
  return end < 0 ? html : html.slice(0, start) + data + html.slice(end);
}

export function parsePanelData(text: string | null | undefined): PanelWorkspace | null {
  if (!text) return null;
  try {
    const value = JSON.parse(text) as PanelWorkspace | null;
    return value && Number.isSafeInteger(value.generation) && Array.isArray(value.configuration?.repositories) && Array.isArray(value.collection?.git) ? value : null;
  } catch { return null; }
}

export function panelDataFromHtml(html: string): PanelWorkspace | null {
  const open = html.indexOf(PANEL_DATA_OPEN);
  if (open < 0) return null;
  const start = open + PANEL_DATA_OPEN.length;
  const end = html.indexOf(PANEL_DATA_CLOSE, start);
  return end < 0 ? null : parsePanelData(html.slice(start, end));
}
