import {createRouter, createWebHistory} from 'vue-router'
import Index from '../views/Index.vue'
import Home from '../views/Home.vue'
import ThinkDetail from '../views/think/thinkDetail.vue'
import LoginView from '../views/auth/LoginView.vue'
import SignupView from '../views/auth/SignupView.vue'
import AuthCallback from '../views/auth/AuthCallback.vue'
import { supabase } from '../lib/supabase.ts'

const routes = createRouter({
    history: createWebHistory(),
    routes: [
        {path: '/', name: 'index', component: Index},
        {path: '/home', name: 'home', component: Home},
        {path: '/thinks/:id', name: 'think-detail', component: ThinkDetail},
        
        // ここは、ユーザー認証用のルート
        {
            path: '/auth/login',
            name: 'login',
            component: LoginView,
        },
        {
            path: '/auth/signup',
            name: "signup",
            component: SignupView,
        },
        {path: '/auth/callback', component: AuthCallback}
    ]
})

routes.beforeEach(async (to) => {
    if(to.path === '/auth/callback') return
    
    const { data: {session} } = await supabase.auth.getSession()
    const auth = !!session

    if (to.meta.requireAuth && !auth){
        return {
            name: 'login',
            query: {
                next: to.fullPath
            }
        }
    }

    if( auth && ( to.name === "login" || to.name === "signup" ) ){
        return {name: 'home'}
    }
})

export default routes