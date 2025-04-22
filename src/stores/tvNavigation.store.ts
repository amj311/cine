import { computed, reactive, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useRouter } from 'vue-router';

export const useTvNavigationStore = defineStore('TvNavigation', () => {
	const lastMouseMoveEvent = ref('');
	const lastKeydownEvent = ref('');
	const enabled = ref(false);

	type Direction = 'up' | 'down' | 'left' | 'right';
	const mouseCooldown = 200;
	let lastMouseMoveTime = 0;

	let preClickElement: HTMLElement | null = null;

	function captureClick(event) {
		console.log('click', event);
		preClickElement?.click();
	}

	function handleMouseMove(event) {
		if (Date.now() - lastMouseMoveTime < mouseCooldown) {
			return;
		}
		lastMouseMoveTime = Date.now();
		lastMouseMoveEvent.value = `Mouse moved to (${event.clientX}, ${event.clientY})`;
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
		lastMouseMoveEvent.value += `, moved ${direction}`;
		// console.log(lastMouseMoveEvent.value);
		moveFocus(direction);
	}

	function handleKeyDown(event) {
		if (event.key === 'Enter' || event.key === ' ') {
			lastKeydownEvent.value = 'Enter or Space pressed';
			captureClick(event);
			return;
		}
		let direction = '';
		switch (event.key) {
			case 'ArrowUp':
				lastKeydownEvent.value = 'Up arrow pressed';
				direction = 'up';
				break;
			case 'ArrowDown':
				lastKeydownEvent.value = 'Down arrow pressed';
				direction = 'down';
				break;
			case 'ArrowLeft':
				lastKeydownEvent.value = 'Left arrow pressed';
				direction = 'left';
				break;
			case 'Tab':
			case 'ArrowRight':
				lastKeydownEvent.value = 'Right arrow pressed';
				direction = 'right';
				break;
			default:
				lastKeydownEvent.value = `Other key pressed: ${event.key}`;
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

	function moveFocus(direction: 'up' | 'down' | 'left' | 'right') {
		const focusableElements = gatherFocusableElements(direction);

		// switch (direction) {
		// 	case 'up':
		// 		nextIndex = currentIndex - 1;
		// 		break;
		// 	case 'down':
		// 		nextIndex = currentIndex + 1;
		// 		break;
		// 	case 'left':
		// 		nextIndex = currentIndex - 1;
		// 		break;
		// 	case 'right':
		// 		nextIndex = currentIndex + 1;
		// 		break;
		// }

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

		console.log('gatherFocusableElements', direction, elements.length);

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
			console.log('options', options);
			elements = options.map((option) => option.element);
		}

		console.log('Focusable elements:', elements);
		return elements;
	}

	return {
		lastMouseMoveEvent,
		lastKeydownEvent,
		gatherFocusableElements,

		engageTvMode,
		enabled,

		setFocus,
	}
})
