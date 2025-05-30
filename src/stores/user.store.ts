import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { AuthService } from '@/services/AuthService';
import { useApiStore } from './api.store';

export const useUserStore = defineStore('user', () => {
	const hasLoadedSessionData = ref(false);
	const loginError = ref<String>('');
	const isLoggedIn = ref(false);
	const currentUser = ref<any>();
	// const newUserData = ref<any>(null);
	// const session = ref<any>();
	const isLoading = ref(false);

	const loadSessionData = async () => {
		// This is triggered by firebase at app initialization
		let authUser = AuthService.authUser;
		if (!authUser) {
			isLoggedIn.value = false;
			// currentUser.value = null;
			hasLoadedSessionData.value = true;
			isLoading.value = false;
			return;
		}
		try {
			isLoading.value = true;
			isLoggedIn.value = Boolean(authUser);
			if (!isLoggedIn.value) {
				currentUser.value = null;
				return;
			}
			// if (newUserData.value) {
			// 	await useApiStore().api.put('user/self', newUserData.value);
			// 	newUserData.value = null;
			// }
			// const { data } = await useApiStore().api.get('user/session');
			// Push new user details after creating account with email
			// currentUser.value = data.data;
			currentUser.value = authUser;
			// session.value = data;
			loginError.value = '';
		}
		catch (e) {
			console.log('ERROR LOADING AUTH USER')
			console.log(e);
			loginError.value = 'Failed to load user';
		}
		finally {
			hasLoadedSessionData.value = true;
			isLoading.value = false;
		}
	};

	AuthService.onLogInOrOut = () => {
		loadSessionData();
	};
	AuthService.initialize();

	// const setNewUserData = (data) => {
	// 	newUserData.value = data;
	// };

	// const createUser = async (newUser) => {
	// 	if (!isLoggedIn.value) {
	// 		throw Error("There is no active session");
	// 	}
	// 	if (currentUser.value) {
	// 		throw Error("There is already a user for this session");
	// 	}
	// 	const { data } = await request.post('user/create-account', {
	// 		...newUser,
	// 		auth_id: AuthService.authUser?.uid,
	// 		email: AuthService.authUser?.email
	// 	});
	// 	currentUser.value = data.data;
	// };

	return {
		hasLoadedSessionData,
		isLoggedIn,
		loginError,
		isOwner: computed(() => currentUser.value?.isOwner || false),
		currentUser,
		// session,
		// setNewUserData,
		// createUser,
		loadSessionData,
		isLoading,
	};
});
