import { App } from "@modelcontextprotocol/ext-apps";
import { panelDataFromHtml, parsePanelData } from "../panel-data";
import { APP_VERSION, BOARD_RESOURCE_URI, type PanelWorkspace, type SelectionContext } from "../shared";
import type { BoardBridge, ToolResult } from "./controller";
import type { PanelDataSource } from "./fallback";

export class McpBoardBridge implements BoardBridge, PanelDataSource {
  private app = new App({ name: "BigBoard", version: APP_VERSION }, {});

  async connect(onResult: (result: ToolResult) => void, onTeardown?: () => void): Promise<void> {
    this.app.ontoolresult = onResult;
    this.app.onteardown = async () => {
      onTeardown?.();
      return {};
    };
    this.app.onhostcontextchanged = (context) => {
      if (context.theme) document.documentElement.dataset.theme = context.theme;
    };
    await this.app.connect();
    const context = this.app.getHostContext();
    if (context?.theme) document.documentElement.dataset.theme = context.theme;
  }

  callTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    return this.app.callServerTool({ name, arguments: args }, { timeout: name === "refresh_sources" ? 180_000 : 30_000 }) as Promise<ToolResult>;
  }

  embedded(): PanelWorkspace | null {
    return parsePanelData(document.getElementById("bigboard-data")?.textContent);
  }

  async reload(): Promise<PanelWorkspace | null> {
    const resource = await this.app.readServerResource({ uri: BOARD_RESOURCE_URI }, { timeout: 15_000 });
    const content = resource.contents.find(item => item.uri === BOARD_RESOURCE_URI);
    return content && "text" in content ? panelDataFromHtml(content.text) : null;
  }

  async updateContext(context: SelectionContext): Promise<void> {
    const supported = this.app.getHostCapabilities()?.updateModelContext;
    if (supported?.structuredContent) {
      await this.app.updateModelContext({ structuredContent: { ...context } });
    } else if (supported?.text) {
      await this.app.updateModelContext({ content: [{ type: "text", text: `BigBoard selected scope:\n${JSON.stringify(context)}`, annotations: { audience: ["assistant"] } }] });
    } else throw new Error("This host cannot receive BigBoard selection context.");
  }

  async sendMessage(text: string): Promise<void> {
    const result = await this.app.sendMessage({ role: "user", content: [{ type: "text", text }] });
    if (result.isError) throw new Error("The conversation did not accept the selection. Try again.");
  }

  async close(): Promise<void> {
    await this.app.close();
  }
}
