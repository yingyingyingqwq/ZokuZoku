<script lang="ts">
    import { isolateTags } from "hachimi_lib";

    export let content: string;
    export let sizeMultiplier: number;
    $: display = makeDisplay(content);

    interface Section {
        chunk: string,
        size?: number
    }

    function makeDisplay(content: string) {
        const res: Section[] = [];
        const sections = isolateTags(content);
        for (let i = 0; i < sections.length;) {
            const { chunk, is_tag } = sections[i];
            if (is_tag && chunk.startsWith("<size=")) {
                const size = +chunk.slice(6, -1) * sizeMultiplier;
                if (!isNaN(size)) {
                    let valid = false;
                    let tmp = "";
                    for (let j = i + 1; j < sections.length; ++j) {
                        const { chunk, is_tag } = sections[j];
                        if (is_tag && chunk == "</size>") {
                            valid = true;
                            i = j + 1;
                            res.push({ chunk: tmp, size });
                            break;
                        }
                        tmp += chunk;
                    }
                    if (valid) continue;
                }
            }

            res.push({ chunk });
            ++i;
        }
        return res;
    }
</script>

{#each display as { chunk, size }}
    {#if size != null}
        <span style="font-size: {size}cqh;">{chunk}</span>
    {:else}
        {chunk}
    {/if}
{/each}