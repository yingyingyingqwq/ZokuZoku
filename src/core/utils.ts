import * as vscode from 'vscode';
import SQLite from '../sqlite';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export function addIndent(source: string, indent: string, addAtStart = false): string {
    if (indent.length) {
        let res = addAtStart ? indent : "";
        for (const c of source) {
            res += c;
            if (c === "\n") {
                res += indent;
            }
        }
        return res;
    }
    else {
        return source;
    }
}

export async function getTextDataCategory(category: number) {
    const dict: {[key: number]: string} = {};
    try {
        const mdbQueryRes = await SQLite.instance.queryMdb(`SELECT "index", "text" FROM text_data WHERE "category" = ${category}`);
        for (const row of mdbQueryRes[0].rows) {
            const [ index, text ] = row;
            dict[+index] = text;
        }
    }
    catch {}

    return dict;
}

const textDataCache: {[key: number]: {[key: number]: string}} = {};
export async function getTextDataCategoryCached(category: number) {
    let cache = textDataCache[category];
    if (!cache) {
        cache = await getTextDataCategory(category);
        textDataCache[category] = cache;
    }
    return cache;
}

export async function uriExists(uri: vscode.Uri): Promise<boolean> {
    try {
        await vscode.workspace.fs.stat(uri);
        return true;
    }
    catch {
        return false;
    }
}

export function makeActiveStatusLabel(label: string, active: boolean) {
    if (active) {
        return "[✔] " + label;
    }
    else {
        return "[   ] " + label;
    }
}

export function normalizeStoryId(id: string | number): string {
    id = id.toString();
    if (id.length < 9) {
        const count = 9 - id.length;
        id = "0".repeat(count) + id;
    }
    return id;
}

export function getStoryIdComponents(id: string | number): [string, string, string] {
    id = normalizeStoryId(id);
    return [id.slice(0, 2), id.slice(2, 6), id.slice(6)];
}

const DMM5_CONFIG_PATH = path.join(os.homedir(), "AppData", "Roaming", "dmmgameplayer5", "dmmgame.cnf");
let cachedInstallPath: string | undefined;
export async function getGameInstallPath(): Promise<string | undefined> {
    if (cachedInstallPath) {
        return cachedInstallPath;
    }

    try {
		let dmmConfig = JSON.parse(await fs.readFile(DMM5_CONFIG_PATH, { encoding: "utf8" }));
		for (const entry of dmmConfig.contents) {
			if (entry.productId === "umamusume") {
                cachedInstallPath = entry.detail.path;
				return cachedInstallPath;
			}
		}
	}
	catch {
	}
}

export async function updateHachimiConfig(callback: (config: any) => any) {
    const installPath = await getGameInstallPath();
    if (!installPath) {
        throw new Error("Failed to find game install path");
    }

    const configPath = path.join(installPath, "hachimi", "config.json");
    const data = JSON.parse(await fs.readFile(configPath, { encoding: "utf8" }));
    const res = await callback(data);
    if (res) {
        await fs.writeFile(configPath, JSON.stringify(res, null, 2), { encoding: "utf8" });
    }
    return res;
}