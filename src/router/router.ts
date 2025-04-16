import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import BrowseView from '@/views/browse/BrowseView.vue'
import MovieTheater from '@/views/MovieTheater.vue'

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
			component: BrowseView,
		},
		// {
		// 	path: '/library',
		// 	name: 'library',
		// component: BrowseView,
		// }
		{
			path: '/play',
			name: 'play',
			component: MovieTheater,
		}
	],
})

export default router
