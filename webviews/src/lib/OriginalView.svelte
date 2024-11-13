<script lang="ts">
    import type { IPanelAction } from "../types";
    import OriginalViewInner from "./OriginalViewInner.svelte";
    import PanelTitle from "./PanelTitle.svelte";
    import Sash from "./Sash.svelte";

    export let inner = OriginalViewInner;

    let actions: IPanelAction[] | undefined;
    let size = window.innerHeight / 2.1; // little bias for the translated view
</script>

<div class="original-view" style="height: {size}px;">
    <Sash horizontal bind:size maxSize={1000} />
    <PanelTitle label="Original" {actions} />
    <svelte:component this={inner} bind:actions />
</div>

<style>
    .original-view {
        position: relative;
        display: flex;
        flex-direction: column;
        border-bottom: 1px solid var(--vscode-tree-indentGuidesStroke);
    }
</style>