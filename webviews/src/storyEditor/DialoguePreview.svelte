<script lang="ts">
    import Choices from "./Choices.svelte";
    import DialogueTextFrame from "./DialogueTextFrame.svelte";

    export let translated: boolean = false;
</script>

<div class="dialogue-preview">
    <DialogueTextFrame {translated} />
    <Choices {translated} />
</div>

<style>
    .dialogue-preview {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
    }
</style>