<div class="slots-container">
    <slot />
</div>

<style>
    .slots-container {
        font-family: "CustomFont", var(--vscode-font-family);
        overflow: auto;
        display: flex;
        flex-direction: column;
        flex-grow: 1;
    }
</style>