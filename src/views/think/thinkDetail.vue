<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { supabase } from '../../lib/supabase.ts'
import ReplyForm from '../../components/Replies.vue'
import Knowledge from '../../components/Knowledge.vue'
import { useAuth } from '../../composables/useAuth.ts'

type Think = {
    id: string
    text: string
}

type ThinkDetail = Think&{
    user_id: string
}

type RelatedThink = Think & {
    similarity: number | string
}
const { user } = useAuth();
const   think = ref<ThinkDetail | null>(null)
const relatedThinks = ref<RelatedThink[]>([])
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

// function createBigrams(text: string): Set<string>{
//     const normalizedText = text
//         .toLocaleLowerCase()
//         .replace(/[^\p{L}\p{N}]+/gu, '')
    
//     const characters = [...normalizedText]
//     if (characters.length === 0){
//         return new Set()
//     }
//     if (characters.length === 1){
//         return new Set(characters)
//     }
//     const bigrams = new Set<string>()
//     for (let index = 0; index < characters.length -1; index++){
//         bigrams.add(characters[index] + characters[index + 1])
//     }
//     return bigrams

// }

// function calculateSimilarity(currentText: string, candidateText: string): number{
//     const currentBigrams = createBigrams(currentText)
//     const candidateBigrams = createBigrams(candidateText)

//     if (currentBigrams.size === 0 || candidateBigrams.size === 0){
//         return 0
//     }
//     let matchingCount = 0
//     for (const bigram of currentBigrams){
//         if (candidateBigrams.has(bigram)){
//             matchingCount++
//         }
//     }
//     return matchingCount / Math.max(
//         currentBigrams.size,
//         candidateBigrams.size
//     )
// }


// async function fetchRelatedThinkss(currentThink: Think){
//     isRelatedLoading.value = true
//     relatedErrorMessage.value = ''
//     relatedThinks.value = []

//     const { data, error } = await supabase.from('thinks')
//         .select('id, text')
//         .neq('id', currentThink.id)
//         .limit(100)
//     if (error){
//         console.error('Thinks関連データ取得Error:', error)
//         relatedErrorMessage.value = "関連する考えを読み込めませんでした。"
//     }else{
//         relatedThinks.value = (data ?? [])
//             .map((candidate) => ({
//                 think: candidate,
//                 score: calculateSimilarity(
//                     currentThink.text,
//                     candidate.text
//                 )
//             }))
//             .filter(({score}) => score > 0)
//             .sort((left, right) => right.score - left.score)
//             .slice(0, 3)
//             .map(({think}) => think)    
//     }
//     isRelatedLoading.value = false
// }

async function fetchRelatedThinks(sourceThinkId: string) {
    isRelatedLoading.value = true
    relatedErrorMessage.value = ''
    relatedThinks.value = []
    const { data, error } = await supabase.rpc('match_thinks', {
        source_think_id: sourceThinkId,
        match_count: 3,
        match_threshold: 0
    });
    if(error){
        console.error('Thinks関連データ取得Error:')
        relatedErrorMessage.value = "関連する考えを読み込めませんでした。"    
        throw error
    }else{
        relatedThinks.value = ( data ?? []) as RelatedThink[]
    }
    isRelatedLoading.value = false
}

async function fetchThinkDetail(thinkId: string){
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
        errorMessage.value = '考えを読み込めませんでした。'
    }else if (!data) {
        console.error('Thinks個別データ取得Error: データが存在しません。')
        errorMessage.value = 'この考えは見つかりませんでした。'
    }else{
        console.log('Thinks個別データ取得成功')
        think.value = data
    }
    isLoading.value = false

    if(think.value){
        await fetchRelatedThinks(think.value.id)
    }
}

watch(
    () => route.params.id,
    (id) => {
        if(typeof id === "string" ){
            fetchThinkDetail(id)
        }
    },
    { immediate: true }
)

</script>
<template>
    <main id="main-content" class="detail-main page-shell">
        <h1 class="visually-hidden">考えの詳細</h1>
        <RouterLink class="back-link" :to="{ name: 'home' }">← 投稿一覧に戻る</RouterLink>

        <div class="detail-layout">
            <div class="detail-primary">
                <section class="thought-card surface" aria-label="元の考え">
                    <p v-if="isLoading" class="status" role="status">考えを読み込んでいます...</p>
                    <p v-else-if="errorMessage" class="status status--error" role="alert">{{ errorMessage }}</p>
                    <h2 v-else-if="think" class="thought-text">{{ think.text }}</h2>
                </section>

                <ReplyForm
                    v-if="think"
                    :think-id="String(think.id)"
                    @count-change="discussCount = $event"
                />
                <Knowledge
                    v-if="think"
                    :think-id="String(think.id)"
                    :discuss-count="discussCount"
                    :can-manage="isThinkOwner"
                />
            </div>

            <aside class="detail-sidebar" aria-labelledby="related-title">
                <section class="related-panel surface">
                    <h2 id="related-title">関連する考え</h2>
                    <p v-if="isRelatedLoading" class="status" role="status">探しています...</p>
                    <p v-else-if="relatedErrorMessage" class="status status--error" role="alert">{{ relatedErrorMessage }}</p>
                    <p v-else-if="relatedThinks.length === 0" class="related-empty">関連する考えはまだありません。</p>
                    <ul v-else class="related-list">
                        <li v-for="relatedThink in relatedThinks" :key="relatedThink.id">
                            <RouterLink :to="{ name: 'think-detail', params: { id: String(relatedThink.id) } }">
                                <span>{{ relatedThink.text }}</span>
                                <span aria-hidden="true">→</span>
                            </RouterLink>
                        </li>
                    </ul>
                </section>
            </aside>
        </div>
    </main>
</template>
