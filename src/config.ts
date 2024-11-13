import { workspace } from 'vscode';
export const CONFIG_SECTION = "zokuzoku";
export default () => workspace.getConfiguration(CONFIG_SECTION);