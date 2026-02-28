import express, { Response } from 'express';
import { LibraryService } from '../services/LibraryService';
import { DirectoryService } from '../services/DirectoryService';
import { SurpriseService } from '../services/SurpriseService';
import { SharingService } from '../services/SharingService';
import { getSession, SessionService } from '../services/SessionService';
import { safeParseInt } from '../utils/miscUtils';
const route = express.Router({ mergeParams: true });

function setTokenCookie(res: Response, token: string) {
	res.cookie('stofbt', token, { signed: true });
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
	res.send(getSession());
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