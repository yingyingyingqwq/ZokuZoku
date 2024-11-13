export * from "./localizedDataManager";
export * from "./jsonDocument";
export * as utils from "./utils"; // workaround, dynamic import woes
export { default as downloader } from "./downloader";

import * as vscode from 'vscode';
import { LocalizedDataManager } from './localizedDataManager';

export function setActive(value: boolean) {
	vscode.commands.executeCommand("setContext", "zokuzoku.active", value);

    if (value) {
        LocalizedDataManager.init();
    }
    else {
        LocalizedDataManager.uninit();
    }
}