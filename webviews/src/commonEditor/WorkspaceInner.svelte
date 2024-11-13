<script lang="ts">
    import Editor from "../lib/Editor.svelte";
    import Explorer from "../lib/Explorer.svelte";
</script>

<main>
    <Explorer />
    <Editor />
</main>

<style>
    main {
        display: flex;
        width: 100%;
        height: 100%;
    }
</style>