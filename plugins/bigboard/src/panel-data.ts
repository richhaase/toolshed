import type { ActivityRecord, PanelWorkspace } from "./shared";

export const PANEL_DATA_OPEN = '<script type="application/json" id="bigboard-data">';
export const PANEL_DATA_CLOSE = "</script>";
export const MAX_PANEL_DATA_LENGTH = 4 * 1024 * 1024;
const DAY = 86_400_000;
const TRIM_DAYS = [90, 60, 28, 14];

type Collection = NonNullable<PanelWorkspace["collection"]>;
type PackedRecord = [sha: string, time: number, subject: string, person: number, additions: number | null, deletions: number | null];
interface PackedWorkspace extends Omit<PanelWorkspace, "collection"> {
  people: [name: string, email: string][];
  collection: Omit<Collection, "git"> & { git: (Omit<Collection["git"][number], "records"> & { records: PackedRecord[] })[] };
}

function pack(workspace: PanelWorkspace): string | null {
  const { collection } = workspace;
  if (!collection) return null;
  const people = new Map<string, number>();
  const person = (record: ActivityRecord) => {
    const key = JSON.stringify([record.contributor, record.email]);
    let index = people.get(key);
    if (index === undefined) { index = people.size; people.set(key, index); }
    return index;
  };
  const git = collection.git.map(source => ({
    ...source,
    records: source.records.map((record): PackedRecord => [record.sha, Date.parse(record.timestamp), record.subject, person(record), record.additions, record.deletions]),
  }));
  const packed: PackedWorkspace = { ...workspace, collection: { ...collection, git }, people: [...people.keys()].map(key => JSON.parse(key)) };
  return JSON.stringify(packed).replaceAll("<", "\\u003c");
}

function trim(workspace: PanelWorkspace, days: number): PanelWorkspace {
  const collection = workspace.collection!;
  const since = new Date(Date.parse(collection.until) - days * DAY).toISOString();
  if (since <= collection.since) return workspace;
  return { ...workspace, trimmed: true, collection: { ...collection, since, git: collection.git.map(git => ({ ...git, records: git.records.filter(record => record.timestamp >= since) })) } };
}

export function embedPanelData(html: string, workspace: PanelWorkspace | null, limit = MAX_PANEL_DATA_LENGTH): string {
  if (!workspace?.collection) return html;
  let data = pack(workspace)!;
  for (const days of TRIM_DAYS) {
    if (data.length <= limit) break;
    data = pack(trim(workspace, days))!;
  }
  if (data.length > limit) return html;
  const open = html.indexOf(PANEL_DATA_OPEN);
  if (open < 0) return html;
  const start = open + PANEL_DATA_OPEN.length;
  const end = html.indexOf(PANEL_DATA_CLOSE, start);
  return end < 0 ? html : html.slice(0, start) + data + html.slice(end);
}

export function parsePanelData(text: string | null | undefined): PanelWorkspace | null {
  if (!text) return null;
  try {
    const value = JSON.parse(text) as PackedWorkspace | null;
    if (!value || !Number.isSafeInteger(value.generation) || !Array.isArray(value.configuration?.repositories) || !Array.isArray(value.collection?.git) || !Array.isArray(value.people)) return null;
    const { people, ...workspace } = value;
    return {
      ...workspace,
      collection: {
        ...value.collection,
        git: value.collection.git.map(git => ({
          ...git,
          records: git.records.map(([sha, time, subject, person, additions, deletions]): ActivityRecord => {
            const repository = git.repository.id;
            const [contributor, email] = people[person];
            return { id: `${repository}@${sha}`, repository, sha, timestamp: new Date(time).toISOString(), subject, contributor, email, additions, deletions, files: [], url: `https://github.com/${repository}/commit/${sha}` };
          }),
        })),
      },
    };
  } catch { return null; }
}

export function panelDataFromHtml(html: string): PanelWorkspace | null {
  const open = html.indexOf(PANEL_DATA_OPEN);
  if (open < 0) return null;
  const start = open + PANEL_DATA_OPEN.length;
  const end = html.indexOf(PANEL_DATA_CLOSE, start);
  return end < 0 ? null : parsePanelData(html.slice(start, end));
}
