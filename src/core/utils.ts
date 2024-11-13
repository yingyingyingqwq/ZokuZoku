import * as vscode from 'vscode';
import SQLite from '../sqlite';

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