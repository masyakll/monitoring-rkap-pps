export type FormatType = 'dollar' | 'rupiah' | 'percent' | 'integer' | 'decimal';

export function formatAnimatedValue(
  val: number,
  format?: FormatType,
  prefix = '',
  suffix = '',
  decimals = 0
): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return '—';

  let formatted = '';
  switch (format) {
    case 'dollar':
      formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: decimals,
        minimumFractionDigits: decimals
      }).format(val);
      break;
    case 'rupiah':
      formatted = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: decimals,
        minimumFractionDigits: decimals
      }).format(val);
      break;
    case 'percent':
      formatted = `${new Intl.NumberFormat('id-ID', {
        maximumFractionDigits: decimals,
        minimumFractionDigits: decimals
      }).format(val)}%`;
      break;
    case 'decimal':
      formatted = new Intl.NumberFormat('id-ID', {
        maximumFractionDigits: decimals,
        minimumFractionDigits: decimals
      }).format(val);
      break;
    case 'integer':
    default:
      formatted = new Intl.NumberFormat('id-ID', {
        maximumFractionDigits: 0
      }).format(Math.round(val));
      break;
  }

  return `${prefix}${formatted}${suffix}`;
}

export function countUp(
  node: HTMLElement,
  initialOptions: {
    value: number | null | undefined;
    format?: FormatType;
    prefix?: string;
    suffix?: string;
    decimals?: number;
    duration?: number;
  }
) {
  let options = initialOptions;
  let currentValue = 0;
  let targetValue = Number.isFinite(Number(options.value)) ? Number(options.value) : 0;
  let hasValue = options.value !== null && options.value !== undefined && Number.isFinite(Number(options.value));
  let animationFrameId: number | null = null;

  function stopAnimation() {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }

  function render(value: number) {
    if (!hasValue) {
      node.textContent = '—';
      return;
    }

    const defaultDecimals = options.format === 'percent' || options.format === 'decimal' ? 1 : 0;
    node.textContent = formatAnimatedValue(
      value,
      options.format,
      options.prefix,
      options.suffix,
      options.decimals ?? defaultDecimals
    );
  }

  function startAnimation(startValue: number, endValue: number) {
    stopAnimation();

    const duration = Math.max(0, options.duration ?? 1200);
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotion || duration === 0 || startValue === endValue) {
      currentValue = endValue;
      render(endValue);
      return;
    }

    let startTime: number | null = null;

    const step = (timestamp: number) => {
      if (startTime === null) startTime = timestamp;
      const progress = Math.min(1, (timestamp - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      currentValue = startValue + (endValue - startValue) * eased;
      render(currentValue);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      } else {
        currentValue = endValue;
        render(endValue);
        animationFrameId = null;
      }
    };

    animationFrameId = requestAnimationFrame(step);
  }

  if (hasValue) {
    startAnimation(0, targetValue);
  } else {
    node.textContent = '—';
  }

  return {
    update(newOptions: typeof initialOptions) {
      options = newOptions;
      const validValue = newOptions.value !== null &&
        newOptions.value !== undefined &&
        Number.isFinite(Number(newOptions.value));

      if (!validValue) {
        hasValue = false;
        stopAnimation();
        node.textContent = '—';
        return;
      }

      const nextTarget = Number(newOptions.value);
      if (!hasValue) {
        hasValue = true;
        currentValue = 0;
        targetValue = nextTarget;
        startAnimation(0, nextTarget);
        return;
      }

      if (nextTarget !== targetValue) {
        targetValue = nextTarget;
        startAnimation(currentValue, targetValue);
      } else {
        render(currentValue);
      }
    },
    destroy() {
      stopAnimation();
    }
  };
}
