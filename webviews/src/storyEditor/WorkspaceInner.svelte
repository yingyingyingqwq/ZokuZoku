<script lang="ts">
    import Editor from "../lib/Editor.svelte";
    import Explorer from "../lib/Explorer.svelte";
    import EditorInner from "./EditorInner.svelte";
</script>

<main>
    <Explorer />
    <Editor inner={EditorInner} />
</main>

<style>
    main {
        display: flex;
        width: 100%;
        height: 100%;
    }
</style>