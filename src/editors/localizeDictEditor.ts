import * as vscode from 'vscode';
import { getEditorHtml, makeEditForStringProperty } from './utils';
import { ControllerMessage, EditorMessage, IEntryTreeNode, ITreeNode, TreeNodeId } from './sharedTypes';
import fs from 'fs/promises';
import config from '../config';
import { JsonDocument } from '../core';
import fontHelper from './fontHelper';
import { EditorBase } from './editorBase';

export class LocalizeDictEditorProvider extends EditorBase implements vscode.CustomTextEditorProvider {
    static readonly viewType = 'zokuzoku.localizeDictEditor';

    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        const provider = new LocalizeDictEditorProvider(context);
        return vscode.window.registerCustomEditorProvider(LocalizeDictEditorProvider.viewType, provider);
    }
    
    resolveCustomTextEditor(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel, _token: vscode.CancellationToken) {
        // Json document setup
        let json = new JsonDocument<{[key: string]: string} | null>(document.uri, null, () => {
            const [ _, subscribedKey ] = this.subscribedPath;
            const content = getDictValue(subscribedKey);
            postMessage({
                type: "setTextSlotContent",
                entryPath: this.subscribedPath,
                index: 0,
                content
            });
            postMessage({
                type: "setExists",
                path: this.subscribedPath,
                exists: content !== null
            });
        });
        this.disposables.push(json);

        let initReadPromise = json.readTextDocument().catch(_ => {});
        json.watchTextDocument(document);
        function getDictProperty(id: TreeNodeId): jsonToAst.PropertyNode | undefined {
            if (json.ast.type !== "Object" || typeof id !== "string") { return; }
            return json.astObjectsProps.get(json.ast)?.[id];
        }
        function getDictValue(id: TreeNodeId): string | null {
            const valueNode = getDictProperty(id)?.value;
            return (!valueNode || valueNode.type !== "Literal" || typeof valueNode.value !== "string") ?
                null :
                valueNode.value;
        }
        
        // Init webview
        this.setupWebview(webviewPanel);

        // Messaging setup
        function postMessage(message: ControllerMessage) {
            webviewPanel.webview.postMessage(message);
        }

        let prevEditPromise = Promise.resolve();
        let nodesPromise = LocalizeDictEditorProvider.generateNodes();
        webviewPanel.webview.onDidReceiveMessage((message: EditorMessage) => {
            switch (message.type) {
                case "init":
                    postMessage({ type: "setExplorerTitle", title: "Localize dict" });
                    // Just making sure to prevent data races
                    initReadPromise.finally(() => {
                        nodesPromise.then(nodes => {
                            postMessage({ type: "setNodes", nodes });
                        })
                        .catch(e => vscode.window.showErrorMessage("" + e));
                    });
                    fontHelper.onInit(webviewPanel.webview);
                    break;

                case "getTextSlotContent": {
                    let [_, key] = message.entryPath;
                    postMessage({
                        type: "setTextSlotContent",
                        entryPath: message.entryPath,
                        index: message.index,
                        content: getDictValue(key)
                    });
                    break;
                }
                
                case "getExists": {
                    let [_, key] = message.path;
                    postMessage({
                        type: "setExists",
                        path: message.path,
                        exists: getDictValue(key) !== null
                    });
                    break;
                }

                case "setTextSlotContent": {
                    let [_, key] = message.entryPath;
                    if (typeof key !== "string") { break; }

                    // Wait for previous edit to finish before applying another
                    prevEditPromise = prevEditPromise.then(async () => {
                        try {
                            const applied = await json.applyEdit(
                                makeEditForStringProperty(key, message.content)
                            );
                            if (!applied) {
                                vscode.window.showErrorMessage("Failed to apply edit");
                            }
                        }
                        catch (e) {
                            vscode.window.showErrorMessage("" + e);
                        }
                    });
                    break;
                }
            }
        });
    }

    static async generateNodes(): Promise<ITreeNode[]> {
        let dumpPath = config().get<string>("localizeDictDump");
        if (!dumpPath) {
            throw new Error("The path to the localize dict dump has not been set");
        }
        let dumpJson = await fs.readFile(dumpPath, { encoding: "utf8" });

        let dict: {[key: string]: string} = JSON.parse(dumpJson);
        let nodes: ITreeNode[] = [];
        let categoryMap: {[key: string]: IEntryTreeNode[]} = {};

        for (const key in dict) {
            const value = dict[key];
            if (typeof key !== "string" || typeof value !== "string") {
                throw new Error("Malformed localize dict dump entry at: " + key);
            }

            let categoryName = "";
            for (const c of key) {
                if (c >= '0' && c <= '9') { break; }
                categoryName += c;
            }

            let categoryChildren = categoryMap[categoryName];
            let prev: TreeNodeId | undefined;
            if (!categoryChildren) {
                categoryChildren = [];
                let node: ITreeNode = {
                    type: "category",
                    id: categoryName,
                    name: categoryName,
                    children: categoryChildren
                };
                nodes.push(node);
                categoryMap[categoryName] = categoryChildren;
            }
            else {
                const prevNode = categoryChildren[categoryChildren.length - 1];
                prevNode.next = key;
                prev = prevNode.id;
            }

            categoryChildren.push({
                type: "entry",
                id: key,
                name: key,
                content: [
                    {
                        content: value,
                        multiline: true
                    }
                ],
                prev
            });
        }

        return nodes;
    }

    protected override getHtmlForWebview(webview: vscode.Webview): string {
        return getEditorHtml(this.context.extensionUri, webview, "commonEditor", "Localize Dict Editor");
    }
}