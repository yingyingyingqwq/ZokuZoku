<script lang="ts">
    import { StoryTextSlotType, type ControllerMessage, type IStoryTextSlot } from "../sharedTypes";
    import { currentPath, currentTextSlots } from "../stores";
    import { vscode } from "../vscode";

    export let content: string;
    export let translated: boolean = false;
    $: ({ colorTextList, startSlot } = updateColorText($currentTextSlots));
    $: display = makeDisplay(content, colorTextList);

    function updateColorText(textSlots: IStoryTextSlot[]) {
        let colorTextList: string[] = [];
        let startSlot = textSlots.length;

        for (let i = 2; i < textSlots.length; ++i) {
            const slot = textSlots[i];
            if (slot.userData?.type == StoryTextSlotType.ColorText) {
                if (startSlot == textSlots.length) startSlot = i;
                if (translated) {
                    colorTextList.push("");
                    vscode.postMessage({
                        type: "getTextSlotContent",
                        entryPath: $currentPath,
                        index: i
                    });
                }
                else {
                    colorTextList.push(slot.content);
                }
            }
        }

        return { colorTextList, startSlot };
    }

    function makeDisplay(content: string, colorTextList: string[]) {
        const res: { chunk: string, isColorText: boolean }[] = [];
        let prevEnd = 0;
        for (let i = 0; i < content.length;) {
            let found = false;
            for (const text of colorTextList) {
                if (text && content.startsWith(text, i)) {
                    if (i != prevEnd) {
                        res.push({
                            chunk: content.slice(prevEnd, i),
                            isColorText: false
                        });
                    }
                    const end = i + text.length;
                    res.push({
                        chunk: content.slice(i, end),
                        isColorText: true
                    });
                    prevEnd = end;
                    i = end;
                    found = true;
                    break;
                }
            }
            if (!found) ++i;
        }
        if (prevEnd < content.length) {
            res.push({
                chunk: content.slice(prevEnd, content.length),
                isColorText: false
            });
        }
        return res;
    }

    let onMessage: ((e: MessageEvent<ControllerMessage>) => void) | undefined;
    if (translated) {
        onMessage = e => {
            const message = e.data;
            if (message.type == "setTextSlotContent") {
                if (message.entryPath.join("/") == $currentPath.join("/") &&
                    message.index >= startSlot
                ) {
                    colorTextList[message.index - startSlot] = message.content ?? "";
                }
            }
        }
    }
</script>

<svelte:window on:message={onMessage} />

{#each display as { chunk, isColorText }}
    {#if isColorText}
        <span class="color-text">{chunk}</span>
    {:else}
        {chunk}
    {/if}
{/each}

<style>
    .color-text {
        color: #ff911c;
    }
</style>