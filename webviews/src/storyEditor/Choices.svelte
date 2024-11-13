<script lang="ts">
    import { currentPath, currentTextSlots } from "../stores";
    import { translatedSlotProps } from "../utils";
    import Choice from "./Choice.svelte";
    import TextSlot from "../lib/TextSlot.svelte";
    import type { Writable } from "svelte/store";
    import { type IStoryTextSlot, StoryTextSlotType } from "../sharedTypes";

    export let translated: boolean = false;

    const slots = currentTextSlots as Writable<IStoryTextSlot[]>;
</script>

{#each {length: $slots.length - 2} as _, i}
    {@const index = i + 2}
    {@const slot = $slots[index]}
    {#if slot.userData?.type == StoryTextSlotType.Choice}
        {#if translated}
            <TextSlot inner={Choice} {...translatedSlotProps(slot)} {index} entryPath={$currentPath} />
        {:else}
            <TextSlot inner={Choice} readonly {...slot} />
        {/if}
    {/if}
{/each}