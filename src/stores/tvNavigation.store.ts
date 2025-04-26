import { nextTick, ref } from 'vue'
import { defineStore } from 'pinia'

type Direction = 'up' | 'down' | 'left' | 'right';

export const useTvNavigationStore = defineStore('TvNavigation', () => {
	const lastMouseMove = ref({ x: 0, y: 0 });
	const lastMousePosition = ref({ x: 0, y: 0 });
	const lastDetectedDirection = ref<Direction | null>(null);
	const lastKeyDown = ref<string | null>(null);
	const lastMouseMoveTime = ref(0);
	const detectedTv = ref(false);
	const tvWasConfirmed = ref(false);
	const enabled = ref(false);
	let computingNewFocus = false;

	function captureClick(event) {
		event.stopPropagation();
		event.preventDefault();
		lastFocusedEl?.click();
	}

	const mouseCooldown = 300;

	async function handleMouseMove(event) {
		stopScreenEdgeScroll();

		if (computingNewFocus || Date.now() - lastMouseMoveTime.value < mouseCooldown) {
			return;
		}

		const deltaX = event.clientX - lastMousePosition.value.x;
		const deltaY = event.clientY - lastMousePosition.value.y;

		lastMousePosition.value = { x: event.clientX, y: event.clientY };
		lastMouseMove.value = { x: deltaX, y: deltaY };
		lastMouseMoveTime.value = Date.now();

		let direction: Direction | null = null;

		if (deltaX === 0 && deltaY === 0) {
			return;
		}

		if (Math.abs(deltaX) > Math.abs(deltaY)) {
			direction = deltaX > 0 ? 'right' : 'left';
		}
		else if (Math.abs(deltaY) > Math.abs(deltaX)) {
			direction = deltaY > 0 ? 'down' : 'up';
		}

		if (direction) {
			await moveFocus(direction);
		}
	}
	function handleMouseOut(event) {
		// Assume user is pushing mouse to edge of screen to conitune scrolling
		// Since no events will be triggered until the mouse is back in the window,
		// We will need to continue moving focus in the last direction until a different event is fired.
		let direction: Direction | null = null;
		if (event.clientX <= 1) {
			direction = 'left';
		} else if (event.clientX >= window.innerWidth - 1) {
			direction = 'right';
		} else if (event.clientY <= 1) {
			direction = 'up';
		} else if (event.clientY >= window.innerHeight - 1) {
			console.log("GOING DOWN!!!!")
			direction = 'down';
		}
		if (!direction) {
			return;
		}
		console.log("Mouse is out of window. Will continue scrolling:", direction);
		doScreenEdgeScroll(direction);
	}

	let edgeScrollTime = 500;
	let edgeScrollInterval: ReturnType<typeof setInterval> | null = null;

	function doScreenEdgeScroll(direction: Direction) {
		if (edgeScrollInterval) {
			clearInterval(edgeScrollInterval);
		}
		edgeScrollInterval = setInterval(async () => {
			const newEl = await moveFocus(direction);
			if (!newEl) {
				stopScreenEdgeScroll();
			}
		}, edgeScrollTime);
	}

	function stopScreenEdgeScroll() {
		if (edgeScrollInterval) {
			clearInterval(edgeScrollInterval);
			edgeScrollInterval = null;
		}
	}


	async function handleKeyDown(event) {
		stopScreenEdgeScroll();
		if (computingNewFocus) {
			return;
		}

		lastKeyDown.value = event.key;
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
		await moveFocus(direction as Direction);
	}

	const lastFewMouseMovements: Array<{ x: number, y: number }> = [];
	function watchForTvMouseMove(event) {
		// abort if neiter direction is moving
		if (event.movementX === 0 && event.movementY === 0) {
			return;
		}

		// Consider the environment as a TV is the mouse moves exactly linearly for many consecutive events
		const SIGNIFICANCE_THRESHOLD = 25;
		const EVENTS_CAP = 100;

		lastFewMouseMovements.push({ x: event.movementY, y: event.movementY });

		if (lastFewMouseMovements.length > EVENTS_CAP) {
			console.log('Too many non-linear mouse movements. Not a TV.');
			return stopWatchingForTvMouseMove();
		}

		if (lastFewMouseMovements.length > SIGNIFICANCE_THRESHOLD) {
			const lastFewMouseMovementsToConsider = lastFewMouseMovements.slice(-SIGNIFICANCE_THRESHOLD);
			const isTv = lastFewMouseMovementsToConsider.every((movement) => movement.x === 0 || movement.y === 0);
			if (isTv) {
				return stopWatchingForTvMouseMove(true);
			}
		}
	}


	let tvConfirmationCb: (() => Promise<boolean>) | null = null;
	function determineTvEnvironment(confirmationCb: () => Promise<boolean>) {
		tvConfirmationCb = confirmationCb;
		const isTv = window.matchMedia('(display-mode: fullscreen)').matches || window.matchMedia('(display-mode: minimal-ui)').matches;
		if (isTv) {
			console.log('TV environment detected');
			doTvConfirmation();
			return;
		}
		startWatchingForTvMouseMove();
	}


	function startWatchingForTvMouseMove() {
		console.log('Watching for TV mouse move');
		window.addEventListener('mousemove', watchForTvMouseMove);
	};

	function stopWatchingForTvMouseMove(success: boolean = false) {
		console.log('Stopped watching for TV mouse move');
		window.removeEventListener('mousemove', watchForTvMouseMove);
		if (success) {
			doTvConfirmation();
		}
		else {
			disengageTvMode();
		}
	}

	function doTvConfirmation() {
		detectedTv.value = true;
		const localStorageKey = 'tvNavigationPreference.2';
		if (localStorage.getItem(localStorageKey) === 'false') {
			console.log('TV environment was previously declined');
			disengageTvMode();
			return;
		}
		if (!tvConfirmationCb) {
			console.error('No confirmation callback set');
			return;
		}
		tvConfirmationCb().then((confirmed) => {
			localStorage.setItem(localStorageKey, confirmed ? 'true' : 'false');
			if (confirmed) {
				console.log('Confirmed TV environment');
				tvWasConfirmed.value = true;
				engageTvMode();
			} else {
				tvWasConfirmed.value = false;
				console.log('Declined TV environment');
				disengageTvMode();
			}
		}).catch((err) => {
			console.error('Error confirming TV environment:', err);
		});
	}

	type ScrollElement = HTMLElement;
	type FocusableElement = HTMLElement;
	type FocusTarget = {
		element: FocusableElement;
		focusGroupStack: Array<ScrollElement>;
	}
	const focusTargets = new Map<FocusableElement, FocusTarget>();
	const focusGroups = new Map<ScrollElement, Array<FocusableElement>>();
	let lastFocusedEl: HTMLElement | null = null;


	async function moveFocus(direction: Direction = 'left') {
		if (computingNewFocus) {
			return;
		}
		if (!lastFocusedEl) {
			findFocus();
			return;
		}

		const groupStack = focusTargets.get(lastFocusedEl)?.focusGroupStack;
		if (!groupStack) {
			console.error("No scrollable stack found for last focused element");
			findFocus();
			return;
		}

		computingNewFocus = true;
		lastDetectedDirection.value = direction;

		let elementToFocus: HTMLElement | null = null;
		for (const group of groupStack) {
			elementToFocus = await findNextFocusFromOptions(focusGroups.get(group) || [], direction);
			if (elementToFocus) {
				setFocus(elementToFocus);
				break;
			}
		}
		computingNewFocus = false;
		return elementToFocus;
	}


	// Just set the first focus item.
	async function findFocus() {
		setFocus(Array.from(focusTargets.values())[0].element);
	}
	function setFocus(element: HTMLElement | null) {
		if (element) {
			lastFocusedEl = element;
			lastFocusedEl.focus();
			lastFocusedEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
		}
	}

	async function findNextFocusFromOptions(elements: HTMLElement[], direction: Direction | null) {
		// If looking in a specific direction, filter the elements
		const rowMarginOfError = 50;

		const isSameRow = (active, other) => {
			return Math.abs(active.top - other.top) < rowMarginOfError || Math.abs(active.bottom - other.bottom) < rowMarginOfError;
		}
		const compareForInclusion = {
			up: (active, other) => other.bottom <= active.top,
			down: (active, other) => active.bottom <= other.top,
			left: (active, other) => other.right <= active.left && isSameRow(active, other),
			right: (active, other) => active.right <= other.left && isSameRow(active, other),
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

		return elements[0];
	}


	// TESTING MUTATION OBSERVER!!!
	const observer = new MutationObserver(debounceGatherFocusable);
	observer.observe(document.body, {
		childList: true,
		subtree: true,
	});


	async function gatherFocusTargets() {
		focusTargets.clear();
		focusGroups.clear();

		const focusElements = ['[href]', 'button', 'input', 'select', 'textarea', '[tabindex]', 'details', 'summary'];
		const query = focusElements.map(el => el + ':not([disabled]:not([disabled="false"])):not([tabindex="-1"])').join(', ');

		let elements = Array.from(document.body.querySelectorAll(query)) as Array<HTMLElement>;

		// Gather the focusGroup for each element
		for (const el of elements) {
			// Create a stack of scrollable elements containing either other scrollable elements or the focused element
			const scrollableStack: Array<HTMLElement> = [];
			let currentElement: HTMLElement | null = el;
			do {
				if (currentElement.scrollHeight > currentElement.clientHeight || currentElement.scrollWidth > currentElement.clientWidth || currentElement === document.body) {
					scrollableStack.push(currentElement);
					// Add focus target to element focusGroups
					const newGroupEl = currentElement as ScrollElement;
					if (!focusGroups.has(newGroupEl)) {
						focusGroups.set(newGroupEl, []);
					}
					focusGroups.get(newGroupEl)?.push(el);
				}
				if (currentElement === document.body) {
					break;
				}
				currentElement = currentElement.parentElement;
			} while (currentElement);
			focusTargets.set(el, {
				element: el,
				focusGroupStack: scrollableStack,
			});
		}
	}

	const gatherFocusableCooldown = 200;
	let gatherFocusableTimeout: ReturnType<typeof setTimeout> | null = null;
	function debounceGatherFocusable() {
		if (gatherFocusableTimeout) {
			clearTimeout(gatherFocusableTimeout);
		}
		gatherFocusableTimeout = setTimeout(gatherFocusTargets, gatherFocusableCooldown);
	};




	function engageTvMode() {
		enabled.value = true;
		nextTick(() => {
			document.getElementById('tvClickCapture')!.addEventListener('click', captureClick);
			window.addEventListener('mousemove', handleMouseMove);
			window.addEventListener('mouseout', handleMouseOut);
			window.addEventListener('keydown', handleKeyDown);

			findFocus();
		});
	}
	function disengageTvMode() {
		document.getElementById('tvClickCapture')?.removeEventListener('click', captureClick);
		window.removeEventListener('mousemove', handleMouseMove);
		window.removeEventListener('mouseout', handleMouseOut);
		window.removeEventListener('keydown', handleKeyDown);
		enabled.value = false;
	}



	return {
		lastMouseMove,
		lastMousePosition,
		lastDetectedDirection,
		lastMouseMoveTime,
		lastKeyDown,

		determineTvEnvironment,
		engageTvMode,
		disengageTvMode,

		detectedTv,
		tvWasConfirmed,
		enabled,

		setFocus,
	}
})
