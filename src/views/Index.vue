<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
    <main id="main-content" class="landing-main page-shell">
        <section class="hero-section" aria-labelledby="hero-title">
            <h1 id="hero-title">考えを書いて、話す。</h1>
            <p>思いついたことを投稿し、ほかの人の考えを読んで返信できます。</p>
            <RouterLink class="button button--primary" :to="{ name: 'home' }">投稿を見る</RouterLink>
            <p class="hero-note">読むだけなら登録は不要です。</p>
        </section>
    </main>
</template>
