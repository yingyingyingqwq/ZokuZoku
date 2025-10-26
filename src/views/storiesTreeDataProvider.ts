import * as vscode from 'vscode';
import SQLite from '../sqlite';
import { LocalizedDataManager, utils } from '../core';
import RefreshableTreeDataProviderBase from './refreshableTreeDataProviderBase';
import { whenReady } from '../extensionContext';

function queryCategories() {
    return SQLite.instance.queryMeta(
        "SELECT DISTINCT SUBSTR(n, 12, 2) FROM a WHERE n LIKE 'story/data/__/____/storytimeline\\__________' ESCAPE '\\'"
    );
}

function queryGroups(categoryId: string) {
    return SQLite.instance.queryMeta(
        `SELECT DISTINCT SUBSTR(n, 15, 4)
        FROM a WHERE n LIKE 'story/data/${categoryId}/____/storytimeline\\__________' ESCAPE '\\'`
    );
}

function queryStories(categoryId: string, groupId: string) {
    return SQLite.instance.queryMeta(
        `SELECT SUBSTR(n, 34, 9)
        FROM a WHERE n LIKE 'story/data/${categoryId}/${groupId}/storytimeline\\__________' ESCAPE '\\'`
    );
}

enum TreeLevel {
    None,
    Category,
    Group,
    Story
}

const categoryNames: {[key: string]: string} = {
    "01": vscode.l10n.t("Tutorial"),
    "02": vscode.l10n.t("Main Stories"),
    "04": vscode.l10n.t("Character Stories"),
    "08": vscode.l10n.t("Scenario Opening Stories"),
    "09": vscode.l10n.t("Story Event Stories"),
    "10": vscode.l10n.t("Anniversary Stories"),
    "11": vscode.l10n.t("Special Event Dialogues"),
    "12": vscode.l10n.t("New Year Lottery Dialogues"),
    "40": vscode.l10n.t("Scenario Training Events"),
    "50": vscode.l10n.t("Character Training Events"),
    "80": vscode.l10n.t("Support Card Training Events#1"),
    "82": vscode.l10n.t("Support Card Training Events#2"),
    "83": vscode.l10n.t("Support Card Training Events#3"),
};

async function getGroupName(categoryId: string, groupId: string): Promise<string | undefined> {
    switch (+categoryId) {
        case 4:
        case 50: {
            const characterNames = await utils.getTextDataCategoryCached(6);
            return characterNames[+groupId];
        }
        case 40:
            return (await utils.getTextDataCategory(119))[+groupId]?.replaceAll("\\n", " ");
    }
}

async function getStoryName(categoryId: string, storyId: string) {
    switch (+categoryId) {
        case 4:
            return (await utils.getTextDataCategory(92))[+storyId];
    }

    // Training events span across multiple categories
    return (await utils.getTextDataCategoryCached(181))[+storyId];
}

export default class StoriesTreeDataProvider extends RefreshableTreeDataProviderBase implements vscode.TreeDataProvider<vscode.TreeItem> {
    private static _instance?: StoriesTreeDataProvider;
    static get instance(): StoriesTreeDataProvider | undefined { return this._instance; }

    static register(context: vscode.ExtensionContext): vscode.Disposable {
        const treeDataProvider = new StoriesTreeDataProvider;
        StoriesTreeDataProvider._instance = treeDataProvider;

        const treeView = vscode.window.createTreeView('stories', {
            treeDataProvider
        });

        treeDataProvider.initRefreshWatcher(treeView, async () => {
            const dir = await LocalizedDataManager.instancePromise
                .then(m => m.getPathUri("assets_dir", undefined, "story", "data"));
            if (!dir) { return; }
            return new vscode.RelativePattern(dir, "**/*.json");
        });

        return treeView;
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
        await whenReady;

        const items: vscode.TreeItem[] = [];
        if (!element) {
            // Categories
            const result = await queryCategories();
            for (const [ id ] of result[0].rows) {
                let label = id;
                let name = categoryNames[id];
                if (name) {
                    label += ` ${name}`;
                }
                items.push({
                    id,
                    tooltip: id,
                    label,
                    collapsibleState: vscode.TreeItemCollapsibleState.Collapsed
                });
            }
        }
        else {
            const components = element.id!.split("/");
            const level = components.length as TreeLevel;
            const [ categoryId, groupId ] = components;

            switch (level) {
                case TreeLevel.Category: {
                    const result = await queryGroups(categoryId);
                    for (const [ groupId ] of result[0].rows) {
                        const itemId = `${categoryId}/${groupId}`;
                        let label = groupId;
                        let name = await getGroupName(categoryId, groupId);
                        if (name) {
                            label += ` ${name}`;
                        }
                        items.push({
                            id: itemId,
                            tooltip: itemId,
                            label,
                            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed
                        });
                    }
                    break;
                }
                case TreeLevel.Group: {
                    const ldManager = LocalizedDataManager.instance!;
                    const result = await queryStories(categoryId, groupId);
                    for (const [ storyId ] of result[0].rows) {
                        const itemId = `${categoryId}/${groupId}/${storyId}`;
                        let label = storyId.slice(6);
                        let name = await getStoryName(categoryId, storyId);
                        if (name) {
                            label += ` ${name}`;
                        }

                        const dictPath = await ldManager.getPathUri("assets_dir", undefined,
                            "story", "data", categoryId, groupId, `storytimeline_${storyId}.json`);
                        const dictExists = dictPath !== undefined && await utils.uriExists(dictPath);

                        items.push({
                            id: itemId,
                            tooltip: itemId,
                            label: utils.makeActiveStatusLabel(label, dictExists),
                            command: {
                                title: "ZokuZoku: Open story editor",
                                command: "zokuzoku.openStoryEditor",
                                arguments: [ "story", storyId ]
                            }
                        });
                    }
                    break;
                }
            }
        }

        return items;
    }
}