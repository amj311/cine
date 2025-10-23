import express from 'express';
const route = express.Router({ mergeParams: true });

// For now just storing timer state in memory
const TimerState = {
	running: false,
	timeLeft: 1,
	totalTime: 1,
}
let tickerInterval = 0 as any;

function startInterval() {
	if (tickerInterval) {
		clearInterval(tickerInterval);
	}
	tickerInterval = setInterval(() => {
		TimerState.timeLeft = Math.max(0, TimerState.timeLeft - 1);
		if (!TimerState.running || TimerState.timeLeft <= 0) {
			clearInterval(tickerInterval);
			tickerInterval = 0;
			TimerState.running = false;
		}
	}, 1000)
}

route.get('/', (req, res) => {
	res.send({
		success: true,
		data: TimerState,
	});
});

route.put('/add', (req, res) => {
	TimerState.running = true;
	TimerState.timeLeft += req.body.time;


	if (TimerState.timeLeft > TimerState.totalTime) {
		TimerState.totalTime = TimerState.timeLeft;
	}

	res.send({
		success: true,
		data: TimerState,
	})
})

route.put('/start', (req, res) => {
	TimerState.running = true;

	if (req.body.timeLeft) {
		TimerState.totalTime = req.body.timeLeft;
		TimerState.timeLeft = req.body.timeLeft;
	}
	startInterval();

	res.send({
		success: true,
		data: TimerState,
	})
})

route.put('/reset', (req, res) => {
	TimerState.running = false;
	TimerState.timeLeft = 1;
	TimerState.totalTime = 1;

	if (tickerInterval) {
		clearInterval(tickerInterval);
	}

	res.send({
		success: true,
		data: TimerState,
	})
})

route.put('/pause', (req, res) => {
	TimerState.running = false;

	res.send({
		success: true,
		data: TimerState,
	})
})


export default route;