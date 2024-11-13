<script lang="ts">
    import type { ControllerMessage } from "../sharedTypes";
    import EditorInner from "./EditorInner.svelte";

    export let inner = EditorInner;

    function onMessage(e: MessageEvent<ControllerMessage>) {
        const message = e.data;
        switch (message.type) {
            case "setGameFont": {
                const font = new FontFace("CustomFont", `url(${message.uri})`);
                document.fonts.add(font);
                break;
            }
        }
    }
</script>

<svelte:window on:message={onMessage} />

<svelte:component this={inner} />