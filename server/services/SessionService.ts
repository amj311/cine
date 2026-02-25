import * as dotenv from "dotenv"
import { Handler, NextFunction, Request, Response } from "express";
dotenv.config()

import admin from 'firebase-admin';
import { AsyncLocalStorage } from "node:async_hooks";
import SHA256 from "../utils/SHA256";
import { Store } from "./DataService";

export const sessionStore = new AsyncLocalStorage<{ isOwner: boolean, email: string }>();

const ownerEmail = process.env.VITE_OWNER_EMAIL;
const authTokens = new Store<{ expires: number }>('authToken')

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

// Middleware to check if the request has a valid Firebase user session
export const sessionAuthMiddleware = async (ownerToken: string | false, req: Request, res: Response, next: NextFunction) => {
	try {
		const authToken = ownerToken || req.headers.authorization;
		if (!authToken) {
			// Send 401 for no auth
			return res.status(401).send();
		}

		let authData = (await checkOwnerAuth(authToken)) || (await checkFirebaseAuth(authToken));
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
};

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

async function checkOwnerAuth(authToken: string) {
	const savedToken = await authTokens.getByKey(authToken);
	if (savedToken && savedToken.expires > Date.now()) {
		return {
			email: ownerEmail,
		}
	}
	authTokens.delete(authToken); // cleanup expired
	return null;
}


const AUTH_EXPIRES = 1000 * 60 * 60 * 24 * 30;

export async function loginOwnerUser(emailHash: string, passHash: string) {
	if (emailHash === SHA256(ownerEmail) && passHash === SHA256(process.env.VITE_OWNER_PASS)) {
		const newToken = SHA256(emailHash + Date.now());
		authTokens.set(newToken, { expires: Date.now() + AUTH_EXPIRES });
		return newToken;
	}
}
export async function logoutOwnerUser(token: string) {
	authTokens.delete(token);
}

export function getSessionEmail() {
	return sessionStore.getStore()?.email || '';
}