<script setup lang="ts">
import { computed } from 'vue'

type TextBlock = {
    type: 'text' | 'code'
    content: string
    language?: string
}

const props = defineProps<{
    text: string
}>()

const blocks = computed<TextBlock[]>(() => {
    const result: TextBlock[] = []
    const codeBlockPattern = /```([^\n`]*)\n?([\s\S]*?)```/g
    let cursor = 0

    for (const match of props.text.matchAll(codeBlockPattern)) {
        const matchIndex = match.index ?? 0
        const textBeforeCode = props.text.slice(cursor, matchIndex)

        if (textBeforeCode) {
            result.push({ type: 'text', content: textBeforeCode })
        }

        result.push({
            type: 'code',
            language: match[1]?.trim() || undefined,
            content: (match[2] ?? '').replace(/^\n|\n$/g, '')
        })
        cursor = matchIndex + match[0].length
    }

    const remainingText = props.text.slice(cursor)
    if (remainingText) {
        result.push({ type: 'text', content: remainingText })
    }

    return result.length > 0 ? result : [{ type: 'text', content: props.text }]
})
</script>

<template>
    <div class="formatted-text">
        <template v-for="(block, index) in blocks" :key="index">
            <p v-if="block.type === 'text'" class="formatted-text-content">{{ block.content }}</p>
            <div v-else class="formatted-code-block">
                <span v-if="block.language" class="formatted-code-language">{{ block.language }}</span>
                <pre><code>{{ block.content }}</code></pre>
            </div>
        </template>
    </div>
</template>
