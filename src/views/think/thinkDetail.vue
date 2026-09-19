<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { supabase } from '../../lib/supabase.ts'
import ReplyForm from '../../components/Replies.vue'
import Knowledge from '../../components/Knowledge.vue'
import { useAuth } from '../../composables/useAuth.ts'

type Think = {
    id: number | string
    text: string
}

type ThinkDetail = Think&{
    user_id: string
}
const { user } = useAuth();
const   think = ref<ThinkDetail | null>(null)
const relatedThinks = ref<Think[]>([])
const route = useRoute()
const isLoading = ref(false)
const isRelatedLoading = ref(false)
const errorMessage = ref('')
const relatedErrorMessage = ref('')
const discussCount = ref<number | null>(null)

const isThinkOwner = computed(() => {
    return (
        user.value !== null &&
        think.value !== null &&
        user.value.id === think.value.user_id
    )
})

function createBigrams(text: string): Set<string>{
    const normalizedText = text
        .toLocaleLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, '')
    
    const characters = [...normalizedText]
    if (characters.length === 0){
        return new Set()
    }
    if (characters.length === 1){
        return new Set(characters)
    }
    const bigrams = new Set<string>()
    for (let index = 0; index < characters.length -1; index++){
        bigrams.add(characters[index] + characters[index + 1])
    }
    return bigrams

}

function calculateSimilarity(currentText: string, candidateText: string): number{
    const currentBigrams = createBigrams(currentText)
    const candidateBigrams = createBigrams(candidateText)

    if (currentBigrams.size === 0 || candidateBigrams.size === 0){
        return 0
    }
    let matchingCount = 0
    for (const bigram of currentBigrams){
        if (candidateBigrams.has(bigram)){
            matchingCount++
        }
    }
    return matchingCount / Math.max(
        currentBigrams.size,
        candidateBigrams.size
    )
}


async function fetchRelatedThinkss(currentThink: Think){
    isRelatedLoading.value = true
    relatedErrorMessage.value = ''
    relatedThinks.value = []

    const { data, error } = await supabase.from('thinks')
        .select('id, text')
        .neq('id', currentThink.id)
        .limit(100)
    if (error){
        console.error('Thinks関連データ取得Error:', error)
        relatedErrorMessage.value = "関連Thinkに取得に失敗"
    }else{
        relatedThinks.value = (data ?? [])
            .map((candidate) => ({
                think: candidate,
                score: calculateSimilarity(
                    currentThink.text,
                    candidate.text
                )
            }))
            .filter(({score}) => score > 0)
            .sort((left, right) => right.score - left.score)
            .slice(0, 3)
            .map(({think}) => think)    
    }
    isRelatedLoading.value = false
}


async function fetchThinkDetail(thinkId: number | string){
    isLoading.value = true
    errorMessage.value = ''
    think.value = null
    relatedThinks.value = []

    const { data, error } = await supabase.from('thinks')
        .select('id, text, user_id')
        .eq('id', thinkId)
        .maybeSingle()
    
    if (error){
        console.error('Thinks個別データ取得Error:', error)
        errorMessage.value = 'Thinkの取得に失敗しました。'
    }else if (!data) {
        console.error('Thinks個別データ取得Error: データが存在しません。')
        errorMessage.value = 'Thinkが存在しません。'
    }else{
        console.log('Thinks個別データ取得成功')
        think.value = data
    }
    isLoading.value = false

    if(think.value){
        await fetchRelatedThinkss(think.value)
    }
}

watch(
    () => route.params.id,
    (id) => {
        if(typeof id === "string" || typeof id === "number"){
            fetchThinkDetail(id)
        }
    },
    { immediate: true }
)

</script>
<template>
    <main class="">
        <RouterLink
            :to="{
                name: 'home',
            }",
        >
         ← 一覧へ戻る
        </RouterLink>
        Thinks/Details
        <section>
            <!-- ここにID -->
            <div class="" v-if="isLoading">読み込み中...</div>
            <div class="" v-else-if="errorMessage">{{ errorMessage }}</div>
            <div class="" v-else-if="think">
                <h2>{{ think.text }}</h2>
            </div>
        </section>
        <section>
            <h2>関連するThinks</h2>
            <p v-if="isRelatedLoading">探しています...</p>
            <p v-else-if="relatedErrorMessage">{{ relatedErrorMessage }}</p>
            <p v-else-if="relatedThinks.length === 0">関連するThinkはまだありません。</p>
            <div v-else>
                <ul>
                    <li
                        v-for="relatedThink in relatedThinks"
                        :key="relatedThink.id"
                    >
                        <RouterLink
                            :to="{
                                name: 'think-detail',
                                params: {id: String(relatedThink.id)}
                            }"
                        >
                            {{ relatedThink.text }}
                        </RouterLink>
                    </li>
                </ul>
            </div>
        </section>
        <section >
            <ReplyForm
                v-if="think"
                :think-id="String(think.id)"
                @count-change="discussCount = $event"
            />
        <!-- ここに、Knowledgeコンポーネントを配置 -->
            <Knowledge
                v-if="think"
                :think-id="String(think.id)"
                :discuss-count="discussCount"
                :can-manage="isThinkOwner"
            />
        </section>
    </main>
</template>