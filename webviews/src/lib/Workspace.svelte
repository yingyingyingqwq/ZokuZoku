<script lang="ts">
    import { onMount } from "svelte";
    import { vscode } from "../vscode";
    import type { ControllerMessage } from "../sharedTypes";

    export let inner;

    onMount(() => vscode.postMessage({ type: "init" }));

    function onMessage(e: MessageEvent<ControllerMessage>) {
        const message = e.data;
        switch (message.type) {
            case "undo": {
                document.execCommand("undo");
                break;
            }
            case "redo": {
                document.execCommand("redo");
                break;
            }
        }
    }
</script>

<svelte:window on:message={onMessage} />

<svelte:component this={inner} />