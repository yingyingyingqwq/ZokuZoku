import type { WebviewApi } from "vscode-webview";
import type { ControllerMessage, EditorMessage } from "./sharedTypes";
import type { WorkspaceState } from "./stores";

export const vscode: Omit<WebviewApi<WorkspaceState>, "postMessage"> & {
    postMessage(message: EditorMessage): void;
    showInputBox(id: string, placeholder: string): Promise<string | undefined>;
} = {
    ...acquireVsCodeApi(),
    showInputBox(id, placeholder) {
        return new Promise(resolve => {
            let listener: (e: MessageEvent<ControllerMessage>) => void;
            listener = (e: MessageEvent<ControllerMessage>) => {
                const message = e.data;
                if (message.type == "showInputBoxResult" && message.id == id) {
                    resolve(message.result);
                    window.removeEventListener("message", listener);
                }
            }
            window.addEventListener("message", listener);

            vscode.postMessage({
                type: "showInputBox",
                id,
                placeholder
            });
        });
    },
}