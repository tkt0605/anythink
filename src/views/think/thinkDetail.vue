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

type VoyageCandidate = Think & {
    similarity: number
}

type RelatedThink = VoyageCandidate & {
    related_probability: number | null
}

type RankRelatedThinksResponse = {
    related_thinks: RelatedThink[]
    ranking_method: 'jev' | 'voyage_fallback'
    threshold: number
    cache_status: 'hit' | 'miss' | 'none' | 'pending' | 'unavailable'
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

async function fetchVoyageRelatedThinks(
    sourceThinkId: string
): Promise<RelatedThink[]> {
    const { data, error } = await supabase.rpc('match_thinks', {
        source_think_id: sourceThinkId,
        match_count: 3,
        match_threshold: 0
    })

    if (error) {
        throw error
    }

    const candidates = (data ?? []) as VoyageCandidate[]

    return candidates.map((candidate) => ({
        ...candidate,
        related_probability: null
    }))
}

async function fetchRelatedThinks(sourceThinkId: string) {
    isRelatedLoading.value = true
    relatedErrorMessage.value = ''
    relatedThinks.value = []

    try {
        const {
            data: { session },
            error: sessionError
        } = await supabase.auth.getSession()

        if (sessionError) {
            throw sessionError
        }

        if (session) {
            const { data, error } =
                await supabase.functions.invoke<RankRelatedThinksResponse>(
                    'rank-related-thinks',
                    {
                        body: {
                            sourceThinkId
                        }
                    }
                )

            if (error) {
                throw error
            }

            if (!data || !Array.isArray(data.related_thinks)) {
                throw new Error('関連Thinkのレスポンス形式が正しくありません。')
            }

            relatedThinks.value = data.related_thinks
            return
        }

        relatedThinks.value = await fetchVoyageRelatedThinks(sourceThinkId)
    } catch (error) {
        console.error('Thinks関連データ取得Error:', error)
        relatedErrorMessage.value = '関連する考えを読み込めませんでした。'
    } finally {
        isRelatedLoading.value = false
    }
}

async function retryRelatedThinks() {
    if (think.value) {
        await fetchRelatedThinks(think.value.id)
    }
}

function formatMatchProbability(probability: number) {
    const normalizedProbability = Math.min(Math.max(probability, 0), 1)
    return Math.round(normalizedProbability * 100)
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

            <section class="detail-sidebar" aria-labelledby="related-title">
                <div class="related-panel surface">
                    <h2 id="related-title">関連する考え</h2>
                    <p v-if="isRelatedLoading" class="status" role="status">関連する考えを探しています...</p>
                    <div v-else-if="relatedErrorMessage" class="related-error">
                        <p class="status status--error" role="alert">{{ relatedErrorMessage }}</p>
                        <button class="button button--ghost button--small" type="button" @click="retryRelatedThinks">
                            もう一度試す
                        </button>
                    </div>
                    <p v-else-if="relatedThinks.length === 0" class="related-empty">関連する考えは見つかりませんでした。</p>
                    <ul v-else class="related-list">
                        <li v-for="relatedThink in relatedThinks" :key="relatedThink.id">
                            <RouterLink :to="{ name: 'think-detail', params: { id: relatedThink.id } }">
                                <span class="related-think-text">{{ relatedThink.text }}</span>
                                <span
                                    v-if="relatedThink.related_probability !== null"
                                    class="match-badge"
                                >
                                    {{ formatMatchProbability(relatedThink.related_probability) }}%マッチ
                                </span>
                            </RouterLink>
                        </li>
                    </ul>
                </div>
            </section>
        </div>
    </main>
</template>
