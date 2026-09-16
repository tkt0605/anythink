<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { supabase } from '../../lib/supabase.ts'

type Think = {
    id: number | string
    text: string
}
const think = ref<Think | null>(null)
const route = useRoute()
const isLoading = ref(false)
const errorMessage = ref('')


async function fetchGetThinkDetail(thinkId: number | string){
    isLoading.value = true
    errorMessage.value = ''

    const { data, error } = await supabase.from('thinks')
        .select('id, text')
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
}

watch(
    () => route.params.id,
    (id) => {
        if(typeof id === "string" || typeof id === "number"){
            fetchGetThinkDetail(id)
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
        <!-- ここにID -->
        <div class="" v-if="isLoading">読み込み中...</div>
        <div class="" v-else-if="errorMessage">{{ errorMessage }}</div>
        <div class="" v-else-if="think">
            <h2>{{ think.text }}</h2>
        </div>
    </main>
</template>