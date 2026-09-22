<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type Knowledge = {
    id: string | number,
    think_id: string,
    summary: string,
    common_points: string | null,
    disagreements: string | null,
    open_questions: string | null,
    created_at: string,
    updated_at: string
}
type DistillResponse = {
    think_id: string,
    summary: string,
    common_points: string,
    disagreements: string,
    open_questions: string,
    cached: boolean,
    reply_count: number,
    generated_at: string,
    remaining_requests?: number
}
type DistillErrorResponse = {
    error?: string,
    code?: string,
    retry_after_seconds?: number
}
type DistillStatus = {
    reply_count: number,
    generated_at: string
}
const props = defineProps<{
    thinkId: string
    discussCount: number | null
    canManage: boolean
}>()

const knowledge = ref<Knowledge | null>(null)  
const summary = ref('')
const commonPoints = ref('')
const disAgreeMents = ref('')
const openQuestions = ref('')

const isFetchLoading = ref(false)
const isUpsertLoading = ref(false)

const UpsertErrorMessage = ref('')
const FetchErrorMessage = ref('')

const isDistilling = ref(false)
const distillErrorMessage = ref('')
const isDistillStatusLoading = ref(false)
const isDistillStatusReady = ref(false)
const lastDistilledReplyCount = ref<number | null>(null)

const hasNewDiscussion = computed(() => {
    if (props.discussCount === null || props.discussCount === 0) return false
    return props.discussCount > (lastDistilledReplyCount.value ?? 0)
})

const canDistill = computed(() => {
    return (
        props.canManage &&
        isDistillStatusReady.value &&
        hasNewDiscussion.value &&
        !isDistilling.value
    )
})

function formatRetryAfter(seconds?: number) {
    if (!seconds || seconds <= 0) return ''
    if (seconds < 60) return `${Math.ceil(seconds)}秒後にもう一度お試しください。`
    return `約${Math.ceil(seconds / 60)}分後にもう一度お試しください。`
}

async function getDistillError(error: unknown) {
    if (!(error instanceof FunctionsHttpError)) {
        return { status: 0, payload: null }
    }

    const response = error.context as Response
    let payload: DistillErrorResponse | null = null
    try {
        payload = await response.json() as DistillErrorResponse
    } catch {
        // The generic message below is used when the response is not JSON.
    }
    return { status: response.status, payload }
}

async function fetchDistillStatus() {
    const requestThinkId = props.thinkId
    lastDistilledReplyCount.value = null
    isDistillStatusReady.value = false
    distillErrorMessage.value = ''

    if (!props.canManage) return

    isDistillStatusLoading.value = true
    try {
        const { data, error } = await supabase
            .rpc('get_distill_status', { p_think_id: requestThinkId })
            .maybeSingle<DistillStatus>()

        if (error) throw error
        if (requestThinkId !== props.thinkId) return

        lastDistilledReplyCount.value = data?.reply_count ?? null
        isDistillStatusReady.value = true
    } catch (error) {
        console.error('Distill状態の取得に失敗:', error)
        if (requestThinkId === props.thinkId) {
            distillErrorMessage.value = '下書きの生成状態を確認できませんでした。'
        }
    } finally {
        if (requestThinkId === props.thinkId) {
            isDistillStatusLoading.value = false
        }
    }
}

async function distillKnowledge() {
    if(!canDistill.value){
        return
    }
    isDistilling.value = true
    distillErrorMessage.value = ''

    try {
        const { data, error } = await supabase.functions.invoke<DistillResponse>(
            'distill-knowledge',
            {
                body: {
                    thinkId: props.thinkId,
                },
            },
        )
        if (error){
            throw error
        }
        if(!data){
            throw new Error('蒸留結果がありません。')
        }

        summary.value = data.summary
        commonPoints.value = data.common_points
        disAgreeMents.value = data.disagreements
        openQuestions.value = data.open_questions
        lastDistilledReplyCount.value = data.reply_count
        isDistillStatusReady.value = true
    } catch (error) {
        console.error('Distill実行に失敗:', error)
        const { status, payload } = await getDistillError(error)
        const retryMessage = formatRetryAfter(payload?.retry_after_seconds)

        if (status === 409 || payload?.code === 'distill_in_progress') {
            distillErrorMessage.value = `現在生成中です。${retryMessage}`
        } else if (status === 429) {
            const limitMessage = payload?.error ?? '蒸留の回数制限に達しました。'
            distillErrorMessage.value = `${limitMessage}${retryMessage}`
        } else if (status === 403) {
            distillErrorMessage.value = 'このThinkを蒸留する権限がありません。'
        } else {
            distillErrorMessage.value = '下書きを作れませんでした。もう一度お試しください。'
        }
        return
    }finally{
        isDistilling.value = false
    }
}

function applyKnowledge(data: Knowledge | null){
    knowledge.value = data

    summary.value = data?.summary ?? ''
    commonPoints.value = data?.common_points ?? ''
    disAgreeMents.value = data?.disagreements ?? ''
    openQuestions.value = data?.open_questions ?? ''

}

async function upsertKnowledge() {
    const trimmedSummary = summary.value.trim()
    if( isUpsertLoading.value || !trimmedSummary || !props.canManage)return

    isUpsertLoading.value = true
    UpsertErrorMessage.value = ''

    try {
        const {data, error} = await supabase.from('knowledge')
            .upsert(
                {
                    think_id: props.thinkId,
                    summary: trimmedSummary,
                    common_points: commonPoints.value.trim() || null,
                    disagreements: disAgreeMents.value.trim() || null,
                    open_questions: openQuestions.value.trim() || null,
                    updated_at: new Date().toISOString(),
                },
                {
                    onConflict: "think_id"
                }
            )
            .select('*')
            .single()
        if (error){
            throw error
        }
        applyKnowledge(data)
    } catch (error) {
        console.error('Knowledge作成・更新に失敗:', error)
        UpsertErrorMessage.value = "まとめを保存できませんでした。もう一度お試しください。"
        return
    }finally{
        isUpsertLoading.value = false
    }
}

async function fetchKnowledge() {
    const requestThinkId = props.thinkId
    if (isFetchLoading.value) return

    isFetchLoading.value = true
    FetchErrorMessage.value = ''
    applyKnowledge(null)
    
    try {
        const { data, error } = await supabase.from('knowledge')
            .select('*')
            .eq('think_id', props.thinkId)
            .maybeSingle()
        if(error){
            throw error
        }
        if( requestThinkId !== props.thinkId ){
            return
        }
        applyKnowledge(data)
        console.log('Knowledge create Successfull')
    } catch (error) {
        console.error('Knowledgeの取得失敗:', error)
        FetchErrorMessage.value = "まとめを読み込めませんでした。"
        return
    }finally{
        if (requestThinkId === props.thinkId){
            isFetchLoading.value = false
        }
    }
}

function formatUpdateAt(updatedAt: string){
    return new Intl.DateTimeFormat('ja-jp', {
        dateStyle: 'medium',
        timeStyle: 'short'
    }).format(new Date(updatedAt))
}

watch(
    () => props.thinkId,
    () => {
        fetchKnowledge()
    },
    { immediate: true }
)

watch(
    [() => props.thinkId, () => props.canManage],
    () => {
        fetchDistillStatus()
    },
    { immediate: true }
)

</script>
<template>
    <section class="knowledge-card surface" aria-labelledby="knowledge-title">
        <div class="section-card-head">
            <h2 id="knowledge-title">まとめ</h2>
        </div>
        <p v-if="isFetchLoading" class="status" role="status">まとめを読み込んでいます...</p>

        <p v-else-if="FetchErrorMessage" class="status status--error" role="alert">{{ FetchErrorMessage }}</p>

        <template v-else>
            <article v-if="knowledge" class="knowledge-current">
                <h3 id="current-knowledge-title">現在のまとめ</h3>

                <section class="knowledge-section">
                    <h4>要約</h4>
                    <p>{{ knowledge.summary }}</p>
                </section>

                <section v-if="knowledge.common_points" class="knowledge-section">
                    <h4>共通している点</h4>
                    <p>{{ knowledge.common_points }}</p>
                </section>

                <section v-if="knowledge.disagreements" class="knowledge-section">
                    <h4>意見が分かれている点</h4>
                    <p>{{ knowledge.disagreements }}</p>
                </section>

                <section v-if="knowledge.open_questions" class="knowledge-section">
                    <h4>まだ解決してないもの</h4>
                    <p>{{ knowledge.open_questions }}</p>
                </section>

                <small class="knowledge-date">
                    最終更新：
                    <time :datetime="knowledge.updated_at">
                        {{ formatUpdateAt(knowledge.updated_at) }}
                    </time>
                </small>
            </article>

            <p v-else class="knowledge-empty">まだまとめはありません。</p>

            <article v-if="canManage" class="knowledge-editor">
                <h3>{{ knowledge ? 'まとめを編集' : 'まとめを作成' }}</h3>
                <button
                    class="button button--soft knowledge-distill"
                    type="button"
                    :disabled="!canDistill"
                    @click="distillKnowledge"
                >
                    <template v-if="isDistilling">下書きを作成中...</template>
                    <template v-else-if="isDistillStatusLoading">生成状態を確認中...</template>
                    <template v-else-if="discussCount === null">会話を確認中...</template>
                    <template v-else-if="discussCount === 0">会話が必要です</template>
                    <template v-else-if="knowledge">新しい会話から下書きを更新</template>
                    <template v-else>会話から下書きを作る</template>
                </button>

                <p
                    v-if="
                        isDistillStatusReady &&
                        discussCount !== null &&
                        discussCount > 0 &&
                        !hasNewDiscussion
                    "
                    class="status"
                >
                    新しい会話が追加されると再生成できます
                </p>
    
                <p v-if="distillErrorMessage" class="status status--error" role="alert">
                    {{ distillErrorMessage }}
                </p>
    
                <form class="knowledge-form" @submit.prevent="upsertKnowledge">
                    <div class="form-field">
                        <label for="knowledge-summary">要約</label>
                        <textarea
                         :disabled="isUpsertLoading"
                         id="knowledge-summary"
                         v-model="summary"
                         placeholder="全体の要約をしてください。"
                         required
                        ></textarea>
                    </div>
    
                    <div class="form-field">
                        <label for="knowledge-common">共通している点</label>
                        <textarea
                         :disabled="isUpsertLoading"
                         id="knowledge-common"
                         v-model="commonPoints"
                         placeholder="参加者の共通するものは？"
                        ></textarea>
                    </div>
    
                    <div class="form-field">
                        <label for="knowledge-disagree">意見が分かれている点</label>
                        <textarea
                         :disabled="isUpsertLoading"
                         id="knowledge-disagree"
                         v-model="disAgreeMents"
                         placeholder="意見が合わない所は？"
                        ></textarea>
                    </div>
                    
                    <div class="form-field">
                        <label for="knowledge-open-question">解決してない点</label>
                        <textarea
                         :disabled="isUpsertLoading"
                         id="knowledge-open-question"
                         v-model="openQuestions"
                         placeholder="解決してない所は？"
                        ></textarea>
                    </div>
    
                    <button
                        class="button button--primary"
                        type="submit"
                        :disabled="isUpsertLoading || !summary.trim()"
                    >
                        {{ isUpsertLoading ? '保存中...': knowledge ? '更新する' : '送信する'}}
                    </button>
                    <p v-if="UpsertErrorMessage" class="status status--error" role="alert">
                        {{ UpsertErrorMessage }}
                    </p>
                </form>
            </article>
        </template>
    </section>
</template>
