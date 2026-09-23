<script setup lang="ts">
import { nextTick, ref } from 'vue'

defineOptions({ inheritAttrs: false })

const model = defineModel<string>({ required: true })
const props = defineProps<{
    id: string
    disabled?: boolean
}>()

const textarea = ref<HTMLTextAreaElement | null>(null)

async function insertCodeBlock() {
    if (props.disabled) return

    const element = textarea.value
    const start = element?.selectionStart ?? model.value.length
    const end = element?.selectionEnd ?? model.value.length
    const selectedText = model.value.slice(start, end)
    const code = selectedText || 'コードを入力'
    const prefix = start > 0 && model.value[start - 1] !== '\n' ? '\n' : ''
    const suffix = end < model.value.length && model.value[end] !== '\n' ? '\n' : ''
    const fencedCode = `${prefix}\`\`\`\n${code}\n\`\`\`${suffix}`

    model.value = `${model.value.slice(0, start)}${fencedCode}${model.value.slice(end)}`

    await nextTick()
    element?.focus()

    const codeStart = start + prefix.length + 4
    element?.setSelectionRange(codeStart, codeStart + code.length)
}
</script>

<template>
    <div class="code-textarea">
        <div class="code-textarea-toolbar" aria-label="入力補助">
            <span>プレーンテキスト</span>
            <button
                class="code-block-button"
                type="button"
                :disabled="disabled"
                @click="insertCodeBlock"
            >
                <code>```</code>
                コードブロック
            </button>
        </div>
        <textarea
            :id="id"
            ref="textarea"
            v-model="model"
            v-bind="$attrs"
            :disabled="disabled"
        ></textarea>
        <small class="code-textarea-help">コードは ``` で囲むと、投稿後も読みやすく表示されます。</small>
    </div>
</template>
