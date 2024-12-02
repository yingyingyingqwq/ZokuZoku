import * as vscode from 'vscode';
import config from '../config';
import { dirname } from 'path';
import type { ControllerMessage, EditorMessage, TreeNodeId } from './sharedTypes';
import HachimiIpc from '../core/hachimiIpc';

export class EditorBase {
    static activeWebview: vscode.Webview | null = null;
    subscribedPath: TreeNodeId[] = [];
    disposables: vscode.Disposable[] = [];

    constructor(
        protected readonly context: vscode.ExtensionContext
    ) {
    }

    protected getHtmlForWebview(webview: vscode.Webview): string {
        return "";
    }

    protected setupWebview(webviewPanel: vscode.WebviewPanel, extraLocalResourceRoots: vscode.Uri[] = []) {
        const webview = webviewPanel.webview;
        const gameDataDir = config().get<string>("gameDataDir");
        const customFont = config().get<string>("customFont");
        webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this.context.extensionUri,
                ...(gameDataDir ? [ vscode.Uri.file(gameDataDir) ] : []),
                ...(customFont ? [ vscode.Uri.file(dirname(customFont)) ] : []),
                ...extraLocalResourceRoots
            ]
        };
        webview.html = this.getHtmlForWebview(webview);

        function postMessage(message: ControllerMessage) {
            webviewPanel.webview.postMessage(message);
        }

        // Handle common messages
        webview.onDidReceiveMessage((message: EditorMessage) => {
            switch (message.type) {
                case "showMessage":
                    switch (message.messageType) {
                        default:
                        case "info":
                            vscode.window.showInformationMessage(message.content);
                            break;
                        case "warning":
                            vscode.window.showWarningMessage(message.content);
                            break;
                        case "error":
                            vscode.window.showErrorMessage(message.content);
                            break;
                    }
                    break;

                case "subscribePath":
                    this.subscribedPath = message.path;
                    break;

                case "callHachimiIpc":
                    HachimiIpc.callWithProgress(message.command)
                        .catch(e => vscode.window.showErrorMessage("" + e));
                    break;

                case "showInputBox":
                    vscode.window.showInputBox({ placeHolder: message.placeholder })
                        .then(result => postMessage({
                            type: "showInputBoxResult",
                            id: message.id,
                            result
                        }));
                    break;
            }
        });

        webviewPanel.onDidChangeViewState(action => {
            if (action.webviewPanel.active) {
                EditorBase.activeWebview = action.webviewPanel.webview;
            }
            else if (EditorBase.activeWebview === action.webviewPanel.webview) {
                EditorBase.activeWebview = null;
            }
        });
        EditorBase.activeWebview = webview;

        webviewPanel.onDidDispose(() => this.dispose(), null, this.disposables);
    }

    dispose() {
        while (this.disposables.length) {
            this.disposables.pop()?.dispose();
        }
    }
}