<script setup lang="ts">
import { ref, watch } from 'vue';
import { supabase } from '../lib/supabase.ts'
import { useAuth } from '../composables/useAuth.ts';

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
    <!-- <div>Discuss一覧</div>
    <p v-if="isFetching">読み込み中...</p>
    <p v-else-if="FetcherrorMessage">{{ FetcherrorMessage }}</p>
    <p v-else-if="replies.length === 0">Discussがまだありません。</p>
    <ul v-else>
        <li v-for="reply in replies" :key="reply.id">
            <span class="">
                {{ reply.id }} / {{ reply.created_at }} >>> {{ reply.think_id }}
            </span>
            <div class="">{{ reply.text }}</div>
        </li>
    </ul>

    <textarea v-model="text" name="" id="" class="" />
    <button @click="PostReplies">Discuss</button> -->
    <section aria-labelledby="discussion-title">
        <h2 class="title" id="discussion-title">Discuss</h2>

        <p v-if="isFetching">読み込み中...</p>

        <p v-else-if="FetcherrorMessage">{{ FetcherrorMessage }}</p>

        <p v-else-if="replies.length === 0">Discussはまだありません。</p>
        <ul v-else>
            <li v-for="reply in replies" :key="reply.id" class="">
                <span class="">
                    <p></p>
                    <time :datetime="reply.created_at">
                        {{ formatCreatedAt(reply?.created_at) }}
                    </time>
                </span>
                <p class="">
                    {{ reply.text }}
                </p>
            </li>
        </ul>
    </section>
    <section>
        <p v-if="!isAuthReady">認証確認中...</p>
        <form v-else-if="user" @submit.prevent="PostReplies">
            <label for="reply-text">返信を書く</label>

            <textarea
             name="reply-textarea"
             id="reply-text"
             v-model="text"
             :disabled="isPosting"
             placeholder="考えや経験を追加してください"
            ></textarea>

            <button
             type="submit"
             :disabled="isPosting || !text.trim()"
            >
             {{ isPosting ? '投稿中...' : 'Discuss' }}
            </button>

            <p v-if="PosterrorMessage">
                {{ PosterrorMessage }}
            </p>
        </form>
        <p v-else>
            Discussするにはログインしてください。
        </p>
    </section>
</template>