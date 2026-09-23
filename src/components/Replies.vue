<script setup lang="ts">
import { ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { supabase } from '../lib/supabase.ts'
import { useAuth } from '../composables/useAuth.ts';
import CodeTextarea from './CodeTextarea.vue';
import FormattedText from './FormattedText.vue';

type Replies ={
    id: number | string
    think_id: string
    text: string
    created_at: string
}

const props = defineProps<{
    thinkId: string
}>()
const emit = defineEmits<{
    (event: 'count-change', count: number | null): void
}>()
const replies = ref<Replies[]>([])
const text = ref('')
const isFetching = ref(false)
const isPosting = ref(false)
const FetcherrorMessage = ref('')
const PosterrorMessage = ref('')

const {
    user,
    isAuthReady
} = useAuth()

async function PostReplies(){
    if(!user.value) return
    const Textvalue = text.value.trim()
    if(!Textvalue || isPosting.value){
        return
    }
    isPosting.value = true
    PosterrorMessage.value = ''
    try {
        const { error } = await supabase.from('replies')
            .insert({
                think_id: props.thinkId,
                text: Textvalue,
                created_at: new Date()
            })
        if(error){
            throw error
        }
        console.log('Reply Inserting Successfull')
        text.value = ''
        await fetchReplies()
    } catch (error) {
        console.error('Reply Inserting Error:', error)
        PosterrorMessage.value = "Replyの作成に失敗しました。"
        return
    }finally{
        isPosting.value = false
    }
}

async function fetchReplies() {
    if(isFetching.value)return
    
    isFetching.value = true
    FetcherrorMessage.value = ''
    emit('count-change', null)
    try {
        const {data, error} = await supabase.from("replies")
            .select('*')
            .eq("think_id",props.thinkId )
            // ここで、ascendingをtrueにすることで、最新ポストを後に表示。
            .order('created_at', {
                ascending: true
            })
            .limit(100)
        if(error){
            throw error
        }
        replies.value = data ?? []
        emit('count-change', replies.value.length)
        FetcherrorMessage.value = ""
        console.log('Get Reply Successfull')
    } catch (error) {
        console.error('Fetch Reply Error:', error)
        FetcherrorMessage.value = "Replyの取得失敗しました。"
        return
    }finally{
        isFetching.value = false
    }

}
function formatCreatedAt(createdAt: string){
    return new Intl.DateTimeFormat('ja-jp', {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(createdAt))
}
watch(
    () => props.thinkId,
    () => {
        fetchReplies()
    },
    {immediate: true},
)
</script>
<template>
    <section class="discussion-card surface" aria-labelledby="discussion-title">
        <!-- <div class="section-card-head">
            <h2 id="discussion-title">会話</h2>
        </div> -->
        <p v-if="isFetching" class="status" role="status">会話を読み込んでいます...</p>
        <p v-else-if="FetcherrorMessage" class="status status--error" role="alert">{{ FetcherrorMessage }}</p>
        <p v-else-if="replies.length === 0" class="discussion-empty">まだ会話はありません。最初のひとことをどうぞ。</p>
        <ul v-else class="reply-list">
            <li v-for="reply in replies" :key="reply.id" class="reply-item">
                <div>
                    <time class="reply-time" :datetime="reply.created_at">{{ formatCreatedAt(reply.created_at) }}</time>
                    <FormattedText :text="reply.text" />
                </div>
            </li>
        </ul>

        <p v-if="!isAuthReady" class="status" role="status">認証状況を確認しています...</p>
        <form v-else-if="user" class="reply-form" @submit.prevent="PostReplies">
            <label for="reply-text">返信を書く</label>
            <CodeTextarea
                id="reply-text"
                v-model="text"
                name="reply-textarea"
                :disabled="isPosting"
                placeholder="考えや経験を書いてみましょう"
                rows="4"
            />
            <div class="reply-form-footer">
                <p v-if="PosterrorMessage" class="status status--error" role="alert">{{ PosterrorMessage }}</p>
                <button class="button button--primary" type="submit" :disabled="isPosting || !text.trim()">
                    {{ isPosting ? '投稿中...' : '投稿する' }}
                </button>
            </div>
        </form>
        <div v-else class="reply-guest">
            <p>返信するにはログインが必要です。</p>
            <RouterLink class="text-link" :to="{ name: 'login' }">ログイン</RouterLink>
        </div>
    </section>
</template>
