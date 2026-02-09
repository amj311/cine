import { ref } from 'vue'
import { defineStore } from 'pinia'
import { useFullscreenStore } from './fullscreenStore.store';
import { useSettingsStore } from './settings.store';

type Direction = 'up' | 'down' | 'left' | 'right';

export const focusAreaClass = 'tvNavigationFocusArea';


export const useScreenStore = defineStore('Screen', () => {
	// load saved settings
	const localSettings = useSettingsStore().localSettings;

	const lastMouseMove = ref({ x: 0, y: 0 });
	const lastMousePosition = ref({ x: 0, y: 0 });
	const lastDetectedDirection = ref<Direction | null>(null);
	const lastKeyDown = ref<string | null>(null);
	const lastMouseMoveTime = ref(0);
	const detectedTv = ref(localSettings.is_tv || false);
	const detectedTouch = ref(false);
	const tvWasConfirmed = ref(false);
	const tvNavEnabled = ref(false);

	let FOCUS_COOLDOWN = 0;
	let lastFocusTime = 0;

	const isSkinnyScreen = ref(window.innerWidth < 768);
	function updateMobileNav() {
		isSkinnyScreen.value = window.innerWidth < 768;
	}
	window.addEventListener('resize', updateMobileNav);
	updateMobileNav();

	async function handleMouseMove(event) {
		const edgeDirection = detectEdge(event);
		if (edgeDirection) {
			return doScreenEdgeScroll(edgeDirection);
		}

		FOCUS_COOLDOWN = 250;
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

	function detectEdge(event): Direction | null {
		const edgeBuffer = 2;
		if (event.clientX <= edgeBuffer) {
			return 'left';
		} else if (event.clientX >= window.innerWidth - edgeBuffer) {
			return 'right';
		} else if (event.clientY <= edgeBuffer) {
			return 'up';
		} else if (event.clientY >= window.innerHeight - edgeBuffer) {
			return 'down';
		}
		return null;
	}

	function handleMouseOut(event) {
		// Assume user is pushing mouse to edge of screen to conitune scrolling
		// Since no events will be triggered until the mouse is back in the window,
		// We will need to continue moving focus in the last direction until a different event is fired.
		const direction = detectEdge(event);

		if (!direction) {
			return;
		}
		doScreenEdgeScroll(direction);
	}

	let edgeScrollInterval: ReturnType<typeof setInterval> | null = null;

	function doScreenEdgeScroll(direction: Direction) {
		console.log("Mouse is out of window. Will continue scrolling:", direction);

		FOCUS_COOLDOWN = 100;
		let edgeScrollTime = FOCUS_COOLDOWN + 10;

		if (edgeScrollInterval) {
			clearInterval(edgeScrollInterval);
		}
		updateEdgeScrollUi(direction);
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

	function createEdgeScrollUi() {
		const newEdgeScrollUi = document.createElement('div');
		newEdgeScrollUi.id = 'tvEdgeScrollUi';
		newEdgeScrollUi.style.position = 'fixed';

		// defaults
		newEdgeScrollUi.style.display = 'flex';
		newEdgeScrollUi.style.alignItems = 'center';
		newEdgeScrollUi.style.justifyContent = 'center';
		newEdgeScrollUi.style.zIndex = '9999';

		const scrollIcon = document.createElement('i');
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
	function updateEdgeScrollUi(direction: Direction) {
		const edgeScrollUi = document.getElementById('tvEdgeScrollUi');
		if (!edgeScrollUi) {
			createEdgeScrollUi();
			return updateEdgeScrollUi(direction);
		}

		// defaults
		edgeScrollUi.style.display = 'block';
		edgeScrollUi.style.top = '10px';
		edgeScrollUi.style.bottom = '10px';
		edgeScrollUi.style.left = '10px';
		edgeScrollUi.style.right = '10px';

		if (direction === 'up') {
			edgeScrollUi.style.left = '50%';
			edgeScrollUi.style.bottom = '';
		}
		else if (direction === 'down') {
			edgeScrollUi.style.left = '50%';
			edgeScrollUi.style.top = '';
		}
		else if (direction === 'left') {
			edgeScrollUi.style.top = '50%';
			edgeScrollUi.style.right = '';
		}
		else if (direction === 'right') {
			edgeScrollUi.style.top = '50%';
			edgeScrollUi.style.left = '';
		}

		const scrollIcon = edgeScrollUi.querySelector('i')!;
		scrollIcon.className = 'pi pi-angle-double-' + direction;
	}

	function removeEdgeScrollUi() {
		const edgeScrollUi = document.getElementById('tvEdgeScrollUi');
		if (edgeScrollUi) {
			edgeScrollUi.style.display = 'none';
		}
	}

	async function handleKeyDown(event) {
		stopScreenEdgeScroll();
		lastKeyDown.value = event.key;
		if (event.key === 'Enter' || event.key === ' ') {
			captureClick(event);
			return;
		}

		FOCUS_COOLDOWN = 100;
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
				break;
			}
		}

		// If no natural element found, look for jump rows
		if (!elementToFocus && lastFocusedEl.value?.dataset.tvnavjumprow) {
			const jumpEls = document.querySelectorAll<HTMLElement>(`[data-tvnavjumprow="${lastFocusedEl.value.dataset.tvnavjumprow}"]`);
			elementToFocus = await findNextFocusFromOptions(Array.from(jumpEls), direction, true);
		}

		if (elementToFocus) {
			setFocus(elementToFocus);
		}

		return elementToFocus;
	}


	async function findFocus() {
		const focusablePriority = Array.from(focusTargets.values()).map((focusTarget) => focusTarget.element)
			.sort((a, b) => {
				if (a.getAttribute('data-focus-priority') && b.getAttribute('data-focus-priority')) {
					return parseInt(b.getAttribute('data-focus-priority') || '0') - parseInt(a.getAttribute('data-focus-priority') || '0');
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
		if (lastFocusedEl.value) {
			lastFocusedEl.value.removeAttribute('tv-focus');
		}
		if (element) {
			lastFocusedEl.value = element;
			if (!lastFocusedEl.value.dataset.tvnav_noscroll) {
				lastFocusedEl.value.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
			}
			lastFocusedEl.value.setAttribute('tv-focus', 'true');
		}
	}

	async function findNextFocusFromOptions(elements: HTMLElement[], direction: Direction | null, skipFilters = false) {
		// If looking in a specific direction, filter the elements
		const rowMarginOfError = 50;

		function isSameRow(active, other) {
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
			up: [['top', 'bottom'], ['left', 'left']],
			down: [['bottom', 'top'], ['left', 'left']],
			left: [['left', 'right'], ['top', 'top']],
			right: [['right', 'left'], ['top', 'top']],
		}

		if (direction && lastFocusedEl.value) {
			const activeRect = lastFocusedEl.value.getBoundingClientRect();

			const allOptions = elements.filter(el => el !== lastFocusedEl.value).map((el) => {
				const elRect = el.getBoundingClientRect();

				const distanceScores = sidesToPrioritizeForDistance[direction].reduce((acc, [activeSide, otherSide]) => {
					const activeSideValue = activeRect[activeSide];
					const otherSideValue = elRect[otherSide];
					const distance = Math.abs(activeSideValue - otherSideValue);
					acc[activeSide + otherSide] = distance;
					return acc;
				}, {} as any);

				return {
					element: el,
					rect: elRect,
					distanceScores,
				}
			});

			const distanceSort = (a, b) => {
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
			};

			const rowColOptions = allOptions.filter(o => skipFilters || compareForInclusion[direction](activeRect, o.rect)).sort(distanceSort);
			return rowColOptions[0]?.element;
		}

		return elements[0];
	}


	// TESTING MUTATION OBSERVER!!!
	const observer = new MutationObserver(debounceGatherFocusable);


	async function gatherFocusTargets() {
		focusTargets.clear();
		focusGroups.clear();

		const focusElements = ['[href]', 'button', 'input', 'select', 'textarea', '[tabindex]', '.clickable', 'details', 'summary', '#overlay_menu_list li', '.p-toggleswitch'];
		const query = focusElements.map(el => el + ':not([disabled]:not([disabled="false"])):not(.p-disabled):not([tabindex="-1"]):not(#overlay_menu_list):not(.p-hidden-accessible):not(p-hidden-focusable)').join(', ');

		// find highest priority focus area
		let focusArea;
		const focusAreaSelectors = ['.p-datepicker-panel', '#overlay_menu', '.p-dialog', '.' + focusAreaClass];
		for (const selector of focusAreaSelectors) {
			focusArea = document.querySelector(selector);
			if (focusArea) break;
		}

		const searchArea = focusArea || document.body;

		let elements = Array.from(searchArea.querySelectorAll(query)) as Array<HTMLElement>;

		// Gather the focusGroup for each element
		for (const el of elements) {
			// Create a stack of scrollable elements containing either other scrollable elements or the focused element
			const scrollableStack: Array<HTMLElement> = [];
			let currentElement: HTMLElement | null = el;
			do {
				if (currentElement.scrollHeight > currentElement.clientHeight || currentElement.scrollWidth > currentElement.clientWidth || currentElement === searchArea) {
					scrollableStack.push(currentElement);
					// Add focus target to element focusGroups
					const newGroupEl = currentElement as ScrollElement;
					if (!focusGroups.has(newGroupEl)) {
						focusGroups.set(newGroupEl, []);
					}
					focusGroups.get(newGroupEl)?.push(el);
				}
				if (currentElement === searchArea) {
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
			console.info('Too many non-linear mouse movements. Not a TV.');
			return finalizeTvDetection(false);
		}

		if (lastFewMouseMovements.length > SIGNIFICANCE_THRESHOLD) {
			const lastFewMouseMovementsToConsider = lastFewMouseMovements.slice(-SIGNIFICANCE_THRESHOLD);
			const isTv = lastFewMouseMovementsToConsider.every((movement) => movement.x === 0 || movement.y === 0);
			if (isTv) {
				console.info('TV environment detected from mouse movements');
				return finalizeTvDetection(true);
			}
		}
	}


	let suggestTvModeHandler: (() => Promise<boolean>) | null = null;
	let onTvDetected: (() => Promise<boolean>) | null = null;

	function determineTvEnvironment(confirmationCb?: () => Promise<boolean>) {
		suggestTvModeHandler = confirmationCb || null;
		console.log('Determining TV environment...');
		const isTv = localSettings.is_tv;// || window.matchMedia('(display-mode: fullscreen)').matches || window.matchMedia('(display-mode: minimal-ui)').matches;

		if (isTv) {
			console.info('TV environment detected');
			finalizeTvDetection(true);
			return;
		}

		if (isSkinnyScreen.value) {
			console.info("Screen is too small to be TV");
			return;
		}

		window.addEventListener('mousemove', watchForTvMouseMove);
	}

	function detectTouchScreen() {
		console.info('Screen touch detected. Not a TV environment.');
		detectedTouch.value = true;
		finalizeTvDetection(false);
		window.removeEventListener('touchstart', detectTouchScreen);
	}
	window.addEventListener('touchstart', detectTouchScreen);


	async function finalizeTvDetection(isTv: boolean) {
		window.removeEventListener('mousemove', watchForTvMouseMove);
		window.removeEventListener('touchstart', detectTouchScreen);

		if (!isTv) {
			console.info('TV environment not detected');
			detectedTv.value = false;
			// also remove tv from settings
			localSettings.is_tv = false;
			disengageTvMode();
			return;
		}

		detectedTv.value = true;
		localSettings.is_tv = true;

		console.info('TV confirmed')

		// auto tv nav
		let shouldCheckForTvNav = localSettings.tv_nav;

		if (shouldCheckForTvNav && suggestTvModeHandler) {
			shouldCheckForTvNav = await suggestTvModeHandler();
			if (!shouldCheckForTvNav) {
				// localSettings.tv_nav = false;
				console.info('TV environment was declined');
			}
		}

		if (!shouldCheckForTvNav) {
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
		// useFullscreenStore().userFullscreenRequest();
		event.stopPropagation();
		event.preventDefault();

		// try to click within an element when helpful
		const clicker = lastFocusedEl.value?.querySelector('a,input') as HTMLElement || lastFocusedEl.value;
		clicker?.click();
		clicker?.focus();
	}


	let clickCapture = document.createElement('div');
	function engageTvMode() {
		console.log("Engaging TV nav mode...")
		tvNavEnabled.value = true;

		// create click capture element
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


		observer.observe(document.body, {
			childList: true,
			subtree: true,
		});
		gatherFocusTargets();
		findFocus();
		console.log("TV nav enabled.")
	}
	function disengageTvMode() {
		setFocus(null);
		clickCapture.remove();
		window.removeEventListener('mousemove', handleMouseMove);
		window.removeEventListener('mouseout', handleMouseOut);
		window.removeEventListener('keydown', handleKeyDown);
		tvNavEnabled.value = false;
		observer.disconnect();
		console.log("TV nav disabled.")
	}



	return {
		lastMouseMove,
		lastMousePosition,
		lastDetectedDirection,
		lastMouseMoveTime,
		lastKeyDown,
		lastFocusedEl,

		isSkinnyScreen,
		detectedTouch,

		determineTvEnvironment,
		detectedTv,
		onTvDetected: (cb) => onTvDetected = cb,
		tvWasConfirmed,

		setAsTv(enabled: boolean) {
			finalizeTvDetection(enabled);
		},
		setTvNavigation(enabled: boolean) {
			if (enabled) {
				engageTvMode();
			}
			else {
				disengageTvMode();
			}
		},
		engageTvMode,
		disengageTvMode,
		tvNavEnabled,

		setFocus,
	}
})
