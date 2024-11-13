import * as vscode from "vscode";

import StoriesTreeDataProvider from "./storiesTreeDataProvider";
import HomeStoriesTreeDataProvider from "./homeStoriesTreeDataProvider";
import MainStoriesTreeDataProvider from "./mainStoryTreeDataProvider";
import MdbTreeDataProvider from "./mdbTreeDataProvider";
import LyricsTreeDataProvider from "./lyricsTreeDataProvider";

export function registerViews(context: vscode.ExtensionContext): vscode.Disposable[] {
    return [
        StoriesTreeDataProvider.register(context),
        HomeStoriesTreeDataProvider.register(context),
        MainStoriesTreeDataProvider.register(context),
        MdbTreeDataProvider.register(context),
        LyricsTreeDataProvider.register(context)
    ];
}