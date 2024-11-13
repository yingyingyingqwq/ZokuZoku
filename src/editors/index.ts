import * as vscode from "vscode";
import { LocalizeDictEditorProvider } from "./localizeDictEditor";
import { LyricsEditorProvider } from "./lyricsEditor";
import { MdbEditorProvider } from "./mdbEditor";
import { RaceStoryEditorProvider } from "./raceStoryEditor";
import { StoryEditorProvider } from "./storyEditor";

export function registerEditors(context: vscode.ExtensionContext): vscode.Disposable[] {
    return [
        LocalizeDictEditorProvider.register(context),
        LyricsEditorProvider.register(context),
        MdbEditorProvider.register(context),
        RaceStoryEditorProvider.register(context),
        StoryEditorProvider.register(context)
    ];
}