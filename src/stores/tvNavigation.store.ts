import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useTvNavigationStore = defineStore('TvNavigation', () => {
	const enabled = ref(false);

	let preClickElement: HTMLElement | null = null;

	function captureClick(event) {
		preClickElement?.click();
	}

	type Direction = 'up' | 'down' | 'left' | 'right';
	const mouseCooldown = 200;
	let lastMouseMoveTime = 0;

	function handleMouseMove(event) {
		if (Date.now() - lastMouseMoveTime < mouseCooldown) {
			return;
		}
		lastMouseMoveTime = Date.now();
		// determine greatest moved direction
		const deltaX = event.movementX;
		const deltaY = event.movementY;
		let direction: Direction;
		if (Math.abs(deltaX) > Math.abs(deltaY)) {
			direction = deltaX > 0 ? 'right' : 'left';
		}
		else {
			direction = deltaY > 0 ? 'down' : 'up';
		}
		moveFocus(direction);
	}

	function handleKeyDown(event) {
		if (event.key === 'Enter' || event.key === ' ') {
			captureClick(event);
			return;
		}
		let direction = '';
		switch (event.key) {
			case 'ArrowUp':
				direction = 'up';
				break;
			case 'ArrowDown':
				direction = 'down';
				break;
			case 'ArrowLeft':
				direction = 'left';
				break;
			case 'Tab':
			case 'ArrowRight':
				direction = 'right';
				break;
			default:
				break;
		}
		if (direction === '') {
			return;
		}
		event.preventDefault();
		moveFocus(direction as Direction);
	}

	function engageTvMode() {
		document.addEventListener('click', captureClick);
		document.addEventListener('mousemove', handleMouseMove);
		document.addEventListener('keydown', handleKeyDown);
		enabled.value = true;
	}
	function disengageTvMode() {
		document.removeEventListener('click', captureClick);
		document.removeEventListener('mousemove', handleMouseMove);
		document.removeEventListener('keydown', handleKeyDown);
		enabled.value = false;
	}

	function moveFocus(direction: 'up' | 'down' | 'left' | 'right') {
		const focusableElements = gatherFocusableElements(direction);

		if (focusableElements.length) {
			setFocus(focusableElements[0]);
		}
	}

	function setFocus(element: HTMLElement) {
		if (element) {
			preClickElement = element;
			preClickElement.focus();
			preClickElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
		}
	}

	function gatherFocusableElements(direction?: 'up' | 'down' | 'left' | 'right') {
		const focusElements = ['[href]', 'button', 'input', 'select', 'textarea', '[tabindex]', 'details', 'summary'];
		const query = focusElements.map(el => el + ':not([disabled]):not([tabindex="-1"])').join(', ');

		let elements = Array.from(document.body.querySelectorAll(query)) as Array<HTMLElement>;

		// If looking in a specific direction, filter the elements
		const rowMarginOfError = 15;

		const isSameRow = (active, other) => {
			return Math.abs(active.top - other.top) < rowMarginOfError || Math.abs(active.bottom - other.bottom) < rowMarginOfError;
		}
		const compareForInclusion = {
			up: (active, other) => other.bottom < active.top,
			down: (active, other) => active.bottom < other.top,
			left: (active, other) => other.right < active.left && isSameRow(active, other),
			right: (active, other) => active.right < other.left && isSameRow(active, other),
		}
		const sidesToCompareForDistance = {
			// will compare how close these pairs of sides are in alignment
			up: [['left', 'left'], ['right', 'right'], ['top', 'bottom']],
			down: [['left', 'left'], ['right', 'right'], ['top', 'bottom']],
			left: [['top', 'top'], ['bottom', 'bottom'], ['left', 'right']],
			right: [['top', 'top'], ['bottom', 'bottom'], ['left', 'right']],
		}

		if (direction && preClickElement) {
			const activeRect = preClickElement.getBoundingClientRect();

			const options = elements.map((el) => {
				const elRect = el.getBoundingClientRect();

				if (el === preClickElement || !compareForInclusion[direction](activeRect, elRect)) {
					return null;
				}
				return {
					element: el,
					distanceScore: sidesToCompareForDistance[direction].reduce((acc, side) => {
						return acc + Math.abs(activeRect[side[0]] - elRect[side[1]]);
					}, 0)
				}
			}).filter(el => el !== null).sort((a, b) => a.distanceScore - b.distanceScore);
			elements = options.map((option) => option.element);
		}

		return elements;
	}


	const lastFewMouseMovements: Array<{ x: number, y: number }> = [];
	function watchForTvMouseMove(event) {
		// abort if neiter direction is moving
		if (event.movementX === 0 && event.movementY === 0) {
			return;
		}

		// Consider the environment as a TV is the mouse moves exactly linearly for a few consecutive events
		const SIGNIFICANCE_THRESHOLD = 50;
		const EVENTS_CAP = 100;

		lastFewMouseMovements.push({ x: event.movementY, y: event.movementY });

		if (lastFewMouseMovements.length > EVENTS_CAP) {
			console.log('Too many non-linear mousemovents. Not a TV.');
			return stopWatchingForTvMouseMove();
		}

		if (lastFewMouseMovements.length > SIGNIFICANCE_THRESHOLD) {
			const lastFewMouseMovementsToConsider = lastFewMouseMovements.slice(-SIGNIFICANCE_THRESHOLD);
			console.log('lastFewMouseMovementsToConsider', lastFewMouseMovementsToConsider);
			const isTv = lastFewMouseMovementsToConsider.every((movement) => movement.x === 0)
				|| lastFewMouseMovementsToConsider.every((movement) => movement.y === 0);

			if (isTv) {
				return stopWatchingForTvMouseMove(true);
			}
		}
	}

	function startWatchingForTvMouseMove() {
		console.log('Watching for TV mouse move');
		window.addEventListener('mousemove', watchForTvMouseMove);
	};

	function stopWatchingForTvMouseMove(success: boolean = false) {
		console.log('Stopped watching for TV mouse move');
		window.removeEventListener('mousemove', watchForTvMouseMove);
		if (success) {
			engageTvMode();
		}
		else {
			disengageTvMode();
		}
	}

	function determineTvEnvironment() {
		console.log('determineTvEnvironment');
		const isTv = window.matchMedia('(display-mode: fullscreen)').matches || window.matchMedia('(display-mode: minimal-ui)').matches;
		if (isTv) {
			console.log('TV environment detected');
			engageTvMode();
			return;
		}
		startWatchingForTvMouseMove();
	}

	return {
		gatherFocusableElements,

		determineTvEnvironment,
		engageTvMode,
		enabled,

		setFocus,
	}
})
