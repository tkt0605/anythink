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
        errorMessage.value = "Thinksの作成に失敗しました。ログインして再度挑戦してください。"
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
            .select('*')
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
    <main class="">
        <p v-if="!isAuthReady">認証確認中...</p>
        <form v-else-if="user" @submit.prevent="createThinks">
            <textarea
                v-model="text"
                placeholder="あなたの考えを入れてください。"
                :disabled="isLoading"
            />
            <button 
                type="submit"
                :disabled="isLoading || !text.trim()"
            > {{ isLoading ? "処理中..." : "ポスト" }}</button>
        </form>
        <p v-else>
            Thinkを投稿するにはログインしてください。
        </p>
        <section class="">
            <h2 class="">Thinks一覧</h2>
            <p v-if="isLoading">読み込み中...</p>
            <p v-else-if="errorMessage">{{ errorMessage }}</p>
            <p v-else-if="thinks.length === 0">まだThinkはありません。</p>
            <ul v-else>
                <li v-for="think in thinks" :key="think.id" class="" @click="">
                    <RouterLink 
                     :to="{
                        name: 'think-detail',
                        params: { id: think.id}
                     }"
                    >
                        {{ think.text }}
                    </RouterLink>
                </li>
            </ul>
        </section>
    </main>
</template>
