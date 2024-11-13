/*
    Originally a part of AlexCovizzi/vscode-sqlite
    Licensed under Apache License 2.0

    Modified for ZokuZoku
*/

import { workspace, window } from "vscode";
import { ResultSet } from "./common";
import { executeQuery, QueryExecutionOptions } from "./queryExecutor";
import { validateSqliteCommand } from "./sqliteCommandValidation";
import { join } from "path";
import config from "../config";

class SQLite {
    private extensionPath: string;
    private sqliteCommand!: string;
    private mdbPath?: string;
    private metaPath?: string;

    constructor(extensionPath: string, sqliteCommand: string, mdbPath?: string, metaPath?: string) {
        this.extensionPath = extensionPath;
        this.setSqliteCommand(sqliteCommand);
        this.mdbPath = mdbPath;
        this.metaPath = metaPath;
    }

    private static _instance?: SQLite;
    static init(extensionPath: string) {
        let sqliteCommand = config().get<string>("sqlite3") ?? "sqlite3";
        let gameDataDir = config().get<string>("gameDataDir");
        let mdbPath = gameDataDir ? join(gameDataDir, "master", "master.mdb") : undefined;
        let metaPath = gameDataDir ? join(gameDataDir, "meta") : undefined;
        this._instance = new SQLite(extensionPath, sqliteCommand, mdbPath, metaPath);
    }

    static get instance(): SQLite {
        return this._instance!;
    }

    async query(dbPath: string, query: string, options?: QueryExecutionOptions): Promise<ResultSet> {
        if (!this.sqliteCommand) {
            throw new Error("Unable to execute query: provide a valid sqlite3 executable in the setting zokuzoku.sqlite3.");
        }

        const queryRes = await executeQuery(this.sqliteCommand, dbPath, query, options);
        if (queryRes.error) {
            throw queryRes.error;
        }
        return queryRes.resultSet!;
    }

    queryMdb(query: string, options?: QueryExecutionOptions): Promise<ResultSet> {
        if (!this.mdbPath) {
            throw new Error("Query cannot be performed because the game data directory is not set.");
        }
        return this.query(this.mdbPath, query, options);
    }

    queryMeta(query: string, options?: QueryExecutionOptions): Promise<ResultSet> {
        if (!this.metaPath) {
            throw new Error("Query cannot be performed because the game data directory is not set.");
        }
        return this.query(this.metaPath, query, options);
    }

    setSqliteCommand(sqliteCommand: string) {
        try {
            this.sqliteCommand = validateSqliteCommand(sqliteCommand, this.extensionPath);
        } catch (e) {
            let message = (e as Error).message;
            console.error(message);
            window.showErrorMessage(message);
            this.sqliteCommand = "";
        }
    }
}


export function buildQueryExecutionOptions(setupDatabaseConfig: { [dbPath: string]: { sql: string[]; } }, dbPath: string): QueryExecutionOptions {
    if (!workspace.workspaceFolders) {
        return { sql: [] };
    }
    for (let configDbPath in setupDatabaseConfig) {
        if (join(workspace.workspaceFolders[0].uri.fsPath, configDbPath) === dbPath) {
            let sql = setupDatabaseConfig[configDbPath].sql;
            return { sql };
        }
    }
    return { sql: [] };
}

export interface QueryResult {resultSet?: ResultSet; error?: Error; }

export default SQLite;