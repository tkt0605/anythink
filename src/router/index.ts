import {createRouter, createWebHistory} from 'vue-router'
import Home from '../views/Home.vue'
import ThinkDetail from '../views/think/thinkDetail.vue'
import LoginView from '../views/auth/LoginView.vue'
import AuthCallback from '../views/auth/AuthCallback.vue'
import { supabase } from '../lib/supabase.ts'

const routes = createRouter({
    history: createWebHistory(),
    routes: [
        {path: '/', name: 'home', component: Home},
        {path: '/thinks/:id', name: 'think-detail', component: ThinkDetail},
        
        // ここは、ユーザー認証用のルート
        {path: '/signup', name: 'signup', component: LoginView},
        {path: '/auth/callback', component: AuthCallback}
    ]
})

routes.beforeEach(async (to) => {
    if(to.path === '/auth/callback') return
    
    const { data: {session} } = await supabase.auth.getSession()
    const auth = !!session

    if (to.meta.requireAuth && !auth)return {
        path: '/signup',
        query: {
            next: to.fullPath
        }
    }
    if((to.path === '/signup') && auth) return '/'
})

export default routes