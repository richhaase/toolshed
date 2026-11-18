import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

test("the marketplace package exposes consistent bigboard skill identities without title overrides", async () => {
  const pluginRoot = fileURLToPath(new URL("../", import.meta.url));
  const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
  const manifest = JSON.parse(await readFile(new URL("../.codex-plugin/plugin.json", import.meta.url), "utf8"));
  const claudeManifest = JSON.parse(await readFile(new URL("../.claude-plugin/plugin.json", import.meta.url), "utf8"));
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const lock = JSON.parse(await readFile(new URL("../package-lock.json", import.meta.url), "utf8"));
  const catalog = JSON.parse(await readFile(new URL("../../../.agents/plugins/marketplace.json", import.meta.url), "utf8"));
  const claudeCatalog = JSON.parse(await readFile(new URL("../../../.claude-plugin/marketplace.json", import.meta.url), "utf8"));
  assert.equal(manifest.name, "bigboard");
  assert.equal(claudeManifest.name, manifest.name);
  assert.equal(claudeManifest.version, manifest.version);
  assert.equal(pkg.name, manifest.name);
  assert.equal(pkg.version, manifest.version);
  assert.equal(lock.name, pkg.name);
  assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages[""].name, pkg.name);
  assert.equal(lock.packages[""].version, pkg.version);
  assert.equal(manifest.skills, "./skills/");
  assert.equal(claudeManifest.skills, manifest.skills);
  assert.equal(manifest.mcpServers, "./mcp.codex.json");
  assert.equal(claudeManifest.mcpServers, "./mcp.claude.json");
  const codexMcp = JSON.parse(await readFile(resolve(pluginRoot, manifest.mcpServers), "utf8"));
  const claudeMcp = JSON.parse(await readFile(resolve(pluginRoot, claudeManifest.mcpServers), "utf8"));
  assert.deepEqual(Object.keys(codexMcp.mcpServers), ["bigboard"]);
  assert.deepEqual(Object.keys(claudeMcp.mcpServers), ["bigboard"]);
  assert.deepEqual(codexMcp.mcpServers.bigboard, { command: "node", args: ["bundle/server.cjs"], cwd: "." });
  assert.deepEqual(claudeMcp.mcpServers.bigboard, { command: "node", args: ["${CLAUDE_PLUGIN_ROOT}/bundle/server.cjs"] });
  assert.equal(catalog.name, "toolshed");
  assert.equal(claudeCatalog.name, catalog.name);
  const entries = catalog.plugins.filter((entry: { name: string }) => entry.name === manifest.name);
  const claudeEntries = claudeCatalog.plugins.filter((entry: { name: string }) => entry.name === manifest.name);
  assert.equal(entries.length, 1);
  assert.equal(claudeEntries.length, 1);
  assert.equal(resolve(repoRoot, entries[0].source.path), resolve(pluginRoot));
  assert.equal(resolve(repoRoot, claudeEntries[0].source), resolve(pluginRoot));
  assert.equal(claudeEntries[0].category, entries[0].category);
  assert.equal(catalog.plugins.some((entry: { name: string }) => entry.name === "bigboard-mcp-app"), false);
  const skillIds: string[] = [];
  for (const directory of await readdir(new URL("../skills/", import.meta.url), { withFileTypes: true })) {
    if (!directory.isDirectory()) continue;
    const skill = new URL(`../skills/${directory.name}/`, import.meta.url);
    const source = await readFile(new URL("SKILL.md", skill), "utf8");
    const name = /^name:\s*([a-z0-9-]+)\s*$/m.exec(source)?.[1];
    assert.equal(name, directory.name);
    const id = `${manifest.name}:${name}`;
    skillIds.push(id);
    let ui: string;
    try { ui = await readFile(new URL("agents/openai.yaml", skill), "utf8"); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
    assert.doesNotMatch(ui, /^\s*display_name\s*:/m);
    const prompt = /^\s*default_prompt:\s*"(.*)"\s*$/m.exec(ui)?.[1];
    if (prompt) assert.ok(prompt.includes(`$${id}`));
  }
  assert.deepEqual(skillIds.sort(), ["bigboard:configure", "bigboard:explore"]);
});
