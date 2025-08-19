import { ref } from 'vue'
import { defineStore } from 'pinia'
import { useFullscreenStore } from './fullscreenStore.store';

type Direction = 'up' | 'down' | 'left' | 'right';

export const focusAreaClass = 'tvNavigationFocusArea';


export const useTvNavigationStore = defineStore('TvNavigation', () => {
	const lastMouseMove = ref({ x: 0, y: 0 });
	const lastMousePosition = ref({ x: 0, y: 0 });
	const lastDetectedDirection = ref<Direction | null>(null);
	const lastKeyDown = ref<string | null>(null);
	const lastMouseMoveTime = ref(0);
	const detectedTv = ref(false);
	const detectedTouch = ref(false);
	const tvWasConfirmed = ref(false);
	const enabled = ref(false);

	async function handleMouseMove(event) {
		stopScreenEdgeScroll();

		lastMousePosition.value = { x: event.clientX, y: event.clientY };
		lastMouseMove.value = { x: event.movementX, y: event.movementY };
		lastMouseMoveTime.value = Date.now();

		let direction: Direction | null = null;

		if (event.movementX === 0 && event.movementY === 0) {
			return;
		}

		if (Math.abs(event.movementX) > Math.abs(event.movementY)) {
			direction = event.movementX > 0 ? 'right' : 'left';
		}
		else if (Math.abs(event.movementY) > Math.abs(event.movementX)) {
			direction = event.movementY > 0 ? 'down' : 'up';
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
		addEdgeScrollUi(direction);
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
		removeEdgeScrollUi();
	}

	function addEdgeScrollUi(direction: Direction) {
		removeEdgeScrollUi();
		const newEdgeScrollUi = document.createElement('div');
		newEdgeScrollUi.id = 'tvEdgeScrollUi';
		newEdgeScrollUi.style.position = 'fixed';

		// defaults
		newEdgeScrollUi.style.top = '10px';
		newEdgeScrollUi.style.bottom = '10px';
		newEdgeScrollUi.style.left = '10px';
		newEdgeScrollUi.style.right = '10px';
		newEdgeScrollUi.style.display = 'flex';
		newEdgeScrollUi.style.alignItems = 'center';
		newEdgeScrollUi.style.justifyContent = 'center';
		newEdgeScrollUi.style.zIndex = '9999';

		if (direction === 'up') {
			newEdgeScrollUi.style.bottom = '';
		}
		else if (direction === 'down') {
			newEdgeScrollUi.style.top = '';
		}
		else if (direction === 'left') {
			newEdgeScrollUi.style.right = '';
		}
		else if (direction === 'right') {
			newEdgeScrollUi.style.left = '';
		}

		const scrollIcon = document.createElement('i');
		scrollIcon.className = 'pi pi-angle-double-' + direction;
		scrollIcon.style.fontSize = '1.5rem';
		scrollIcon.style.color = 'white';
		scrollIcon.style.display = 'block';
		scrollIcon.style.textAlign = 'center';
		scrollIcon.style.lineHeight = '2em';
		scrollIcon.style.width = '2em';
		scrollIcon.style.height = '2em';
		scrollIcon.style.borderRadius = '50%';
		scrollIcon.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';

		newEdgeScrollUi.appendChild(scrollIcon);
		document.body.appendChild(newEdgeScrollUi);
	}

	function removeEdgeScrollUi() {
		const edgeScrollUi = document.getElementById('tvEdgeScrollUi');
		if (edgeScrollUi) {
			edgeScrollUi.remove();
		}
	}

	async function handleKeyDown(event) {
		stopScreenEdgeScroll();
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

	type ScrollElement = HTMLElement;
	type FocusableElement = HTMLElement;
	type FocusTarget = {
		element: FocusableElement;
		focusGroupStack: Array<ScrollElement>;
	}
	const focusTargets = new Map<FocusableElement, FocusTarget>();
	const focusGroups = new Map<ScrollElement, Array<FocusableElement>>();
	const lastFocusedEl = ref<FocusableElement | null>(null);


	const FOCUS_COOLDOWN = 200;
	let lastFocusTime = 0;
	async function moveFocus(direction: Direction = 'left') {
		if (lastFocusTime && Date.now() - lastFocusTime < FOCUS_COOLDOWN) {
			return;
		}

		lastFocusTime = Date.now();

		if (!lastFocusedEl.value) {
			findFocus();
			return;
		}

		const groupStack = focusTargets.get(lastFocusedEl.value)?.focusGroupStack;
		if (!groupStack) {
			console.error("No scrollable stack found for last focused element");
			findFocus();
			return;
		}

		lastDetectedDirection.value = direction;

		let elementToFocus: HTMLElement | null = null;
		for (const group of groupStack) {
			elementToFocus = await findNextFocusFromOptions(focusGroups.get(group) || [], direction);
			if (elementToFocus) {
				setFocus(elementToFocus);
				break;
			}
		}
		return elementToFocus;
	}


	async function findFocus() {
		const focusablePriority = Array.from(focusTargets.values()).map((focusTarget) => focusTarget.element)
			.sort((a, b) => {
				if (a.getAttribute('data-focus-priority') && b.getAttribute('data-focus-priority')) {
					return parseInt(a.getAttribute('data-focus-priority') || '0') - parseInt(b.getAttribute('data-focus-priority') || '0');
				}
				if (a.getAttribute('data-focus-priority')) {
					return -1;
				}
				if (b.getAttribute('data-focus-priority')) {
					return 1;
				}
				return 0;
			});
		setFocus(focusablePriority[0]);
	}
	function setFocus(element: HTMLElement | null) {
		if (element) {
			lastFocusedEl.value = element;
			lastFocusedEl.value.focus();
			lastFocusedEl.value.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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

		if (direction && lastFocusedEl.value) {
			const activeRect = lastFocusedEl.value.getBoundingClientRect();

			const options = elements.map((el) => {
				const elRect = el.getBoundingClientRect();

				if (el === lastFocusedEl.value || !compareForInclusion[direction](activeRect, elRect)) {
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

		const focusArea = document.getElementsByClassName(focusAreaClass)[0] || document.body;
		let elements = Array.from(focusArea.querySelectorAll(query)) as Array<HTMLElement>;

		// Gather the focusGroup for each element
		for (const el of elements) {
			// Create a stack of scrollable elements containing either other scrollable elements or the focused element
			const scrollableStack: Array<HTMLElement> = [];
			let currentElement: HTMLElement | null = el;
			do {
				if (currentElement.scrollHeight > currentElement.clientHeight || currentElement.scrollWidth > currentElement.clientWidth || currentElement === focusArea) {
					scrollableStack.push(currentElement);
					// Add focus target to element focusGroups
					const newGroupEl = currentElement as ScrollElement;
					if (!focusGroups.has(newGroupEl)) {
						focusGroups.set(newGroupEl, []);
					}
					focusGroups.get(newGroupEl)?.push(el);
				}
				if (currentElement === focusArea) {
					break;
				}
				currentElement = currentElement.parentElement;
			} while (currentElement);
			focusTargets.set(el, {
				element: el,
				focusGroupStack: scrollableStack,
			});
		}

		// Check if the last focused element is still in the focus targets
		if (lastFocusedEl.value && !focusTargets.has(lastFocusedEl.value)) {
			findFocus();
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




	const lastFewMouseMovements: Array<{ x: number, y: number }> = [];
	function watchForTvMouseMove(event) {
		// abort if neiter direction is moving
		if (event.movementX === 0 && event.movementY === 0) {
			return;
		}

		// Consider the environment as a TV is the mouse moves exactly linearly for many consecutive events
		const SIGNIFICANCE_THRESHOLD = 25;
		const EVENTS_CAP = 100;

		lastFewMouseMovements.push({ x: event.movementX, y: event.movementY });

		if (lastFewMouseMovements.length > EVENTS_CAP) {
			console.log('Too many non-linear mouse movements. Not a TV.');
			return finalizeTvDetection(false);
		}

		if (lastFewMouseMovements.length > SIGNIFICANCE_THRESHOLD) {
			const lastFewMouseMovementsToConsider = lastFewMouseMovements.slice(-SIGNIFICANCE_THRESHOLD);
			const isTv = lastFewMouseMovementsToConsider.every((movement) => movement.x === 0 || movement.y === 0);
			if (isTv) {
				console.log('TV environment detected from mouse movements');
				return finalizeTvDetection(true);
			}
		}
	}


	let suggestTvModeHandler: (() => Promise<boolean>) | null = null;
	let onTvDetected: (() => Promise<boolean>) | null = null;

	function determineTvEnvironment(confirmationCb?: () => Promise<boolean>) {
		suggestTvModeHandler = confirmationCb || null;
		console.log('Determining TV environment...');
		const isTv = window.matchMedia('(display-mode: fullscreen)').matches || window.matchMedia('(display-mode: minimal-ui)').matches;
		if (isTv) {
			console.log('TV environment detected');
			finalizeTvDetection(true);
			return;
		}
		window.addEventListener('mousemove', watchForTvMouseMove);
		window.addEventListener('touchstart', onScreenTouch);
	}

	function onScreenTouch() {
		console.log('Screen touch detected. Not a TV environment.');
		detectedTouch.value = true;
		finalizeTvDetection(false);
	}

	async function finalizeTvDetection(isTv: boolean) {
		window.removeEventListener('mousemove', watchForTvMouseMove);
		window.removeEventListener('touchstart', onScreenTouch);

		if (!isTv) {
			console.log('TV environment not detected');
			detectedTv.value = false;
			disengageTvMode();
			return;
		}

		detectedTv.value = true;

		let shouldDoTvNav = false; // disabling focus-based tv nav

		const localStorageKey = 'tvNavigationPreference.2';

		if (shouldDoTvNav && suggestTvModeHandler) {
			shouldDoTvNav = await suggestTvModeHandler();
			if (!shouldDoTvNav) {
				localStorage.setItem(localStorageKey, 'false');
				console.log('TV environment was declined');
			}
		}

		if (!shouldDoTvNav) {
			tvWasConfirmed.value = false;
			disengageTvMode();
		} else {
			tvWasConfirmed.value = true;
			engageTvMode();
		}

		if (onTvDetected) {
			onTvDetected();
		}
	}


	function captureClick(event) {
		useFullscreenStore().userFullscreenRequest();
		event.stopPropagation();
		event.preventDefault();
		lastFocusedEl.value?.click();
	}


	function engageTvMode() {
		enabled.value = true;

		// create click capture element
		const clickCapture = document.createElement('div');
		clickCapture.id = 'tvClickCapture';
		clickCapture.style.position = 'fixed';
		clickCapture.style.top = '0';
		clickCapture.style.left = '0';
		clickCapture.style.width = '100%';
		clickCapture.style.height = '100%';
		clickCapture.style.zIndex = '9999';
		clickCapture.style.opacity = '0';
		clickCapture.style.cursor = 'none';
		clickCapture.addEventListener('click', captureClick);
		document.body.appendChild(clickCapture);

		window.addEventListener('mousemove', handleMouseMove);
		window.addEventListener('mouseout', handleMouseOut);
		window.addEventListener('keydown', handleKeyDown);

		findFocus();
	}
	function disengageTvMode() {
		document.getElementById('tvClickCapture')?.remove();
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
		lastFocusedEl,

		determineTvEnvironment,
		engageTvMode,
		disengageTvMode,

		detectedTv,
		detectedTouch,
		onTvDetected: (cb) => onTvDetected = cb,
		tvWasConfirmed,
		enabled,

		setFocus,
	}
})
