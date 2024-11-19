import * as vscode from 'vscode';
import { getEditorHtml, makeEditForArray } from './utils';
import { ControllerMessage, EditorMessage, IEntryTreeNode, ITreeNode, TreeNodeId } from './sharedTypes';
import { JsonDocument } from '../core';
import assetHelper from '../core/assetHelper';
import { ClassIDType } from '../unityPy/enums';
import fontHelper from './fontHelper';
import { EditorBase } from './editorBase';
import { AssetBundle } from '../unityPy/classes/assetBundle';
import { Proxify } from '../pythonInterop';

export class RaceStoryEditorProvider extends EditorBase implements vscode.CustomTextEditorProvider {
    static readonly viewType = 'zokuzoku.raceStoryEditor';

    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        const provider = new RaceStoryEditorProvider(context);
        return vscode.window.registerCustomEditorProvider(RaceStoryEditorProvider.viewType, provider);
    }

    resolveCustomTextEditor(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel, _token: vscode.CancellationToken) {
        // Json document setup
        let json = new JsonDocument<string[] | null>(document.uri, null, () => {
            const subscribedKey = this.subscribedPath[0];
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
        function getDictProperty(id: TreeNodeId): jsonToAst.ValueNode | undefined {
            id = Number(id);
            if (json.ast.type !== "Array" || isNaN(id)) { return; }
            return json.ast.children[id];
        }
        function getDictValue(id: TreeNodeId): string | null {
            const valueNode = getDictProperty(id);
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
        let nodesPromise = RaceStoryEditorProvider.generateNodes(document.uri);
        webviewPanel.webview.onDidReceiveMessage((message: EditorMessage) => {
            switch (message.type) {
                case "init":
                    postMessage({ type: "setExplorerTitle", title: "Race Story" });
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
                    let key = message.entryPath[0];
                    postMessage({
                        type: "setTextSlotContent",
                        entryPath: message.entryPath,
                        index: message.index,
                        content: getDictValue(key)
                    });
                    break;
                }
                
                case "getExists": {
                    let key = message.path[0];
                    postMessage({
                        type: "setExists",
                        path: message.path,
                        exists: getDictValue(key) !== null
                    });
                    break;
                }

                case "setTextSlotContent": {
                    let key = Number(message.entryPath[0]);
                    if (isNaN(key)) { break; }

                    // Wait for previous edit to finish before applying another
                    prevEditPromise = prevEditPromise.then(async () => {
                        try {
                            if (json.ast.type !== "Array") {
                                throw new Error("Root node is not an array");
                            }
                            const applied = await json.applyEdit(
                                makeEditForArray(json.ast, "", key, message.content)
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

    static async generateNodes(uri: vscode.Uri): Promise<ITreeNode[]> {
        // Parse filename
        const pathSplit = uri.path.split("/");
        const filename = pathSplit.at(-1);
        const matches = filename?.match(/^(storyrace_\d{9})\.json$/);
        const assetName = matches?.[1];
        if (!assetName) {
            throw new Error("Failed to parse asset name from filename");
        }

        // Read the asset
        const env = await assetHelper.loadBundle(`race/storyrace/text/${assetName}`);
        const objects = env.objects;
        if (!objects.length) {
            throw new Error("Failed to load asset bundle");
        }
        let assetBundle: Proxify<AssetBundle> | undefined;
        for (const obj of objects) {
            if (obj.type.toJS() === ClassIDType.AssetBundle) {
                assetBundle = obj.read<AssetBundle>(false);
                break;
            }
        }
        if (!assetBundle) {
            throw new Error("Failed to find asset bundle object");
        }
        let assetInfo = assetBundle.m_Container.item(
            `assets/_gallopresources/bundle/resources/race/storyrace/text/${assetName}.asset`
        );
        if (!assetInfo) {
            throw new Error("Failed to find text asset");
        }
        let textAsset = assetInfo.asset.get_obj().read(false);
        let textData = textAsset.type_tree.item("textData") as Proxify<{ text: string }[]>;

        const nodes: IEntryTreeNode[] = [];
        let i = 0;
        for (const block of textData) {
            const id = i++;
            const prevNode = nodes[nodes.length - 1];
            if (prevNode) {
                prevNode.next = id;
            }

            const text = block.text.toJS();
            nodes.push({
                type: "entry",
                id,
                name: text,
                content: [{
                    content: text,
                    multiline: true
                }],
                prev: prevNode?.id
            });
        }

        return nodes;
    }

    protected override getHtmlForWebview(webview: vscode.Webview): string {
        return getEditorHtml(this.context.extensionUri, webview, "commonEditor", "Race Story Editor");
    }
}