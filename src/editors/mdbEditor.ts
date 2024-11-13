import * as vscode from 'vscode';
import { getEditorHtml, makeEditForStringProperty } from './utils';
import { ControllerMessage, EditorMessage, IEntryTreeNode, ITreeNode, TreeNodeId } from './sharedTypes';
import { JsonDocument, utils } from '../core';
import textDataCategories from './mdbTextDataCategories';
import SQLite from '../sqlite';
import fontHelper from './fontHelper';
import config from '../config';
import { EditorBase } from './editorBase';

export const TABLE_NAMES = ["text_data", "character_system_text", "race_jikkyo_comment", "race_jikkyo_message"] as const;
export type MdbTableName = (typeof TABLE_NAMES)[number];

const TABLE_COLUMNS: {[K in MdbTableName]: string[]} = {
    "text_data": [ "category", "index", "text" ],
    "character_system_text": [ "character_id", "voice_id", "text" ],
    "race_jikkyo_comment": [ "id", "message" ],
    "race_jikkyo_message": [ "id", "message" ]
};

const TABLE_CATEGORIZERS: {[K in MdbTableName]?: (column: string) => Promise<string> | string} = {
    "text_data": category => `${category} ${textDataCategories[category] ?? ""}`,
    "character_system_text": async characterId => {
        const characterNames = await utils.getTextDataCategoryCached(6);
        return characterNames[+characterId] ?? characterId;
    }
};

const TEXT_DATA_CHARACTER_CATEGORIES = new Set([ 7, 8, 9, 144, 157, 158, 162, 163, 164, 165, 166, 167, 168, 169 ]);
const TABLE_ENTRY_NAME_GETTERS: {
    [K in MdbTableName]?: (categoryColumn: string | null, idColumn: string) => Promise<string | void> | string | void
} = {
    "text_data": async (category, index) => {
        // ???
        if (!category) { return; }

        if (TEXT_DATA_CHARACTER_CATEGORIES.has(+category)) {
            const characterNames = await utils.getTextDataCategoryCached(6);
            return `${index} ${characterNames[+index] ?? ""}`;
        }
    }
};

export class MdbEditorProvider extends EditorBase implements vscode.CustomTextEditorProvider {
    static readonly viewType = 'zokuzoku.mdbEditor';

    public static register(context: vscode.ExtensionContext): vscode.Disposable {
		const provider = new MdbEditorProvider(context);
		return vscode.window.registerCustomEditorProvider(MdbEditorProvider.viewType, provider);
	}

    resolveCustomTextEditor(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel, _token: vscode.CancellationToken) {
        const tableName = this.getTableName(document.uri);
        
        // Json document setup
        let json = new JsonDocument<{[key: string]: string | {[key: string]: string}} | null>(document.uri, null, () => {
            const content = getDictValue(this.subscribedPath);
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
        function getDictProperty(path: TreeNodeId[]): jsonToAst.PropertyNode | undefined {
            if (json.ast.type !== "Object" || !path.length) { return; }
            let currentObject = json.ast;
            for (let i = 0; i < path.length - 1; ++i) {
                const id = path[i];
                let valueNode = json.astObjectsProps.get(currentObject)?.[id]?.value;
                if (valueNode?.type !== "Object") { return; }
                currentObject = valueNode;
            }

            return json.astObjectsProps.get(currentObject)?.[path.at(-1)!];
        }
        function getDictValue(path: TreeNodeId[]): string | null {
            const valueNode = getDictProperty(path)?.value;
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
        let nodesPromise = MdbEditorProvider.generateNodes(tableName);
        webviewPanel.webview.onDidReceiveMessage((message: EditorMessage) => {
            switch (message.type) {
                case "init":
                    postMessage({ type: "setExplorerTitle", title: tableName });
                    // Just making sure to prevent data races
                    initReadPromise.finally(() => {
                        nodesPromise.then(nodes => {
                            postMessage({ type: "setNodes", nodes });
                        })
                        .catch(e => vscode.window.showErrorMessage("" + e));
                    });
                    fontHelper.onInit(webviewPanel.webview);
                    break;
                
                case "getTextSlotContent":
                    postMessage({
                        type: "setTextSlotContent",
                        entryPath: message.entryPath,
                        index: message.index,
                        content: getDictValue(message.entryPath)
                    });
                    break;
                
                case "getExists": 
                    postMessage({
                        type: "setExists",
                        path: message.path,
                        exists: getDictValue(message.path) !== null
                    });
                    break;
                
                case "setTextSlotContent":
                    // Wait for previous edit to finish before applying another
                    prevEditPromise = prevEditPromise.then(async () => {
                        const path = message.entryPath as string[];
                        const content = message.content;
                        let editPromise: Promise<boolean>;
                        if (path.length === 1) {
                            editPromise = json.applyEdit(
                                makeEditForStringProperty(path[0], message.content)
                            );
                        }
                        else if (path.length === 2) {
                            if (json.ast.type !== "Object") { return; }
                            const categoryProp = json.astObjectsProps.get(json.ast)![path[0]];
                            if (!categoryProp) {
                                if (content === null) { return; }
                                editPromise = json.applyEdit({
                                    type: "object",
                                    action: "update",
                                    property: {
                                        key: path[0],
                                        value: {
                                            type: "object",
                                            action: "set",
                                            values: {
                                                [path[1]]: content
                                            }
                                        }
                                    }
                                });
                            }
                            else {
                                const categoryObject = categoryProp.value;
                                if (categoryObject.type !== "Object") { return; }
                                // last node about to be deleted -> delete the parent category
                                if (content === null && categoryObject.children.length === 1) {
                                    editPromise = json.applyEdit({
                                        type: "object",
                                        action: "delete",
                                        key: path[0]
                                    });
                                }
                                else {
                                    editPromise = json.applyEdit({
                                        type: "object",
                                        action: "update",
                                        property: {
                                            key: path[0],
                                            value: makeEditForStringProperty(path[1], content)
                                        }
                                    });
                                }
                            }
                        }
                        else {
                            return;
                        }

                        try {
                            let applied = await editPromise;
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
        });
    }

    static nextTableName: MdbTableName | undefined;

    private getTableName(uri: vscode.Uri): MdbTableName {
        let tableName = MdbEditorProvider.nextTableName;
        if (tableName) {
            MdbEditorProvider.nextTableName = undefined;
            return tableName;
        }
        else {
            // dumb table name inference
            const pathSplit = uri.path.split("/");
            const filename = pathSplit.at(pathSplit.length - 1);
            if (!filename) {
                tableName = undefined;
            }
            else {
                for (const name of TABLE_NAMES) {
                    if (filename.includes(name)) {
                        tableName = name;
                        break;
                    }
                }
            }
        }

        if (tableName) {
            /*
            vscode.window.showWarningMessage(
                `MDB Editor was launched externally, the table name has been inferred from the filename: ${tableName}`
            );
            */
            return tableName;
        }
        else {
            throw new Error("MDB Editor was launched externally, failed to infer table name from filename");
        }
    }

    static async generateNodes(tableName: MdbTableName): Promise<ITreeNode[]> {
        const columns = TABLE_COLUMNS[tableName];
        const columnNames = columns.map(s => `"${s}"`).join(",");
        const orderByNames = columns.slice(0, -1).map(s => `"${s}"`).join(",");
        const sqlite = SQLite.instance;
        const queryRes = await sqlite.queryMdb(
            `SELECT ${columnNames} FROM ${tableName} ORDER BY ${orderByNames}`
        );
        const rows = queryRes[0].rows;

        const nodes: ITreeNode[] = [];
        const nameGetter = TABLE_ENTRY_NAME_GETTERS[tableName];
        if (columns.length === 3) {
            const categorizer = TABLE_CATEGORIZERS[tableName];
            const categoryMap: {[key: string]: IEntryTreeNode[]} = {};
            for (const [ categoryId, id, text ] of rows) {
                let categoryChildren = categoryMap[categoryId];

                let prev: TreeNodeId | undefined;
                if (!categoryChildren) {
                    categoryChildren = [];
                    nodes.push({
                        type: "category",
                        id: categoryId,
                        name: await categorizer?.(categoryId) ?? categoryId,
                        children: categoryChildren
                    });
                    categoryMap[categoryId] = categoryChildren;
                }
                else {
                    const prevNode = categoryChildren[categoryChildren.length - 1];
                    prevNode.next = id;
                    prev = prevNode.id;
                }

                categoryChildren.push({
                    type: "entry",
                    id,
                    name: await nameGetter?.(categoryId, id) ?? text,
                    content: [{
                        content: text,
                        multiline: true
                    }],
                    prev
                });
            }
        }
        else {
            for (const [ id, text ] of rows) {
                const prevNode = nodes[nodes.length - 1] as IEntryTreeNode;
                if (prevNode) {
                    prevNode.next = id;
                }

                nodes.push({
                    type: "entry",
                    id,
                    name: await nameGetter?.(null, id) ?? text,
                    content: [{
                        content: text,
                        multiline: true
                    }],
                    prev: prevNode?.id
                });
            }
        }

        return nodes;
    }

    protected override getHtmlForWebview(webview: vscode.Webview): string {
        return getEditorHtml(this.context.extensionUri, webview, "commonEditor", "Lyrics Editor");
    }
}