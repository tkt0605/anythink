import {createRouter, createWebHistory} from 'vue-router'
import Home from '../views/Home.vue'
import ThinkDetail from '../views/think/thinkDetail.vue'

const routes = createRouter({
    history: createWebHistory(),
    routes: [
        {path: '/', name: 'home', component: Home},
        {path: '/thinks/:id', name: 'think-detail', component: ThinkDetail},
    ]
})

export default routes