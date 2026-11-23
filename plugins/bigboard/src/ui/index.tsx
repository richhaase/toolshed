import { createRoot } from "react-dom/client";
import { BoardView } from "./BoardView";
import { McpBoardBridge } from "./bridge";
import { BoardController } from "./controller";
import { FallbackBridge } from "./fallback";
import "./styles.css";

const target = document.getElementById("root");
if (!target) throw new Error("BigBoard needs a root element.");
const host = new McpBoardBridge();
const controller = new BoardController(new FallbackBridge(host, host));
const root = createRoot(target);
root.render(<BoardView controller={controller} />);
void controller.start();
window.addEventListener("pagehide", () => {
  root.unmount();
  void controller.destroy();
}, { once: true });
