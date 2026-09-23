<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
    <main id="main-content" class="landing-main page-shell">
        <section class="welcome-panel" aria-labelledby="hero-title">
            <p class="welcome-kicker">考えを育てる場所</p>
            <h1 id="hero-title">
                考えは、話すと<br>
                もっと面白くなる。
            </h1>

            <p class="welcome-description">
                ふと浮かんだ疑問やアイデアを残し、ほかの人の視点と出会いながら、
                ひとりでは見えなかった理解へ。
            </p>

            <div class="welcome-actions">
                <RouterLink class="button button--primary" :to="{ name: 'home' }">
                    Thinkを見る
                </RouterLink>
                <RouterLink class="button button--ghost" :to="{ name: 'signup' }">
                    新規登録
                </RouterLink>
            </div>

            <p class="welcome-guidance">読むだけなら登録は不要です。</p>

            <div class="welcome-details">
                <p class="welcome-list-title">Anythinkでできること</p>
                <ul class="welcome-list">
                    <li>まだまとまっていない考えを、Thinkとして書く</li>
                    <li>誰かの考えを読み、自分の視点を返信する</li>
                    <li>会話から大切な気づきを整理し、知識として残す</li>
                </ul>
            </div>
        </section>
    </main>
</template>
