import express, { Response } from 'express';
import { AUTH_TTL, SessionService } from '../services/SessionService';
const route = express.Router({ mergeParams: true });

function setTokenCookie(res: Response, token: string) {
	res.cookie('stofbt', token, {
		signed: true,
		maxAge: AUTH_TTL,
		httpOnly: true, // Highly recommended for security
		secure: process.env.ENV === 'production' // Ensures it's only sent over HTTPS
	});
}

route.post('', async (req, res) => {
	const { emailHash, passHash } = req.body;
	let token = req.headers.authorization;
	if (!token) {
		token = await SessionService.loginOwnerUser(emailHash, passHash);
	}
	if (!token) {
		return res.status(401).send();
	}
	setTokenCookie(res, token);
	res.send();
})

route.post('/signout', async (req, res) => {
	const stofbt = req.signedCookies?.stofbt;
	await SessionService.logoutServerAuth(stofbt);
	res.clearCookie('stofbt', { signed: true, path: '/' });
	res.send();
})



route.get('/code', async (req, res) => {
	const code = await SessionService.createSigninCode();
	res.send({
		data: code,
	});
})

route.get('/code/:code', async (req, res) => {
	const { code } = req.params;
	const token = await SessionService.checkForValidatedCode(code);
	if (token) {
		setTokenCookie(res, token);
	}
	res.send({
		success: Boolean(token),
	});
})


// validate session for the next routes
route.use(SessionService.sessionAuthMiddleware);

route.post('/code/:code/validate', async (req, res) => {
	const { code } = req.params;
	await SessionService.validateSigninCode(code);
	res.send();
})

export default route;