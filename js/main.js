import { Map2D } from './core/Map2D.js';
import { Scene3D } from './core/Scene3D.js';
import { Vehicle } from './core/Vehicle.js';
import { TrajectoryPlayer } from './core/TrajectoryPlayer.js';
import { CITIES, STATUS } from './config/constants.js';
import { CoordinateConverter } from './utils/coordinate.js';
import { AnimationUtils } from './utils/animation.js';

/**
 * 物流轨迹可视化应用主类
 */
class LogisticsApp {
  constructor() {
    this.map2d = null;
    this.scene3d = null;
    this.vehicles = new Map();
    this.trajectoryPlayer = null;
    this.currentVehicle = null;
    
    this.isLoading = true;
    this.viewMode = 'split';
    
    this.init();
  }

  /**
   * 初始化应用
   */
  async init() {
    console.log('开始初始化应用...');
    this._showLoader();
    
    try {
      // 初始化2D地图
      console.log('始化2D地图...');
      this.map2d = new Map2D(document.getElementById('map2d'));
      this.map2d.onCityClick = (cityName) => this._handleCityClick(cityName);
      this.map2d.onMapReady = () => this._onMapReady();
      
      // 初始化3D场景
      console.log('初始化3D场景...');
      this.scene3d = new Scene3D(document.getElementById('scene3d'));
      this.scene3d.onCityClick = (cityName) => this._handleCityClick(cityName);
      this.scene3d.onFPSUpdate = (fps) => this._updateFPS(fps);
      
      // 创建默认车辆
      console.log('创建默认车辆...');
      this._createDefaultVehicle();
      
      // 初始化轨迹播放器
      console.log('初始化轨迹播放器...');
      this.trajectoryPlayer = new TrajectoryPlayer(this.scene3d, this.map2d);
      
      // 创建UI
      console.log('创建UI...');
      this._createUI();
      
      // 等待地图加载完成
      console.log('等待地图加载...');
      await this._waitForMapReady();
      
      // 隐藏加载器
      console.log('隐藏加载器...');
      this._hideLoader();
      
      console.log('物流轨迹可视化系统初始化完成！');
      this._showToast('系统初始化完成');
      
    } catch (error) {
      console.error('初始化失败:', error);
      this._hideLoader();
      this._showToast('初始化失败，请刷新页面重试', 'error');
    }
  }

  /**
   * 显示加载器
   */
  _showLoader() {
    const loader = document.getElementById('loader');
    if (loader) {
      loader.classList.remove('hidden');
    }
  }

  /**
   * 隐藏加载器
   */
  _hideLoader() {
    const loader = document.getElementById('loader');
    if (loader) {
      loader.classList.add('hidden');
    }
  }

  /**
   * 等待地图准备就绪
   */
  _waitForMapReady() {
    return new Promise((resolve) => {
      // 如果地图已经就绪，直接返回
      if (this.map2d.isReady) {
        resolve();
        return;
      }
      
      // 设置超时，最多等待5秒
      const maxWaitTime = 5000;
      const startTime = Date.now();
      
      const checkReady = () => {
        if (this.map2d.isReady) {
          console.log('地图就绪');
          resolve();
        } else if (Date.now() - startTime > maxWaitTime) {
          console.warn('地图加载超时，继续初始化');
          resolve();
        } else {
          setTimeout(checkReady, 100);
        }
      };
      checkReady();
    });
  }

  /**
   * 地图准备就绪回调
   */
  _onMapReady() {
    console.log('地图加载完成');
  }

  /**
   * 创建默认车辆
   */
  _createDefaultVehicle() {
    const vehicle = new Vehicle('V001', '上海', this.scene3d.scene, {
      type: 'TRUCK',
      speed: 0.15
    });
    
    const startPos = this.scene3d.getCityPosition('上海');
    if (startPos) {
      vehicle.setPosition(startPos);
    }
    
    vehicle.onStatusChange = (status) => this._onVehicleStatusChange(vehicle, status);
    vehicle.onPositionUpdate = (position) => this._onVehiclePositionUpdate(vehicle, position);
    vehicle.onArrive = (cityName) => this._onVehicleArrive(vehicle, cityName);
    
    this.scene3d.addVehicle(vehicle);
    this.vehicles.set(vehicle.id, vehicle);
    this.currentVehicle = vehicle;
    
    this._updateVehiclePanel(vehicle);
  }

  /**
   * 处理城市点击
   */
  _handleCityClick(cityName) {
    if (!this.currentVehicle || this.currentVehicle.status === STATUS.MOVING) {
      this._showToast('车辆正在行驶中，请稍后再试');
      return;
    }
    
    console.log(`点击城市: ${cityName}, 车辆当前: ${this.currentVehicle.currentCity}, 目标: ${this.currentVehicle.targetCity}, 状态: ${this.currentVehicle.status}`);
    
    if (this.currentVehicle.currentCity === cityName) {
      this._showToast(`车辆已在${cityName}`);
      return;
    }
    
    const fromCity = this.currentVehicle.currentCity;
    const targetPos = this.scene3d.getCityPosition(cityName);
    
    if (targetPos) {
      // 记录轨迹段
      this.trajectoryPlayer.addSegment(fromCity, cityName);
      
      this.currentVehicle.moveTo(cityName, targetPos);
      this.map2d.highlightCity(cityName);
      this.scene3d.highlightCity(cityName);
      this._showToast(`车辆正在前往${cityName}`);
    }
  }

  /**
   * 车辆状态变化回调
   */
  _onVehicleStatusChange(vehicle, status) {
    this._updateVehiclePanel(vehicle);
    
    const statusText = {
      [STATUS.IDLE]: '空闲',
      [STATUS.MOVING]: '行驶中',
      [STATUS.ARRIVED]: '已到达'
    };
    
    console.log(`车辆 ${vehicle.id} 状态: ${statusText[status]}`);
  }

  /**
   * 车辆位置更新回调
   */
  _onVehiclePositionUpdate(vehicle, position) {
    // 实时更新进度条
    if (vehicle.status === STATUS.MOVING && vehicle.targetPos) {
      const progressEl = document.getElementById('task-progress');
      if (progressEl) {
        const startPos = this.scene3d.getCityPosition(vehicle.currentCity);
        if (startPos) {
          const totalDist = startPos.distanceTo(vehicle.targetPos);
          const currentDist = position.distanceTo(vehicle.targetPos);
          // 剩余距离比例，从100%逐渐减少到0%
          const remainingProgress = Math.max(0, Math.min(100, (currentDist / totalDist) * 100));
          progressEl.style.width = `${remainingProgress}%`;
        }
      }
    }
  }

  /**
   * 车辆到达回调
   */
  _onVehicleArrive(vehicle, cityName) {
    this._showToast(`车辆已到达${cityName}`);
    this.map2d.highlightCity(cityName);
  }

  /**
   * 创建UI界面
   */
  _createUI() {
    this._createVehiclePanel();
    this._createControlPanel();
    this._createCityListPanel();
    this._createFPSCounter();
    this._createToast();
  }

  /**
   * 创建车辆信息面板
   */
  _createVehiclePanel() {
    const panel = document.createElement('div');
    panel.className = 'vehicle-panel';
    panel.id = 'vehiclePanel';
    panel.innerHTML = `
      <h3>车辆信息</h3>
      <div class="info-item">
        <span>车辆编号</span>
        <span id="vehicle-id">--</span>
      </div>
      <div class="info-item">
        <span>当前位置</span>
        <span id="current-pos">--</span>
      </div>
      <div class="info-item">
        <span>目标位置</span>
        <span id="target-pos">--</span>
      </div>
      <div class="info-item">
        <span>行驶状态</span>
        <span id="vehicle-status" class="status-badge idle">空闲</span>
      </div>
      <div class="info-item">
        <span>当前速度</span>
        <span id="vehicle-speed">0 km/h</span>
      </div>
      <div class="progress-section">
        <div class="progress-label">任务进度</div>
        <div class="progress-bar">
          <div class="progress-fill" id="task-progress" style="width: 0%"></div>
        </div>
      </div>
    `;
    document.body.appendChild(panel);
  }

  /**
   * 更新车辆面板
   */
  _updateVehiclePanel(vehicle) {
    const panel = document.getElementById('vehiclePanel');
    if (!panel) return;
    
    document.getElementById('vehicle-id').textContent = vehicle.id;
    document.getElementById('current-pos').textContent = vehicle.currentCity || '--';
    document.getElementById('target-pos').textContent = vehicle.targetCity || '--';
    document.getElementById('vehicle-speed').textContent = 
      vehicle.currentSpeed > 0 ? `${Math.round(vehicle.currentSpeed * 100)} km/h` : '0 km/h';
    
    const statusEl = document.getElementById('vehicle-status');
    statusEl.className = `status-badge ${vehicle.status}`;
    
    const statusText = {
      [STATUS.IDLE]: '空闲',
      [STATUS.MOVING]: '行驶中',
      [STATUS.ARRIVED]: '已到达'
    };
    statusEl.textContent = statusText[vehicle.status] || vehicle.status;
    
    // 更新进度条 - 只有行驶中才显示进度
    const progressEl = document.getElementById('task-progress');
    if (vehicle.status === STATUS.MOVING && vehicle.targetPos) {
      const startPos = this.scene3d.getCityPosition(vehicle.currentCity);
      if (startPos) {
        const totalDist = startPos.distanceTo(vehicle.targetPos);
        const currentDist = vehicle.getPosition().distanceTo(vehicle.targetPos);
        // 剩余距离比例，从100%逐渐减少到0%
        const remainingProgress = Math.max(0, Math.min(100, (currentDist / totalDist) * 100));
        progressEl.style.width = `${remainingProgress}%`;
      }
    } else if (vehicle.status === STATUS.IDLE) {
      // 空闲状态不显示进度条
      progressEl.style.width = '0%';
    } else if (vehicle.status === STATUS.ARRIVED) {
      // 到达后显示空格（任务完成）
      progressEl.style.width = '0%';
    }
  }

  /**
   * 创建控制面板
   */
  _createControlPanel() {
    const panel = document.createElement('div');
    panel.className = 'control-panel';
    panel.innerHTML = `
      <button class="control-btn" id="play-btn">
        <span>▶</span> 回放
      </button>
      <button class="control-btn secondary" id="pause-btn">
        <span>⏸</span> 暂停
      </button>
      <button class="control-btn secondary" id="stop-btn">
        <span>⏹</span> 停止
      </button>
      <button class="control-btn secondary" id="toggle-trace-btn">
        <span>👁</span> 隐藏轨迹
      </button>
      <button class="control-btn secondary" id="clear-trace-btn">
        <span>🗑</span> 清除轨迹
      </button>
      <div class="speed-control">
        <span>速度:</span>
        <input type="range" class="speed-slider" id="speed-slider" 
               min="0.5" max="5" step="0.5" value="1">
        <span id="speed-value">1x</span>
      </div>
      <select class="view-mode-select" id="view-mode">
        <option value="split">分屏视图</option>
        <option value="2d">仅2D地图</option>
        <option value="3d">仅3D场景</option>
      </select>
    `;
    document.body.appendChild(panel);
    
    // 绑定事件
    document.getElementById('play-btn').addEventListener('click', () => this._playTrajectory());
    document.getElementById('pause-btn').addEventListener('click', () => this._pauseTrajectory());
    document.getElementById('stop-btn').addEventListener('click', () => this._stopTrajectory());
    document.getElementById('toggle-trace-btn').addEventListener('click', () => this._toggleTrace());
    document.getElementById('clear-trace-btn').addEventListener('click', () => this._clearTrace());
    
    const speedSlider = document.getElementById('speed-slider');
    speedSlider.addEventListener('input', (e) => {
      const speed = parseFloat(e.target.value);
      document.getElementById('speed-value').textContent = `${speed}x`;
      if (this.trajectoryPlayer) {
        this.trajectoryPlayer.setSpeed(speed);
      }
    });
    
    document.getElementById('view-mode').addEventListener('change', (e) => {
      this._setViewMode(e.target.value);
    });
  }

  /**
   * 播放轨迹
   */
  _playTrajectory() {
    console.log('播放轨迹按钮被点击');
    if (!this.currentVehicle) {
      console.warn('没有当前车辆');
      return;
    }
    
    console.log('当前车辆:', this.currentVehicle.id);
    console.log('轨迹数据长度:', this.trajectoryPlayer.trajectoryData.length);
    
    if (!this.trajectoryPlayer.trajectoryData.length) {
      // 生成模拟轨迹
      const cities = Object.keys(CITIES);
      const startCity = this.currentVehicle.currentCity || cities[0];
      const endCity = cities.find(c => c !== startCity) || cities[1];
      console.log('生成轨迹:', startCity, '->', endCity);
      this.trajectoryPlayer.generateTrajectory(startCity, endCity, 100);
      this.trajectoryPlayer.bindVehicle(this.currentVehicle);
    }
    
    this.trajectoryPlayer.play();
    this._showToast('开始轨迹回放');
  }

  /**
   * 暂停轨迹
   */
  _pauseTrajectory() {
    if (this.trajectoryPlayer) {
      this.trajectoryPlayer.pause();
      this._showToast('轨迹回放已暂停');
    }
  }

  /**
   * 停止轨迹
   */
  _stopTrajectory() {
    if (this.trajectoryPlayer) {
      this.trajectoryPlayer.stop();
      this._showToast('轨迹回放已停止');
    }
  }

  /**
   * 切换轨迹显示/隐藏
   */
  _toggleTrace() {
    if (!this.trajectoryPlayer) return;
    
    const isVisible = this.trajectoryPlayer.toggleVisibility();
    const btn = document.getElementById('toggle-trace-btn');
    if (btn) {
      btn.innerHTML = isVisible ? '<span>👁</span> 隐藏轨迹' : '<span>👁</span> 显示轨迹';
    }
    this._showToast(isVisible ? '轨迹已显示' : '轨迹已隐藏');
  }

  /**
   * 清除轨迹
   */
  _clearTrace() {
    if (!this.trajectoryPlayer) return;
    
    this.trajectoryPlayer.clear();
    
    // 重置按钮文字
    const btn = document.getElementById('toggle-trace-btn');
    if (btn) {
      btn.innerHTML = '<span>👁</span> 隐藏轨迹';
    }
    
    this._showToast('所有轨迹已清除');
  }

  /**
   * 设置视图模式
   */
  _setViewMode(mode) {
    this.viewMode = mode;
    const map2d = document.getElementById('map2d');
    const scene3d = document.getElementById('scene3d');
    
    switch (mode) {
      case '2d':
        map2d.style.width = '100%';
        scene3d.style.width = '0%';
        scene3d.style.display = 'none';
        map2d.style.display = 'block';
        break;
      case '3d':
        map2d.style.width = '0%';
        map2d.style.display = 'none';
        scene3d.style.width = '100%';
        scene3d.style.display = 'block';
        break;
      default:
        map2d.style.width = '50%';
        map2d.style.display = 'block';
        scene3d.style.width = '50%';
        scene3d.style.display = 'block';
    }
    
    // 触发resize事件
    window.dispatchEvent(new Event('resize'));
  }

  /**
   * 创建城市列表面板
   */
  _createCityListPanel() {
    const panel = document.createElement('div');
    panel.className = 'city-list-panel';
    panel.innerHTML = `
      <h4>城市列表</h4>
      <div id="city-list"></div>
    `;
    document.body.appendChild(panel);
    
    const cityList = document.getElementById('city-list');
    const cityEntries = Object.entries(CITIES);
    
    cityEntries.forEach(([name, data], index) => {
      const item = document.createElement('div');
      item.className = 'city-item';
      
      // 前3个城市（上海、北京、广州）使用橙色，其他城市使用蓝色
      const isHighlight = index < 3;
      const dotClass = isHighlight ? 'highlight' : 'normal';
      
      item.innerHTML = `
        <span class="city-dot ${dotClass}"></span>
        <span>${name}</span>
      `;
      item.addEventListener('click', () => this._handleCityClick(name));
      cityList.appendChild(item);
    });
  }

  /**
   * 创建FPS计数器
   */
  _createFPSCounter() {
    const fps = document.createElement('div');
    fps.className = 'fps-counter';
    fps.id = 'fps-counter';
    fps.textContent = 'FPS: 60';
    document.body.appendChild(fps);
  }

  /**
   * 更新FPS显示
   */
  _updateFPS(fps) {
    const fpsEl = document.getElementById('fps-counter');
    if (fpsEl) {
      fpsEl.textContent = `FPS: ${fps}`;
      fpsEl.style.color = fps >= 50 ? '#0f0' : fps >= 30 ? '#ff0' : '#f00';
    }
  }

  /**
   * 创建Toast提示
   */
  _createToast() {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.id = 'toast';
    document.body.appendChild(toast);
  }

  /**
   * 显示Toast提示
   */
  _showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (toast) {
      toast.textContent = message;
      toast.classList.add('show');
      
      setTimeout(() => {
        toast.classList.remove('show');
      }, 3000);
    }
  }

  /**
   * 销毁应用
   */
  dispose() {
    if (this.trajectoryPlayer) {
      this.trajectoryPlayer.dispose();
    }
    
    this.vehicles.forEach(vehicle => vehicle.dispose());
    this.vehicles.clear();
    
    if (this.map2d) {
      this.map2d.dispose();
    }
    
    if (this.scene3d) {
      this.scene3d.dispose();
    }
  }
}

// 导出全局实例
window.LogisticsApp = LogisticsApp;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  window.app = new LogisticsApp();
});

// 页面卸载时清理资源
window.addEventListener('beforeunload', () => {
  if (window.app) {
    window.app.dispose();
  }
});
