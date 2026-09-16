<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { supabase } from '../lib/supabase.ts'
import { RouterLink } from 'vue-router'

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

async function createThinks() {
    if(!text.value.trim()) return
    const { error } = await supabase.from('thinks').insert({
        text: text.value.trim()
    })
    if (error){
        console.error('Error Inserting Error:', error)
        errorMessage.value = "Thinkの作成に失敗しました。"
        return
    }else{
        errorMessage.value = ''
        console.log('Think Created Successfully')
    }
    text.value = ''
    await fetchThinks()
}

async function fetchThinks() {
    isLoading.value = true
    errorMessage.value = ''

    const { data, error } = await supabase.from('thinks').select('id, text')
    if (error){
        console.error('Error Fetching Data:', error)
        errorMessage.value = '一覧の取得に失敗しました。'
    }else{
        thinks.value = data ?? []
    }
    isLoading.value = false
}

onMounted(fetchThinks)
</script>

<template>
    <main class="">
        <textarea v-model="text" placeholder="あなたの考えを入れてください。" name="" id="" class="" />
        <button @click="createThinks" class=""> think</button>
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
