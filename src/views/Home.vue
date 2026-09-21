<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { supabase } from '../lib/supabase.ts'
import { RouterLink } from 'vue-router' 

import { useAuth } from '../composables/useAuth.ts'

// Think型の定義
type Think = {
    id: number | string
    text: string
}

const text = ref('')
// Think型を格納する配列としてthinksを初期化
const thinks = ref<Think[]>([])
// Loading用の引数
const isLoading = ref(false)
// エラーメッセージ用の引数
const errorMessage = ref('')

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
                text: trimmedText
            })
        if(error) throw error
        text.value = ""
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
        .select('id, text')
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
                            <span class="think-card-text">{{ think.text }}</span>
                            <span class="think-card-bottom">会話を見る</span>
                        </RouterLink>
                    </li>
                </ul>
            </section>
        </div>
    </main>
</template>
