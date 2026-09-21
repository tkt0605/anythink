<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { supabase } from '../lib/supabase.ts'
import { RouterLink } from 'vue-router' 

import { useAuth } from '../composables/useAuth.ts'

// Think型の定義
type Think = {
    id: number | string
    text: string
    is_public: boolean
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
        const { error } = await supabase
            .from('thinks')
            .insert({
                text: trimmedText,
                is_public: !isPrivate.value
            })
        if(error) throw error
        text.value = ""
        isPrivate.value = false
        await fetchThinks()
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
                <h2 id="composer-title">考えを書く</h2>

                <p v-if="!isAuthReady" class="status" role="status">認証状況を確認しています...</p>
                <form v-else-if="user" class="composer-form" @submit.prevent="createThinks">
                    <label class="visually-hidden" for="think-text">考えを書く</label>
                    <textarea
                        id="think-text"
                        v-model="text"
                        placeholder="思いついたことを書く"
                        :disabled="isLoading"
                        rows="5"
                    />
                    <div class="composer-footer">
                        <select
                            id="think-visibility"
                            v-model="isPrivate"
                            :disabled="isLoading"
                            class=""
                        >
                            <option :value="false">
                                公開
                            </option>
                            <option :value="true">
                                非公開
                            </option>
                        </select>
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
                <div class="feed-section-head">
                    <h2 id="feed-title">投稿</h2>
                </div>

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
                            <div v-if="think.is_public === false">
                                <small class="think-private">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-incognito" viewBox="0 0 16 16">
                                        <path fill-rule="evenodd" d="m4.736 1.968-.892 3.269-.014.058C2.113 5.568 1 6.006 1 6.5 1 7.328 4.134 8 8 8s7-.672 7-1.5c0-.494-1.113-.932-2.83-1.205l-.014-.058-.892-3.27c-.146-.533-.698-.849-1.239-.734C9.411 1.363 8.62 1.5 8 1.5s-1.411-.136-2.025-.267c-.541-.115-1.093.2-1.239.735m.015 3.867a.25.25 0 0 1 .274-.224c.9.092 1.91.143 2.975.143a30 30 0 0 0 2.975-.143.25.25 0 0 1 .05.498c-.918.093-1.944.145-3.025.145s-2.107-.052-3.025-.145a.25.25 0 0 1-.224-.274M3.5 10h2a.5.5 0 0 1 .5.5v1a1.5 1.5 0 0 1-3 0v-1a.5.5 0 0 1 .5-.5m-1.5.5q.001-.264.085-.5H2a.5.5 0 0 1 0-1h3.5a1.5 1.5 0 0 1 1.488 1.312 3.5 3.5 0 0 1 2.024 0A1.5 1.5 0 0 1 10.5 9H14a.5.5 0 0 1 0 1h-.085q.084.236.085.5v1a2.5 2.5 0 0 1-5 0v-.14l-.21-.07a2.5 2.5 0 0 0-1.58 0l-.21.07v.14a2.5 2.5 0 0 1-5 0zm8.5-.5h2a.5.5 0 0 1 .5.5v1a1.5 1.5 0 0 1-3 0v-1a.5.5 0 0 1 .5-.5"/>
                                    </svg>
                                    非公開
                                </small>
                            </div>
                            <span class="think-card-text">{{ think.text }}</span>
                            <span class="think-card-bottom">会話を見る</span>
                        </RouterLink>
                    </li>
                </ul>
            </section>
        </div>
    </main>
</template>
