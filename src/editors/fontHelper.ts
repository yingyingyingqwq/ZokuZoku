import * as vscode from 'vscode';
import assetHelper from "../core/assetHelper";
import config from '../config';
import { ControllerMessage } from './sharedTypes';

async function getGameFontUri() {
    let assetPath = await assetHelper.loadGenericAsset("font/dynamic01.otf");
    return vscode.Uri.file(assetPath);
}

async function onInit(webview: vscode.Webview) {
    const useGameFont = config().get<boolean>("useGameFont");
    const customFont = config().get<string>("customFont");
    if (!useGameFont && !customFont) { return; }

    try {
        let uri: vscode.Uri;
        try {
            uri = customFont ? vscode.Uri.file(customFont) : await getGameFontUri();
        }
        catch (e) {
            throw new AggregateError([e], "Failed to load font asset");
        }
        const message: ControllerMessage = {
            type: "setGameFont",
            uri: webview.asWebviewUri(uri).toString()
        };
        await webview.postMessage(message);
    }
    catch (e) {
        vscode.window.showWarningMessage("Failed to load game font: " + e);
    }
}

export default {
    getGameFontUri,
    onInit
};