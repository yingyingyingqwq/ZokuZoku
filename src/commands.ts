import * as vscode from 'vscode';
import { LocalizeDictEditorProvider } from './editors/localizeDictEditor';
import { LocalizedDataManager, setActive, utils } from './core';
import config from './config';
import { LyricsEditorProvider } from './editors/lyricsEditor';
import { MdbEditorProvider, MdbTableName } from './editors/mdbEditor';
import HachimiIpc from './core/hachimiIpc';
import { EditorBase } from './editors/editorBase';
import StoriesTreeDataProvider from './views/storiesTreeDataProvider';
import HomeStoriesTreeDataProvider from './views/homeStoriesTreeDataProvider';
import MainStoriesTreeDataProvider from './views/mainStoryTreeDataProvider';
import LyricsTreeDataProvider from './views/lyricsTreeDataProvider';
import { RaceStoryEditorProvider } from './editors/raceStoryEditor';
import { StoryEditorProvider } from './editors/storyEditor';

type CommandTree = {[key: string]: ((...args: any[]) => any) | CommandTree};

const COMMANDS: CommandTree = {
    zokuzoku: {
        enable: () => {
            config().update("enabled", true, false);
            setActive(true);
        },

        openLocalizeDictEditor: () => {
            LocalizedDataManager.with(async ldManager => {
                const document = await ldManager.getPathUriAndOpenTextDocument("{}", "localize_dict", "localize_dict.json");
                vscode.commands.executeCommand("vscode.openWith", document.uri, LocalizeDictEditorProvider.viewType);
            });
        },

        openLyricsEditor: (songIndex?: string) => {
            if (!songIndex) {
                vscode.window.showErrorMessage("This command cannot be activated manually.");
                return;
            }
            LocalizedDataManager.with(async ldManager => {
                const document = await ldManager.getPathUriAndOpenTextDocument(
                    "{}", "assets_dir",
                    "assets", "lyrics", `m${songIndex}_lyrics.json`
                );
                vscode.commands.executeCommand("vscode.openWith", document.uri, LyricsEditorProvider.viewType);
            });
        },

        openMdbEditor: (tableName?: MdbTableName) => {
            if (!tableName) {
                vscode.window.showErrorMessage("This command cannot be activated manually.");
                return;
            }
            LocalizedDataManager.with(async ldManager => {
                const dictName = tableName + "_dict";
                MdbEditorProvider.nextTableName = tableName;
                try {
                    const document = await ldManager.getPathUriAndOpenTextDocument(
                        // @ts-ignore
                        "{}", dictName, `${dictName}.json`
                    );
                    vscode.commands.executeCommand("vscode.openWith", document.uri, MdbEditorProvider.viewType);
                }
                catch {
                    MdbEditorProvider.nextTableName = undefined;
                }
            });
        },

        openRaceStoryEditor: (storyId?: string | number) => {
            if (!storyId) {
                vscode.window.showErrorMessage("This command cannot be activated manually.");
                return;
            }
            const nStoryId = utils.normalizeStoryId(storyId);
            LocalizedDataManager.with(async ldManager => {
                const document = await ldManager.getPathUriAndOpenTextDocument(
                    "[]", "assets_dir",
                    "assets", "race", "storyrace", "text", `storyrace_${nStoryId}.json`
                );
                vscode.commands.executeCommand("vscode.openWith", document.uri, RaceStoryEditorProvider.viewType);
            });
        },

        openStoryEditor: (type?: "story" | "home", storyId?: string, categoryId?: string, groupId?: string) => {
            if (!type || !storyId) {
                vscode.window.showErrorMessage("This command cannot be activated manually.");
                return;
            }

            let relDictPath: string[];
            switch (type) {
                case "story":
                    if (!categoryId) {
                        categoryId = storyId.slice(0, 2);
                    }
                    if (!groupId) {
                        groupId = storyId.slice(2, 6);
                    }
                    const nStoryId = utils.normalizeStoryId(storyId);
                    relDictPath = ["story", "data", categoryId, groupId, `storytimeline_${nStoryId}.json`];
                    break;
                
                case "home":
                    if (!categoryId || !groupId) {
                        vscode.window.showErrorMessage("Missing arguments.");
                        return;
                    }
                    relDictPath = ["home", "data", categoryId, groupId, `hometimeline_${categoryId}_${groupId}_${storyId}.json`];
                    break;
            }

            LocalizedDataManager.with(async ldManager => {
                const document = await ldManager.getPathUriAndOpenTextDocument(
                    "{}", "assets_dir",
                    "assets", ...relDictPath
                );
                vscode.commands.executeCommand("vscode.openWith", document.uri, StoryEditorProvider.viewType);
            });
        },

        hachimi: {
            reloadLocalizedData: () => {
                HachimiIpc.callWithProgress({ type: "ReloadLocalizedData" }).catch(e => {
                    vscode.window.showErrorMessage("" + e);
                });
            }
        },

        stories:     { refresh: () => StoriesTreeDataProvider.instance?.refresh() },
        homeStories: { refresh: () => HomeStoriesTreeDataProvider.instance?.refresh() },
        mainStories: { refresh: () => MainStoriesTreeDataProvider.instance?.refresh() },
        lyrics:      { refresh: () => LyricsTreeDataProvider.instance?.refresh() }
    },

    undo: () => {
        if (EditorBase.activeWebview) {
            EditorBase.activeWebview.postMessage({ type: "undo" });
        }
        else {
            vscode.commands.executeCommand("default:undo");
        }
    },

    redo: () => {
        if (EditorBase.activeWebview) {
            EditorBase.activeWebview.postMessage({ type: "redo" });
        }
        else {
            vscode.commands.executeCommand("default:redo");
        }
    }
};

export function registerCommands(
    context: vscode.ExtensionContext, commandTree = COMMANDS, disposables: vscode.Disposable[] = [], prefix = ""
): vscode.Disposable[] {
    for (const name in commandTree) {
        let node = commandTree[name];
        if (typeof node === "function") {
            disposables.push(vscode.commands.registerCommand(prefix + name, node));
        }
        else {
            registerCommands(context, node, disposables, prefix + name + ".");
        }
    }

    return disposables;
}