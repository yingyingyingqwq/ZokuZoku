<script lang="ts">
    import { currentTextSlots } from "../stores";
    import type { IPanelAction } from "../types";
    import GenericSlots from "./GenericSlots.svelte";
    import TextSlot from "./TextSlot.svelte";

    export const actions: (IPanelAction | null)[] | undefined = undefined;
</script>

<GenericSlots>
    {#each $currentTextSlots as slot}
        <TextSlot readonly {...slot} />
    {/each}
</GenericSlots>