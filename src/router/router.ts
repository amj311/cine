import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
	history: createWebHistory(import.meta.env.BASE_URL),
	routes: [
		{
			path: '/',
			name: 'home',
			component: HomeView,
		},
		{
			path: '/browse',
			name: 'browse',
			component: () => import('@/views/browse/BrowseView.vue'),
		},
		{
			path: '/play',
			name: 'play',
			component: () => import('@/views/MovieTheater.vue'),
		},
		{
			path: '/remote',
			name: 'remote',
			component: () => import('@/views/RemoteControlView.vue'),
		}
	],
	scrollBehavior: (to, from) => {
		if (to.path === from.path) {
			return { top: window.scrollY };
		}
		return { top: 0 };
	},
})

export default router
