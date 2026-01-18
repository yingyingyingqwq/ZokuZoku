import '../app.css'
import "@vscode/codicons/dist/codicon.css"
import * as l10n from "@vscode/l10n"

if (window.l10nContents) {
    l10n.config({
        contents: window.l10nContents
    });
}

import('./App.svelte').then(({ default: App }) => {
    new App({
        target: document.getElementById('app')!,
    })
});
