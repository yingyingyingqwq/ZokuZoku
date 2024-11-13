<script lang="ts">
    import Choices from "./Choices.svelte";
    import StoryTextFrame from "./StoryTextFrame.svelte";

    export let translated: boolean = false;
</script>

<div class="story-preview">
    <StoryTextFrame {translated} />
    <Choices {translated} />
</div>

<style>
    .story-preview {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
    }
</style>