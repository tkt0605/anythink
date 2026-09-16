<script setup lang="ts">
import { ref } from 'vue'
import { supabase } from '../lib/supabase.ts'

const text = ref('')
async function createThinks() {
    if(!text.value.trim()) return
    const { error } = await supabase.from('thinks').insert({
        text: text.value.trim()
    })
    if (error){
        console.error('Error Inserting Error:', error)
    }
    text.value = ''
}
</script>

<template>
    <main class="">
        <textarea v-model="text" placeholder="あなたの考えを入れてください。" name="" id="" class="" />
        <button @click="createThinks" class=""> think</button>
    </main>
</template>