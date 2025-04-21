import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import BrowseView from '@/views/browse/BrowseView.vue'
import MovieTheater from '@/views/MovieTheater.vue'
import MoviePage from '@/views/browse/MoviePage.vue'
import SeriesPage from '@/views/browse/SeriesPage.vue'

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
		{
			path: '/play',
			name: 'play',
			component: MovieTheater,
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
