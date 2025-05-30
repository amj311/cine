import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, signInWithRedirect, type Auth, signInWithCredential, sendPasswordResetEmail } from 'firebase/auth';
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
	initialize() {
		this.setAuthUser(this.getInitialUser());
		if (!this.authUser) {
			firebaseApp = initializeApp(firebaseConfig);
			auth = getAuth(firebaseApp);

			auth.useDeviceLanguage();
			onAuthStateChanged(auth, (authUser) => {
				AuthService.onFbAuthChange(authUser);
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
		const maxAge = 1000 * 60 * 60 * 24 * 7;
		const isOwner = localStorage.getItem('isOwner') === 'true';
		const lastLogin = localStorage.getItem('lastLogin');
		if (isOwner && lastLogin) {
			const lastLoginDate = new Date(parseInt(lastLogin));
			if (Date.now() - lastLoginDate.getTime() < maxAge) {
				return {
					email: import.meta.env.VITE_OWNER_EMAIL,
					isOwner: true,
				};
			}
		}
		return null;
	},

	onLogInOrOut: (authUser) => { },
	setAuthUser(authUser) {
		const isOwner = authUser?.email === import.meta.env.VITE_OWNER_EMAIL;
		if (isOwner) {
			authUser.isOwner = true;
			localStorage.setItem('isOwner', 'true');
			localStorage.setItem('lastLogin', Date.now().toString());
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
			if (email === import.meta.env.VITE_OWNER_EMAIL && password === import.meta.env.VITE_OWNER_PASS) {
				this.info.push('signing in as owner');
				this.setAuthUser({
					email: import.meta.env.VITE_OWNER_EMAIL,
					isOwner: true,
				});
			}
			else {
				// const userCredential = await signInWithEmailAndPassword(auth, email, password);
				// const user = userCredential.user;
				// this.setAuthUser({
				// 	email: user.email || '',
				// 	isFb: true,
				// });
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
			await signOut(auth);
			this.onLogInOrOut?.call(null, null);
		} catch (error: any) {
			throw new Error(error.message);
		}
	},
}
