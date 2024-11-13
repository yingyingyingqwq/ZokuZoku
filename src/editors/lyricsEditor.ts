import * as vscode from 'vscode';
import { getEditorHtml, makeEditForStringProperty } from './utils';
import { ControllerMessage, EditorMessage, IEntryTreeNode, ITreeNode, TreeNodeId } from './sharedTypes';
import { JsonDocument } from '../core';
import assetHelper from '../core/assetHelper';
import { TextAsset } from '../unityPy/classes';
import { ClassIDType } from '../unityPy/enums';
import { Proxify } from '../pythonInterop';
import { parse as parseCsv } from 'csv-parse/sync';
import fontHelper from './fontHelper';
import { EditorBase } from './editorBase';

export class LyricsEditorProvider extends EditorBase implements vscode.CustomTextEditorProvider {
    static readonly viewType = 'zokuzoku.lyricsEditor';

    public static register(context: vscode.ExtensionContext): vscode.Disposable {
		const provider = new LyricsEditorProvider(context);
		return vscode.window.registerCustomEditorProvider(LyricsEditorProvider.viewType, provider);
	}

    resolveCustomTextEditor(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel, _token: vscode.CancellationToken) {
        // Json document setup
        let json = new JsonDocument<{[key: string]: string} | null>(document.uri, null, () => {
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
        let nodesPromise = LyricsEditorProvider.generateNodes(document.uri);
        webviewPanel.webview.onDidReceiveMessage((message: EditorMessage) => {
            switch (message.type) {
                case "init":
                    postMessage({ type: "setExplorerTitle", title: "Lyrics" });
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
                    let key = message.entryPath[0];
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

    static async generateNodes(uri: vscode.Uri): Promise<ITreeNode[]> {
        // Parse filename
        const pathSplit = uri.path.split("/");
        const filename = pathSplit.at(-1);
        const matches = filename?.match(/^(m\d{4})(_lyrics\.json)$/);
        const musicId = matches?.[1];
        if (!musicId) {
            throw new Error("Failed to parse song index from filename");
        }

        // Read the lyrics asset
        const lyricsAssetName = musicId + "_lyrics";
        const env = await assetHelper.loadBundle(`live/musicscores/${musicId}/${lyricsAssetName}`);
        const objects = env.objects;
        if (!objects.length) {
            throw new Error("Failed to load asset bundle");
        }
        let lyricsAsset: Proxify<TextAsset> | undefined;
        for (const obj of objects) {
            if (obj.type.toJS() === ClassIDType.TextAsset) {
                const asset = obj.read<TextAsset>(false);
                if (asset.name.toJS() === lyricsAssetName) {
                    lyricsAsset = asset;
                    break;
                }
            }
        }
        if (!lyricsAsset) {
            throw new Error("Failed to find lyrics asset in bundle");
        }

        // Create nodes from data
        const data: [string, string][] = parseCsv(lyricsAsset.script.toJS(), {
            encoding: "utf8",
            from: 2,
            relax_column_count_more: true // some files have an extra delim at the end for some reason
        });

        const nodes: IEntryTreeNode[] = [];
        for (const row of data) {
            const [ time, lyrics ] = row;
            if (!lyrics) { continue; }

            const prevNode = nodes[nodes.length - 1];
            if (prevNode) {
                prevNode.next = time;
            }

            nodes.push({
                type: "entry",
                id: time,
                name: lyrics,
                content: [{
                    content: lyrics,
                    multiline: true
                }],
                prev: prevNode?.id
            });
        }

        return nodes;
    }

    protected override getHtmlForWebview(webview: vscode.Webview): string {
        return getEditorHtml(this.context.extensionUri, webview, "commonEditor", "Lyrics Editor");
    }
}