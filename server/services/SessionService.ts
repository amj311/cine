import * as dotenv from "dotenv"
import { Handler, NextFunction, Request, Response } from "express";
dotenv.config()

import admin from 'firebase-admin';
import { AsyncLocalStorage } from "node:async_hooks";
import SHA256 from "../utils/SHA256";
import { Store } from "./DataService";

export const sessionStore = new AsyncLocalStorage<{ isOwner: boolean, email: string }>();

const AUTH_TTL = 1000 * 60 * 60 * 24 * 30;
const CODE_TTL = 1000 * 60 * 5;
const ownerEmail = process.env.VITE_OWNER_EMAIL!;
if (!ownerEmail) {
	throw new Error("Owner email must be configured!")
}

type AuthToken = { token: string, email: string, expires: number };
const authTokens = new Store<AuthToken>('authToken');
const signinCodes = new Store<{ code: string, expires: number, validatedBy: string }>('signinCode');

export const firebaseConfig = {
	apiKey: process.env.VITE_FB_API_KEY,
	authDomain: process.env.VITE_FB_AUTH_DOMAIN,
	databaseURL: process.env.VITE_FB_DB_URL,
	projectId: process.env.VITE_FB_PROJECT_ID,
	storageBucket: process.env.VITE_FB_STORAGE_BUCKET,
	messagingSenderId: process.env.VITE_FB_MESSAGING_SENDER_ID,
	appId: process.env.VITE_FB_APP_ID,
};

// Initialize the Firebase Admin SDK
admin.initializeApp(firebaseConfig);

async function checkFirebaseAuth(authToken: string) {
	try {
		const decoded = await admin.auth().verifyIdToken(authToken);
		return {
			email: decoded.email!,
		}
	}
	catch (e) {
		return null;
	}
}

async function checkServerTokens(authToken: string) {
	await authTokens.migrate(old => {
		return { ...old.data, token: old.key }
	})

	// first delete all expired tokens
	const allTokens = await authTokens.getAll();
	for (const token of allTokens) {
		if (token.expires < Date.now()) {
			await authTokens.delete(token.token)
		}
	}
	const savedToken = await authTokens.getByKey(authToken);
	if (savedToken) {
		return {
			email: savedToken.email,
		}
	}
	return null;
}

async function saveNewToken(token: string, email: string) {
	await authTokens.set(token, { token, email, expires: Date.now() + AUTH_TTL });
}


export function getSessionEmail() {
	return sessionStore.getStore()?.email || '';
}

export function isOwner() {
	return getSessionEmail() === process.env.VITE_OWNER_EMAIL;
}

export function getSession() {
	return {
		email: getSessionEmail(),
		isOwner: isOwner(),
	}
}



export const SessionService = {
	/** Middleware to check if the request has a valid Firebase user session */
	async sessionAuthMiddleware(req: Request & { signedCookies: any }, res: Response, next: NextFunction) {
		try {
			const stofbt = req.signedCookies?.stofbt;
			if (!stofbt) {
				return res.status(401).send();
			}

			let authData = (await checkServerTokens(stofbt)) || (await checkFirebaseAuth(stofbt));
			if (!authData) {
				// Send 401 for no auth
				return res.status(401).send();
			}

			// run the rest of the endpoint with session context
			sessionStore.run(
				{
					email: authData.email!,
					isOwner: authData.email === ownerEmail,
				},
				next
			)
		}
		catch (error) {
			// Return an error response if the Firebase user session is not valid
			console.error(error)
			res.status(500).send();
		}
	},

	async loginOwnerUser(emailHash: string, passHash: string) {
		if (emailHash === SHA256(ownerEmail) && passHash === SHA256(process.env.VITE_OWNER_PASS)) {
			const newToken = SHA256(emailHash + Date.now());
			await saveNewToken(newToken, ownerEmail);
			return newToken;
		}
	},

	async logoutServerAuth(token: string) {
		await authTokens.delete(token);
	},






	/**
	 * A device can request to sign in with code. They will then wait for an authenticated user to validate the code.
	 */
	async createSigninCode() {
		const code = String((Math.random() * Math.pow(10, 6))).split('.')[0]!; // six digits
		await signinCodes.set(code, { code, validatedBy: '', expires: Date.now() + CODE_TTL });
		return code;
	},

	/**
	 * If an authenticated used provides an existing code, it will be marked as validated for the requesting device
	 * @param code
	 */
	async validateSigninCode(code: string) {
		const session = getSession();
		if (!session.email) {
			throw new Error("Not logged in!");
		}

		const existingCode = await signinCodes.getByKey(code);
		if (!existingCode) {
			throw new Error("Not an existing code");
		}

		await signinCodes.set(code, { ...existingCode, validatedBy: session.email });
	},


	/**
	 * The waiting device periodically checks to see if its code is validated yet.
	 * When validated, the device is logged in
	 * @param code
	 */
	async checkForValidatedCode(code: string) {
		// first delete all expired codes
		const allCodes = await signinCodes.getAll();
		for (const savedCode of allCodes) {
			if (savedCode.expires < Date.now()) {
				await authTokens.delete(String(savedCode.code));
			}
		}

		const existingCode = await signinCodes.getByKey(code);
		if (!existingCode) {
			throw new Error("Not an existing code");
		}

		if (!existingCode.validatedBy) {
			return null;
		}

		const newToken = SHA256(existingCode.validatedBy + Date.now());
		await saveNewToken(newToken, existingCode.validatedBy);
		return newToken;
	},
}