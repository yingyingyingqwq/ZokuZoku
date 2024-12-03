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
import path from 'path';
import { HCA_KEY, ZOKUZOKU_DIR } from '../defines';
import acb from '../criCodecs/acb';
import fs from 'fs/promises';

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
        let assetInfo = RaceStoryEditorProvider.parseFilename(document.uri);
        this.setupWebview(webviewPanel, [
            vscode.Uri.file(assetInfo.voiceCacheDir)
        ]);

        // Messaging setup
        function postMessage(message: ControllerMessage) {
            webviewPanel.webview.postMessage(message);
        }

        let prevEditPromise = Promise.resolve();
        let nodesPromise = RaceStoryEditorProvider.generateNodes(assetInfo);
        let loadVoicePromise: Promise<{[key: string]: string}> | undefined;
        webviewPanel.webview.onDidReceiveMessage((message: EditorMessage) => {
            switch (message.type) {
                case "init":
                    postMessage({ type: "setExplorerTitle", title: "Race Story" });
                    // Just making sure to prevent data races
                    initReadPromise.finally(() => {
                        nodesPromise.then(nodes => {
                            postMessage({ type: "setNodes", nodes });
                            postMessage({ type: "enableVoicePlayer" });
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

                case "loadVoice":
                    if (!loadVoicePromise) {
                        loadVoicePromise = new Promise(async (resolve, reject) => {
                            const hash = await assetHelper.getAssetHash(assetInfo.voiceAssetName);
                            if (!hash) {
                                return reject(new Error("Voice data is not available for this story"));
                            }
                            const acbPath = await assetHelper.loadGenericAssetByHash(hash);
                            vscode.window.withProgress({
                                location: vscode.ProgressLocation.Notification,
                                title: "Decoding audio..."
                            }, async () => {
                                try {
                                    const paths = await acb.decodeToWavFiles(acbPath, HCA_KEY, assetInfo.voiceCacheDir);
                                    const uris = Object.fromEntries(paths.map((v, i) => [
                                        i.toString(),
                                        webviewPanel.webview.asWebviewUri(vscode.Uri.file(v)).toString()
                                    ]));
                                    resolve(uris);
                                }
                                catch (e) {
                                    reject(e);
                                }
                            });
                        });
                    }
                    loadVoicePromise
                    .then(uris => postMessage({ type: "loadVoice", uris }))
                    .catch(e => vscode.window.showErrorMessage("" + e));
                    break;
            }
        });

        // Always try to clean up voice cache, regardless if voice was loaded in *this session*
        this.disposables.push(new vscode.Disposable(() => {
            return fs.rm(assetInfo.voiceCacheDir, { recursive: true, force: true });
        }));
    }

    static parseFilename(uri: vscode.Uri): RaceStoryAssetInfo {
        const pathSplit = uri.path.split("/");
        const filename = pathSplit.at(-1);
        const matches = filename?.match(/^(storyrace_\d{9})\.json$/);
        const assetName = matches?.[1];
        if (!assetName) {
            throw new Error("Failed to parse asset name from filename");
        }

        return {
            assetBundleName: `race/storyrace/text/${assetName}`,
            assetName,
            voiceAssetName: `sound/s/snd_voi_${assetName}.acb`,
            voiceCacheDir: path.join(ZOKUZOKU_DIR, "cache", `snd_voi_${assetName}`)
        }
    }

    static async generateNodes(info: RaceStoryAssetInfo): Promise<ITreeNode[]> {
        const { assetBundleName, assetName } = info;

        // Read the asset
        const env = await assetHelper.loadBundle(assetBundleName);
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

interface RaceStoryAssetInfo {
    assetBundleName: string;
    assetName: string;
    voiceAssetName: string;
    voiceCacheDir: string;
}