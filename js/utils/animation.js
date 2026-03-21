/**
 * 动画工具类
 */
export class AnimationUtils {
  /**
   * 线性插值
   * @param {number} start - 起始值
   * @param {number} end - 结束值
   * @param {number} t - 插值因子 (0-1)
   * @returns {number}
   */
  static lerp(start, end, t) {
    return start + (end - start) * t;
  }

  /**
   * 平滑插值（ease-in-out）
   * @param {number} t - 插值因子 (0-1)
   * @returns {number}
   */
  static easeInOut(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  /**
   * 弹性缓动
   * @param {number} t - 插值因子 (0-1)
   * @returns {number}
   */
  static elastic(t) {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4);
  }

  /**
   * 创建动画循环
   * @param {Function} callback - 每帧回调
   * @param {number} targetFPS - 目标帧率
   * @returns {Object} 控制器 { start, stop, isRunning }
   */
  static createAnimationLoop(callback, targetFPS = 60) {
    const frameInterval = 1000 / targetFPS;
    let lastTime = 0;
    let animationId = null;
    let isRunning = false;

    const loop = (currentTime) => {
      if (!isRunning) return;
      
      animationId = requestAnimationFrame(loop);
      
      try {
        const delta = currentTime - lastTime;
        if (delta < frameInterval) return;
        
        lastTime = currentTime - (delta % frameInterval);
        callback(delta);
      } catch (error) {
        console.error('Animation loop error:', error);
        // 继续循环，不要因为错误而停止
      }
    };

    return {
      start() {
        if (isRunning) return;
        isRunning = true;
        lastTime = performance.now();
        animationId = requestAnimationFrame(loop);
      },
      stop() {
        isRunning = false;
        if (animationId) {
          cancelAnimationFrame(animationId);
          animationId = null;
        }
      },
      get isRunning() {
        return isRunning;
      }
    };
  }

  /**
   * 创建进度动画
   * @param {number} duration - 动画时长（毫秒）
   * @param {Function} onUpdate - 更新回调 (progress: 0-1)
   * @param {Function} onComplete - 完成回调
   * @param {Function} easing - 缓动函数
   * @returns {Promise}
   */
  static animateProgress(duration, onUpdate, onComplete = null, easing = t => t) {
    return new Promise((resolve) => {
      const startTime = performance.now();
      
      const update = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easing(progress);
        
        onUpdate(easedProgress);
        
        if (progress < 1) {
          requestAnimationFrame(update);
        } else {
          if (onComplete) onComplete();
          resolve();
        }
      };
      
      requestAnimationFrame(update);
    });
  }

  /**
   * 脉冲动画
   * @param {HTMLElement} element - DOM元素
   * @param {number} duration - 动画时长
   * @param {number} scale - 缩放比例
   */
  static pulse(element, duration = 1000, scale = 1.2) {
    element.style.transition = `transform ${duration / 2}ms ease-in-out`;
    element.style.transform = `scale(${scale})`;
    
    setTimeout(() => {
      element.style.transform = 'scale(1)';
    }, duration / 2);
  }
}

/**
 * 帧率计数器
 */
export class FPSCounter {
  constructor() {
    this.frames = 0;
    this.lastTime = performance.now();
    this.fps = 0;
  }

  update() {
    this.frames++;
    const currentTime = performance.now();
    
    if (currentTime >= this.lastTime + 1000) {
      this.fps = this.frames;
      this.frames = 0;
      this.lastTime = currentTime;
    }
    
    return this.fps;
  }

  getFPS() {
    return this.fps;
  }
}
