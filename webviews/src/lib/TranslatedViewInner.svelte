<script lang="ts">
    import { currentPath, currentTextSlots } from "../stores";
    import type { IPanelAction } from "../types";
    import { translatedSlotProps } from "../utils";
    import GenericSlots from "./GenericSlots.svelte";
    import TextSlot from "./TextSlot.svelte";

    export const actions: (IPanelAction | null)[] | undefined = undefined;

    const placeholder = "在此输入你的翻译……";
</script>

<GenericSlots>
    {#key $currentTextSlots}
        {#each $currentTextSlots as slot, index}
            <TextSlot {...translatedSlotProps(slot)} {index} entryPath={$currentPath} {placeholder} />
        {/each}
    {/key}
</GenericSlots>