import * as vscode from 'vscode';
import { TABLE_NAMES } from '../editors/mdbEditor';

export default class MdbTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    static register(context: vscode.ExtensionContext): vscode.Disposable {
        return vscode.window.createTreeView('mdb', {
            treeDataProvider: new MdbTreeDataProvider
        });
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
        return TABLE_NAMES.map(name => {
            return {
                id: name,
                label: name,
                command: {
                    title: "ZokuZoku: Open MDB editor",
                    command: "zokuzoku.openMdbEditor",
                    arguments: [ name ]
                }
            };
        });
    }
}