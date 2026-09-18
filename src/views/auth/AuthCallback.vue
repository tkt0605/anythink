<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { supabase } from '../../lib/supabase';

const router = useRouter();

onMounted(async() => {
    const code = new URL(window.location.href).searchParams.get('code') ?? ''
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    const data = error ? {path: '/signup', query: {AuthError: '1'}} : '/'
    router.replace(data)

    try {
        const code = new URL(window.location.href).searchParams.get('code') ?? ''
        if (!code){
            throw new Error("認証コードがありません。");
        }
        const { error } = await supabase.auth.exchangeCodeForSession(code)

        if(error){
            throw error
        }

        await router.replace({
            name: "home"
        })
    } catch (error) {
        console.error('認証処理失敗:', error)

        await router.replace({
            name: 'signup',
            query: {
                AuthError: '1',
            }
        })
    }
})
</script>
<template>
    <main>
        <p>認証しています。。。。。</p>
    </main>
</template>