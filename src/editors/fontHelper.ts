import * as vscode from 'vscode';
import assetHelper from "../core/assetHelper";
import config from '../config';
import { ControllerMessage } from './sharedTypes';

const FONT_ASSET_NAME = "font/dynamic01.otf";
let gameFontUri: vscode.Uri | undefined;
async function getGameFontUri() {
    if (!gameFontUri) {
        const hash = await assetHelper.getAssetHash(FONT_ASSET_NAME);
        if (!hash || !(await assetHelper.tryDownloadGenericAssetByHash(hash))) {
            return;
        }
        const { bundlePath } = assetHelper.getAssetPath(hash);
        gameFontUri = vscode.Uri.file(bundlePath);
    }
    return gameFontUri;
}

async function onInit(webview: vscode.Webview) {
    const useGameFont = config().get<boolean>("useGameFont");
    const customFont = config().get<string>("customFont");
    if (!useGameFont && !customFont) { return; }

    try {
        const uri = customFont ? vscode.Uri.file(customFont) : await getGameFontUri();
        if (!uri) {
            throw new Error("Font asset not found or failed to download");
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