<script lang="ts">
    import Sash from "../lib/Sash.svelte";
    import DialoguePreview from "./DialoguePreview.svelte";

    export let inner = DialoguePreview;
    export let translated: boolean = false;
    export let maxSize: number;

    let size = 350;
</script>

<div class="preview-panel" style="width: {Math.min(size, maxSize)}px;">
    <Sash left bind:size {maxSize} />
    <svelte:component this={inner} {translated} />
</div>

<style>
    .preview-panel {
        position: relative;
        display: flex;
        flex-direction: column;
        border-left: 1px solid var(--vscode-tree-indentGuidesStroke);
        border-top: 1px solid var(--vscode-tree-inactiveIndentGuidesStroke);
        flex: 0 0 auto;
        overflow-x: hidden;
    }
</style>