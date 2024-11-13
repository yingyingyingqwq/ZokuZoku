<script lang="ts">
    export let placeholder: string | null = null;
    export let value = "";
</script>

<input class="input-box" type="text" {placeholder} bind:value />

<style>
    .input-box {
        appearance: none;
        outline: none;
        border: none;
        background-color: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        font-size: 13px;
        padding: 6px 6px;
        border-radius: 2px;
        flex-grow: 1;
    }

    .input-box::placeholder {
        color: var(--vscode-input-placeholderForeground);
    }

    .input-box:focus {
        outline-color: var(--vscode-focusBorder);
        outline-offset: -1px;
        outline-style: solid;
        outline-width: 1px
    }
</style>
