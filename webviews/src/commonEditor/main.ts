import '../app.css'
import "@vscode/codicons/dist/codicon.css"
import App from './App.svelte'

const app = new App({
    target: document.getElementById('app')!,
})

export default app
