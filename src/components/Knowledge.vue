<script setup lang="ts">
import { ref, watch } from 'vue';
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
    open_questions: string
}
const props = defineProps<{
    thinkId: string
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

async function distillKnowledge() {
    if(isDistilling.value){
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
    } catch (error) {
        console.error('Distill実行に失敗:', error)
        distillErrorMessage.value = '会話の蒸留に失敗しました。'
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

    if(isUpsertLoading.value || !trimmedSummary ){
        return
    }
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
        UpsertErrorMessage.value = "Knowledge作成・更新に失敗しました。"
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
        FetchErrorMessage.value = "knowledgeの取得に失敗しました。"
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
</script>
<template>
    <section aria-labelledby="knowledge-title">
        <h2 id="knowledge-title">Knoweldge</h2>

        <p v-if="isFetchLoading">読み込んでます...</p>

        <p v-else-if="FetchErrorMessage">{{ FetchErrorMessage }}</p>

        <template v-else>
            <article v-if="knowledge">
                <h3 id="current-knowledge-title">現在のKnowledge</h3>

                <section>
                    <h4>要約</h4>
                    <p>{{ knowledge.summary }}</p>
                </section>

                <section v-if="knowledge.common_points">
                    <h4>共通している点</h4>
                    <p>{{ knowledge.common_points }}</p>
                </section>

                <section v-if="knowledge.disagreements">
                    <h4>意見が分かれている点</h4>
                    <p>{{ knowledge.disagreements }}</p>
                </section>

                <section v-if="knowledge.open_questions">
                    <h4>まだ解決してないもの</h4>
                    <p>{{ knowledge.open_questions }}</p>
                </section>

                <small>
                    最終更新：
                    <time :datetime="knowledge.updated_at">
                        {{ formatUpdateAt(knowledge.updated_at) }}
                    </time>
                </small>
            </article>

            <p v-else>Knowledgeはまだありません。</p>

            <button
                type="button"
                :disabled="isDistilling"
                @click="distillKnowledge"
            >
                {{ 
                    isDistilling
                        ? "会話を整理してます..."
                        : "会話を蒸留する"
                }}
            </button>

            <p v-if="distillErrorMessage">
                {{ distillErrorMessage }}
            </p>

            <!-- 新規作成フォーム -->
            <form @submit.prevent="upsertKnowledge">
                <h3>
                    {{ knowledge ? "knowledgeを更新" : "knowledgeを作成" }}
                </h3>

                <div>
                    <label for="knowledge-summary">要約</label>
                    <textarea
                     :disabled="isUpsertLoading"
                     id="knowledge-summary"
                     v-model="summary"
                     placeholder="全体の要約をしてください。"
                     required
                    ></textarea>
                </div>

                <div>
                    <label for="knowledge-common">共通している点</label>
                    <textarea
                     :disabled="isUpsertLoading"
                     id="knowledge-common"
                     v-model="commonPoints"
                     placeholder="参加者の共通するものは？"
                    ></textarea>
                </div>

                <div>
                    <label for="knowledge-disagree">意見が分かれている点</label>
                    <textarea
                     :disabled="isUpsertLoading"
                     id="knowledge-agree"
                     v-model="disAgreeMents"
                     placeholder="意見が合わない所は？"
                    ></textarea>
                </div>
                
                <div>
                    <label for="knowledge-open-question">解決してない点</label>
                    <textarea
                     :disabled="isUpsertLoading"
                     id="knowledge-open-question"
                     v-model="openQuestions"
                     placeholder="解決してない所は？"
                    ></textarea>
                </div>

                <!-- ここでは、Knowledgeがあるかないかで`更新`か`送信`を判断している。 -->
                <button
                    type="submit"
                    :disabled="isUpsertLoading || !summary.trim()"
                >
                    {{ isUpsertLoading ? '保存中...': knowledge ? '更新する' : '送信する'}}
                </button>
                <!-- エラーハンドリング -->
                <p v-if="UpsertErrorMessage">
                    {{ UpsertErrorMessage }}
                </p>
            </form>
        </template>
    </section>
</template>