import { nextTick, ref } from 'vue'
import { defineStore } from 'pinia'

type Direction = 'up' | 'down' | 'left' | 'right';

export const useTvNavigationStore = defineStore('TvNavigation', () => {
	const lastMouseMove = ref({ x: 0, y: 0 });
	const lastMousePosition = ref({ x: 0, y: 0 });
	const lastDetectedDirection = ref<Direction | null>(null);
	const lastMouseMoveTime = ref(0);
	const enabled = ref(false);
	let lastFocusedEl: HTMLElement | null = null;

	function captureClick(event) {
		lastFocusedEl?.click();
	}

	const mouseCooldown = 100;

	function handleMouseMove(event) {

		if (Date.now() - lastMouseMoveTime.value < mouseCooldown) {
			return;
		}

		const deltaX = event.clientX - lastMousePosition.value.x;
		const deltaY = event.clientY - lastMousePosition.value.y;

		lastMousePosition.value = { x: event.clientX, y: event.clientY };
		lastMouseMove.value = { x: deltaX, y: deltaY };
		lastMouseMoveTime.value = Date.now();

		let direction: Direction | null = null;

		if (deltaX === 0 && deltaY === 0) {
			// Mouse may be stuck on edge of screen.
			// If it is touching a boundary, go in that direction
			console.log("Mouse did not move! Looking for edge detection!")
			console.log(event.clientY, window.innerHeight, event.clientY >= window.innerHeight - 1);
			if (event.clientX <= 1) {
				direction = 'left';
			} else if (event.clientX >= window.innerWidth - 1) {
				direction = 'right';
			} else if (event.clientY <= 1) {
				direction = 'up';
			} else if (event.clientY >= window.innerHeight - 1) {
				direction = 'down';
			}

			if (direction) {
				moveFocus(direction);
				return;
			} else {
				console.log("Mouse is not touching any edge. Not moving focus.");
				return;
			}
		}


		if (Math.abs(deltaX) > Math.abs(deltaY)) {
			direction = deltaX > 0 ? 'right' : 'left';
		}
		else if (Math.abs(deltaY) > Math.abs(deltaX)) {
			direction = deltaY > 0 ? 'down' : 'up';
		}

		if (direction) {
			moveFocus(direction);
		}
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
		enabled.value = true;

		nextTick(() => {
			document.getElementById('tvClickCapture')!.addEventListener('click', captureClick);
			document.addEventListener('mousemove', handleMouseMove);
			document.addEventListener('keydown', handleKeyDown);
			findFocus();
		});
	}
	function disengageTvMode() {
		document.removeEventListener('click', captureClick);
		document.removeEventListener('mousemove', handleMouseMove);
		document.removeEventListener('keydown', handleKeyDown);
		enabled.value = false;
	}

	function moveFocus(direction: Direction | null = null) {
		lastDetectedDirection.value = direction;
		const focusableElements = gatherFocusableElements(direction);

		if (focusableElements.length) {
			setFocus(focusableElements[0]);
		}
	}


	function findFocus() {
		const focusableElements = gatherFocusableElements();
		if (focusableElements.length) {
			setFocus(focusableElements[0]);
		}
	}
	function setFocus(element: HTMLElement) {
		if (element) {
			lastFocusedEl = element;
			lastFocusedEl.focus();
			lastFocusedEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
		}
	}

	function gatherFocusableElementsWithinElement(element: HTMLElement, direction: Direction | null) {
		const focusElements = ['[href]', 'button', 'input', 'select', 'textarea', '[tabindex]', 'details', 'summary'];
		const query = focusElements.map(el => el + ':not([disabled]):not([tabindex="-1"])').join(', ');

		let elements = Array.from(element.querySelectorAll(query)) as Array<HTMLElement>;

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
		const sidesToPrioritizeForDistance = {
			// will compare how close these pairs of sides are in alignment
			up: [['top', 'bottom'], ['left', 'lfet']],
			down: [['bottom', 'top'], ['left', 'left']],
			left: [['top', 'top'], ['left', 'right']],
			right: [['top', 'top'], ['right', 'left']],
		}

		if (direction && lastFocusedEl) {
			const activeRect = lastFocusedEl.getBoundingClientRect();

			const options = elements.map((el) => {
				const elRect = el.getBoundingClientRect();

				if (el === lastFocusedEl || !compareForInclusion[direction](activeRect, elRect)) {
					return null;
				}

				const distanceScores = sidesToPrioritizeForDistance[direction].reduce((acc, [activeSide, otherSide]) => {
					const activeSideValue = activeRect[activeSide];
					const otherSideValue = elRect[otherSide];
					const distance = Math.abs(activeSideValue - otherSideValue);
					acc[activeSide + otherSide] = distance;
					return acc;
				}, {} as any);

				return {
					element: el,
					distanceScores,
				}
			}).filter(el => el !== null).sort((a, b) => {
				for (const sides of sidesToPrioritizeForDistance[direction]) {
					const [activeSide, otherSide] = sides;
					const aDistance = a.distanceScores[activeSide + otherSide];
					const bDistance = b.distanceScores[activeSide + otherSide];
					if (aDistance < bDistance) {
						return -1;
					}
					else if (aDistance > bDistance) {
						return 1;
					}
				}
				return 0;
			});
			elements = options.map((option) => option.element);
		}

		return elements;
	}

	function gatherFocusableElements(direction: Direction | null = null) {
		// Determine if current el is within a scrollable container
		// If so, only look for focusable elements within that container
		// If it is not or there are no valid options left in the direction, then look for the next scrollable el, up to the root.
		let elements: Array<HTMLElement> = [];
		if (lastFocusedEl) {
			// Create a stack of scrollable elements containing either other scrollable elements or the focused element
			const scrollableStack: Array<HTMLElement> = [];
			let currentElement: HTMLElement | null = lastFocusedEl;
			while (currentElement) {
				if (currentElement === document.body) {
					break;
				}
				if (currentElement.scrollHeight > currentElement.clientHeight) {
					scrollableStack.push(currentElement);
				}
				currentElement = currentElement.parentElement;
			}

			while (scrollableStack.length) {
				const scrollableElement = scrollableStack.shift() as HTMLElement;
				const focusableElements = gatherFocusableElementsWithinElement(scrollableElement, direction);
				if (focusableElements.length) {
					elements = focusableElements;
					break;
				}
			}
		}

		if (!elements.length) {
			elements = gatherFocusableElementsWithinElement(document.body, direction);
		}
		return elements;
	}


	const lastFewMouseMovements: Array<{ x: number, y: number }> = [];
	function watchForTvMouseMove(event) {
		// abort if neiter direction is moving
		if (event.movementX === 0 && event.movementY === 0) {
			return;
		}

		// Consider the environment as a TV is the mouse moves exactly linearly for many consecutive events
		const SIGNIFICANCE_THRESHOLD = 50;
		const EVENTS_CAP = 100;

		lastFewMouseMovements.push({ x: event.movementY, y: event.movementY });

		if (lastFewMouseMovements.length > EVENTS_CAP) {
			console.log('Too many non-linear mousemovents. Not a TV.');
			return stopWatchingForTvMouseMove();
		}

		if (lastFewMouseMovements.length > SIGNIFICANCE_THRESHOLD) {
			const lastFewMouseMovementsToConsider = lastFewMouseMovements.slice(-SIGNIFICANCE_THRESHOLD);
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
		const isTv = window.matchMedia('(display-mode: fullscreen)').matches || window.matchMedia('(display-mode: minimal-ui)').matches;
		if (isTv) {
			console.log('TV environment detected');
			engageTvMode();
			return;
		}
		startWatchingForTvMouseMove();
	}

	return {
		lastMouseMove,
		lastMousePosition,
		lastDetectedDirection,
		lastMouseMoveTime,

		determineTvEnvironment,
		engageTvMode,
		disengageTvMode,
		enabled,

		setFocus,
	}
})
