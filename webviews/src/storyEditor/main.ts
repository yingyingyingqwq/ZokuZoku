import '../app.css'
import "@vscode/codicons/dist/codicon.css"
import App from './App.svelte'
import initSync from "hachimi_lib";

initSync();

const app = new App({
    target: document.getElementById('app')!,
})

export default app
