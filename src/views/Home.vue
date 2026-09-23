<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { supabase } from '../lib/supabase.ts'
import { RouterLink } from 'vue-router' 

import { useAuth } from '../composables/useAuth.ts'
import CodeTextarea from '../components/CodeTextarea.vue'
import FormattedText from '../components/FormattedText.vue'

// Think型の定義
type Think = {
    id: number | string
    text: string
    is_public: boolean
}
type CreateThinkResponse = {
    think: Think
    embedding_created: boolean
}
// type Visibility = 'public' | 'private'

// const visibility = ref<Visibility>('public')

const text = ref('')
// Think型を格納する配列としてthinksを初期化
const thinks = ref<Think[]>([])
// Loading用の引数
const isLoading = ref(false)
// エラーメッセージ用の引数
const errorMessage = ref('')
// 公開・非公開の判断
const isPrivate = ref(false)

const {
    user,
    isAuthReady
}= useAuth()


async function createThinks() {
    if(!user.value) return
    const trimmedText = text.value.trim()
    if (!trimmedText) return

    isLoading.value = true
    errorMessage.value = ""

    try {
        const { data, error } = await supabase.functions.invoke<CreateThinkResponse>(
            'create-think',
            {
                body: {
                    text: trimmedText,
                    is_public: !isPrivate.value
                },
            },
        )
        if(error){
            throw error
        }
        if(!data?.think){
            throw new Error("作成されたThinkが返されませんでした。");
        }
        if(!data.embedding_created){
            console.warn(
                'Thinkは作成されました。しかし、Embeddingは生成されませんでした。'
            )
        }

        text.value = ""
        isPrivate.value = false
        // await fetchThinks()
        thinks.value.unshift(data.think)
    } catch (error) {
        console.error('Error Creating Error:', error)
        errorMessage.value = "投稿できませんでした。もう一度お試しください。"
        return
    }finally{
        isLoading.value = false
    }
}

async function fetchThinks() {
    isLoading.value = true
    errorMessage.value = ''

    try {
        const { data, error } = await supabase
            .from('thinks')
        .select('id, text, is_public')
            .order('created_at', {
                ascending: false
            })
        if (error){
            throw error
        }
        thinks.value = data ?? []
        errorMessage.value = ""

    } catch (error) {
        console.error('Error Fetching Data:', error)
        errorMessage.value = '一覧の取得に失敗しました。'
        return
    }finally{
        isLoading.value = false
    }
}

onMounted(fetchThinks)
</script>

<template>
    <main id="main-content" class="feed-main page-shell">
        <h1 class="visually-hidden">みんなの考え</h1>

        <div class="feed-layout">
            <section class="composer-card surface" aria-labelledby="composer-title">
                <!-- <h2 id="composer-title">考えを書く</h2> -->

                <p v-if="!isAuthReady" class="status" role="status">認証状況を確認しています...</p>
                <form v-else-if="user" class="composer-form" @submit.prevent="createThinks">
                    <label class="visually-hidden" for="think-text">考えを書く</label>
                    <CodeTextarea
                        id="think-text"
                        v-model="text"
                        placeholder="思いついたことを書く"
                        :disabled="isLoading"
                        rows="5"
                    />
                    <div class="composer-footer">
                        <div class="visibility-field">
                            <label for="think-visibility">公開範囲</label>
                            <div
                                class="visibility-select-wrap"
                                :class="{ 'visibility-select-wrap--private': isPrivate }"
                            >
                                <svg
                                    v-if="isPrivate"
                                    class="visibility-icon"
                                    viewBox="0 0 24 24"
                                    aria-hidden="true"
                                >
                                    <path d="M7 10V8a5 5 0 0 1 10 0v2m-11 0h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Zm6 4v2" />
                                </svg>
                                <select
                                    id="think-visibility"
                                    v-model="isPrivate"
                                    :disabled="isLoading"
                                    aria-describedby="visibility-description"
                                    class="visibility-select"
                                >
                                    <option :value="false">公開</option>
                                    <option :value="true">非公開</option>
                                </select>
                            </div>
                            <small id="visibility-description" class="visibility-description">
                                {{ isPrivate ? '自分だけが見られます' : 'みんなが見られます' }}
                            </small>
                        </div>
                        <button class="button button--primary" type="submit" :disabled="isLoading || !text.trim()">
                            {{ isLoading ? '投稿中...' : '投稿する' }}
                        </button>
                    </div>
                </form>
                <div v-else class="composer-guest">
                    <p>ログインすると投稿できます。</p>
                    <RouterLink class="button button--ghost" :to="{ name: 'login' }">ログイン</RouterLink>
                </div>
            </section>

            <section class="feed-section" aria-labelledby="feed-title">
                <!-- <div class="feed-section-head">
                    <h2 id="feed-title">投稿</h2>
                </div> -->

                <p v-if="isLoading" class="status surface" role="status">投稿を読み込んでいます...</p>
                <p v-else-if="errorMessage" class="status status--error" role="alert">{{ errorMessage }}</p>
                <div v-else-if="thinks.length === 0" class="empty-state surface">
                    <h3>まだ投稿がありません。</h3>
                </div>
                <ul v-else class="think-list">
                    <li v-for="think in thinks" :key="think.id" class="think-card surface">
                        <RouterLink
                            class="think-card-link"
                            :to="{ name: 'think-detail', params: { id: think.id } }"
                        >
                            <small
                                v-if="!think.is_public"
                                class="visibility-badge visibility-badge--private"
                            >
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                    <path d="M7 10V8a5 5 0 0 1 10 0v2m-11 0h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Zm6 4v2" />
                                </svg>
                                非公開
                            </small>
                            <FormattedText class="think-card-text" :text="think.text" />
                            <span class="think-card-bottom">会話を見る</span>
                        </RouterLink>
                    </li>
                </ul>
            </section>
        </div>
    </main>
</template>
