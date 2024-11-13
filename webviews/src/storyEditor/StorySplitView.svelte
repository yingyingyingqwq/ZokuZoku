<script lang="ts">
    import PreviewPanel from "./PreviewPanel.svelte";
    import StoryPreview from "./StoryPreview.svelte";
    import DialoguePreview from "./DialoguePreview.svelte";

    export let preview: "dialogue" | "story" | null = null;
    export let translated: boolean = false;

    let clientWidth: number;
</script>

<div class="split-container" bind:clientWidth>
    <slot />
    {#if preview}
        <PreviewPanel inner={preview == "dialogue" ? DialoguePreview : StoryPreview} {translated} maxSize={clientWidth/2} />
    {/if}
</div>

<style>
    .split-container {
        display: flex;
        flex-direction: row;
        flex: 1;
        overflow: auto;
    }
</style>