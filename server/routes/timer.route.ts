import express from 'express';
const route = express.Router({ mergeParams: true });

const defaultStart = 30 * 1000;
const defaultTapValue = 10 * 1000;
const defaultMaxValue = 0;

// For now just storing timer state in memory
const TimerState = {
	running: false,
	timeLeft_ms: 1,
	totalTime_ms: 1,
	config: {
		maxTime_ms: defaultMaxValue,
		startTime_ms: defaultStart,
		tapValue_ms: defaultTapValue,
	}
}

let tickerInterval = 0 as any;
const tickInterval_ms = 1000;

function startInterval() {
	if (tickerInterval) {
		clearInterval(tickerInterval);
	}
	tickerInterval = setInterval(() => {
		TimerState.timeLeft_ms = Math.max(0, TimerState.timeLeft_ms - tickInterval_ms);
		if (!TimerState.running || TimerState.timeLeft_ms <= 0) {
			clearInterval(tickerInterval);
			tickerInterval = 0;
			TimerState.running = false;
		}
	}, tickInterval_ms)
}

function runTimer() {
	TimerState.running = true;
	startInterval();
}

route.get('/', (req, res) => {
	res.send({
		success: true,
		data: TimerState,
	});
});

route.put('/add', (req, res) => {
	const timeToAdd = req.body.time || TimerState.config.tapValue_ms;
	TimerState.timeLeft_ms = Math.min(TimerState.config.maxTime_ms || Infinity, TimerState.timeLeft_ms + timeToAdd);

	// Increase total time if necessary
	if (TimerState.timeLeft_ms > TimerState.totalTime_ms) {
		TimerState.totalTime_ms = TimerState.timeLeft_ms;
	}
	runTimer();

	res.send({
		success: true,
		data: TimerState,
	})
})

route.put('/start', (req, res) => {
	if (req.body.timeLeft_ms) {
		TimerState.totalTime_ms = req.body.timeLeft_ms;
		TimerState.timeLeft_ms = req.body.timeLeft_ms;
	}
	runTimer();

	res.send({
		success: true,
		data: TimerState,
	})
})

route.put('/reset', (req, res) => {
	TimerState.running = false;
	TimerState.timeLeft_ms = 1;
	TimerState.totalTime_ms = 1;

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

route.put('/config', (req, res) => {
	TimerState.config.maxTime_ms = req.body.maxTime_ms;
	TimerState.config.startTime_ms = req.body.startTime_ms;
	TimerState.config.tapValue_ms = req.body.tapValue_ms;

	res.send({
		success: true,
		data: TimerState,
	})
})


export default route;