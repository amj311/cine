import SHA256 from '@/utils/SHA256';
import { useApiStore } from '@/stores/api.store';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signOut, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
// import { useUserStore } from '@/stores/user.store';

const firebaseConfig = {
	apiKey: import.meta.env.VITE_FB_API_KEY,
	authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
	databaseURL: import.meta.env.VITE_FB_DB_URL,
	projectId: import.meta.env.VITE_FB_PROJECT_ID,
	storageBucket: import.meta.env.VITE_FB_STORAGE_BUCKET,
	messagingSenderId: import.meta.env.VITE_FB_MESSAGING_SENDER_ID,
	appId: import.meta.env.VITE_FB_APP_ID,
};

let firebaseApp;
let auth;

export const AuthService = {
	pauseAuthListeners: false,

	initialize() {
		this.setAuthUser(this.getInitialUser());
		if (!this.authUser) {
			firebaseApp = initializeApp(firebaseConfig);
			auth = getAuth(firebaseApp);

			auth.useDeviceLanguage();
			onAuthStateChanged(auth, (authUser) => {
				if (!this.pauseAuthListeners) {
					AuthService.onFbAuthChange(authUser);
				}
			});
		}
	},

	info: [''],
	authUser: null as null | {
		email: string,
		isOwner?: boolean,
		isFb?: boolean,
	},

	getInitialUser() {
		const isOwner = localStorage.getItem('isOwner') === 'true';
		if (isOwner) {
			return {
				email: import.meta.env.VITE_OWNER_EMAIL,
				isOwner: true,
			};
		}
		return null;
	},

	onLogInOrOut: (authUser) => { },
	setAuthUser(authUser) {
		const isOwner = authUser?.email === import.meta.env.VITE_OWNER_EMAIL;
		if (isOwner) {
			authUser.isOwner = true;
		}

		this.authUser = authUser || null;
		this.onLogInOrOut(authUser);
	},

	onFbAuthChange(authUser) {
		if (!this.authUser?.isOwner) {
			this.setAuthUser(authUser ?
				{
					...authUser,
					isFb: true,
				}
				: null
			);
		}
	},

	async getToken() {
		return await auth?.currentUser?.getIdToken();
	},

	async createEmailUser(email, password, givenName, familyName) {
		// flag user store to create new user
		// useUserStore().setNewUserData({givenName, familyName});
		// register firebase user
		let newFbUser;
		try {
			const userCredential = await createUserWithEmailAndPassword(auth, email, password);
			newFbUser = userCredential.user;
		}
		catch (error: any) {
			console.error('createEmailUser error', error)
			throw new Error(error.message);
		}

		this.setAuthUser(newFbUser);
	},

	async signInWithEmail(email, password) {
		try {
			// if (email === import.meta.env.VITE_OWNER_EMAIL && password === import.meta.env.VITE_OWNER_PASS) {
			if (email === import.meta.env.VITE_OWNER_EMAIL) {
				// authenticate with server directly for LAN setup
				await useApiStore().api.post('/auth', {
					emailHash: SHA256(email),
					passHash: SHA256(password),
				});
				this.info.push('signing in as owner');
				localStorage.setItem('isOwner', 'true');
				this.setAuthUser({
					email: import.meta.env.VITE_OWNER_EMAIL,
				});
			}
			else {
				this.pauseAuthListeners = true;
				const userCredential = await signInWithEmailAndPassword(auth, email, password);

				// authenticate with server with fb token
				await useApiStore().api.post('/auth', {}, {
					headers: {
						Authorization: await this.getToken(),
					}
				});

				const user = userCredential.user;
				this.setAuthUser({
					email: user.email || '',
					isFb: true,
				});
				this.pauseAuthListeners = false;
				this.onFbAuthChange(this.authUser);
			}
		} catch (error: any) {
			console.error('signInWithEmail error', error)
			throw new Error(error.message);
		}
	},

	// SIGN IN WITH GOOGLE IS NOT WORKING!
	async signInWithGoogle() {
		try {
			// if (isWeb) {
			this.info.push('google signin with redirect')
			const provider = new GoogleAuthProvider();
			const userCredential: any = await signInWithPopup(auth, provider);
			const user = userCredential.user;
			return user;
			// }
			// else {
			// 	this.info.push('google signin with credential')
			// 	let googleUser = await GoogleAuth.signIn();
			// 	const googleCredential = GoogleAuthProvider.credential(googleUser.authentication.idToken);
			// 	const userCredential:any = await signInWithCredential(auth, googleCredential);
			// 	const user = userCredential.user;
			// 	return user;
			// }

		} catch (error: any) {
			console.log('signInWithGoogle error', error)
			throw new Error(error.message);
		}
	},

	async sendPasswordResetEmail(email) {
		try {
			await sendPasswordResetEmail(auth, email);
		} catch (error: any) {
			throw new Error(error.message);
		}
	},

	async signOut() {
		try {
			// do not log out with FiB if used bypass
			if (auth && !AuthService.authUser?.isOwner) {
				await signOut(auth);
			}
			localStorage.removeItem('isOwner');
			await useApiStore().api.post('/auth/signout');
			AuthService.setAuthUser(null);
			AuthService.onLogInOrOut?.call(null, null);
			this.initialize();
		} catch (error: any) {
			throw new Error(error.message);
		}
	},
}
